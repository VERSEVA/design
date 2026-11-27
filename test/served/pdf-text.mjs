// The text on each page of a PDF Chrome printed (Page.printToPDF), for the served print tests.
// Enough of a reader for Chrome's own output: uncompressed object table, FlateDecode content
// streams, simple and Type3 fonts (one-byte codes) or Type0 fonts (two-byte codes), and a ToUnicode CMap per font
// (bfchar and bfrange). Returns one string per page, in page order, whitespace dropped, so a
// test asks "is this text on page n" without caring how Chrome spaced the glyphs.
import zlib from 'node:zlib';

function objects(pdf) {
  const objs = new Map();
  for (const m of pdf.matchAll(/(\d+) 0 obj\b([\s\S]*?)endobj/g)) objs.set(Number(m[1]), m[2]);
  return objs;
}

function streamOf(body) {
  const m = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
  if (!m) return '';
  const raw = Buffer.from(m[1], 'latin1');
  return /\/FlateDecode/.test(body) ? zlib.inflateSync(raw).toString('latin1') : raw.toString('latin1');
}

const hexToStr = (hex) => {
  let s = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) s += String.fromCodePoint(Number.parseInt(hex.slice(i, i + 4), 16));
  return s;
};

function cmapOf(text) {
  const map = new Map();
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(Number.parseInt(m[1], 16), hexToStr(m[2]));
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const lo = Number.parseInt(m[1], 16), hi = Number.parseInt(m[2], 16), dst = Number.parseInt(m[3], 16);
      for (let c = lo; c <= hi; c++) map.set(c, String.fromCodePoint(dst + c - lo));
    }
  }
  return map;
}

/* A dictionary entry that is either inline (<< ... >>) or a reference (N 0 R). */
function dictEntry(objs, body, key) {
  const at = body.indexOf(`/${key}`);
  if (at < 0) return null;
  const rest = body.slice(at + key.length + 1).trimStart();
  const ref = rest.match(/^(\d+) 0 R/);
  if (ref) return objs.get(Number(ref[1])) ?? null;
  if (!rest.startsWith('<<')) return null;
  let depth = 0;
  for (let i = 0; i < rest.length - 1; i++) {
    if (rest[i] === '<' && rest[i + 1] === '<') { depth++; i++; } else if (rest[i] === '>' && rest[i + 1] === '>') { depth--; i++; if (!depth) return rest.slice(0, i + 1); }
  }
  return null;
}

export function pdfPages(buf) {
  const pdf = buf.toString('latin1');
  const objs = objects(pdf);
  /* page order: walk the page tree from the catalog's /Pages through /Kids */
  const order = [];
  const walk = (n) => {
    const body = objs.get(n);
    if (!body) return;
    if (/\/Type\s*\/Pages\b/.test(body)) for (const k of body.match(/\/Kids\s*\[([^\]]*)\]/)[1].matchAll(/(\d+) 0 R/g)) walk(Number(k[1]));
    else if (/\/Type\s*\/Page\b/.test(body)) order.push(n);
  };
  const root = [...objs.entries()].find(([, b]) => /\/Type\s*\/Catalog\b/.test(b));
  walk(Number(root[1].match(/\/Pages\s+(\d+) 0 R/)[1]));
  const cmaps = new Map();
  const fontMap = (ref) => {
    if (!cmaps.has(ref)) {
      const tu = objs.get(ref)?.match(/\/ToUnicode\s+(\d+) 0 R/);
      const map = tu ? cmapOf(streamOf(objs.get(Number(tu[1])))) : new Map();
      map.width = /\/Subtype\s*\/Type0\b/.test(objs.get(ref) ?? '') ? 4 : 2;
      cmaps.set(ref, map);
    }
    return cmaps.get(ref);
  };
  return order.map((n) => {
    const page = objs.get(n);
    const res = dictEntry(objs, page, 'Resources') ?? '';
    const fontDict = dictEntry(objs, res, 'Font') ?? '';
    const fonts = new Map([...fontDict.matchAll(/\/([\w.+-]+)\s+(\d+) 0 R/g)].map((m) => [m[1], Number(m[2])]));
    const refs = (() => {
      const arr = page.match(/\/Contents\s*\[([^\]]*)\]/);
      if (arr) return [...arr[1].matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1]));
      return [Number(page.match(/\/Contents\s+(\d+) 0 R/)[1])];
    })();
    let text = '';
    for (const ref of refs) {
      const ops = streamOf(objs.get(ref));
      let map = Object.assign(new Map(), { width: 2 });
      for (const m of ops.matchAll(/\/([\w.+-]+)\s+[\d.]+\s+Tf|<([0-9a-fA-F]*)>|\]\s*TJ|Tj/g)) {
        if (m[1]) { map = fontMap(fonts.get(m[1])); continue; }
        if (m[2] !== undefined) for (let i = 0; i + map.width <= m[2].length; i += map.width) text += map.get(Number.parseInt(m[2].slice(i, i + map.width), 16)) ?? '';
      }
    }
    /* NFKC folds ligature glyphs (U+FB01 for "fi") that some fonts map in their ToUnicode CMaps. */
    return text.normalize('NFKC').replace(/\s+/g, '');
  });
}
