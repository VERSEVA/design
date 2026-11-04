// The SEO kit, generated at build time, never hand-exported:
//   icon.svg, favicon.ico (16 + 32), apple-touch-icon.png (180), icon-192.png, icon-512.png,
//   icon-maskable-512.png, og.png (1200x630), site.webmanifest, robots.txt, sitemap.xml.
// Source: the emblem (src/shell/emblem.ts) and the dark canvas tokens in tokens.css.
// Full clear space (ruled 2026-11-04): the emblem's width on every side, so on a square
// icon the emblem is one third of the canvas; on the social card, one third of the height.
// The rasterizer below is deliberate: no image dependency, and the emblem is four filled
// paths with rectangular clips, which is all it has to draw.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const studio = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(studio, '..');
export const SITE = 'https://design.verseva.com';

/* ---------- sources ---------- */

export function readEmblem() {
  const src = fs.readFileSync(path.join(studio, 'src/shell/emblem.ts'), 'utf8');
  const svg = src.match(/`(<svg[\s\S]*?<\/svg>)`/)?.[1];
  if (!svg) throw new Error('seo-kit: no emblem SVG in src/shell/emblem.ts');
  const [vx, vy, vw, vh] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const clips = Object.fromEntries([...svg.matchAll(/<clipPath id="([^"]+)"><path d="([^"]+)"\/><\/clipPath>/g)].map((m) => [m[1], m[2]]));
  const layers = [...svg.matchAll(/<g clip-path="url\(#([^)]+)\)"><path fill="currentColor"(?: opacity="([^"]+)")? d="([^"]+)"\/><\/g>/g)].map((m) => {
    if (!clips[m[1]]) throw new Error(`seo-kit: emblem clip ${m[1]} missing`);
    return { clip: bounds(flatten(clips[m[1]])), opacity: m[2] ? Number(m[2]) : 1, polys: flatten(m[3]) };
  });
  if (layers.length !== 4) throw new Error(`seo-kit: expected 4 emblem layers, found ${layers.length}`);
  return { svg, viewBox: [vx, vy, vw, vh], layers };
}

/** The dark canvas and its top text step: the first (dark, :root) declaration of each. */
export function readTokens() {
  const css = fs.readFileSync(path.join(repo, 'tokens.css'), 'utf8');
  const pick = (name) => {
    const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
    if (!m) throw new Error(`seo-kit: ${name} not found as a hex in tokens.css`);
    return m[1].toUpperCase();
  };
  return { bg: pick('--bg'), ink: pick('--text-1') };
}

/* ---------- geometry ---------- */

/** SVG path data (M L H V C Z, absolute or relative) to closed polylines. */
export function flatten(d) {
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const polys = [];
  let poly = null, cx = 0, cy = 0, sx = 0, sy = 0, cmd = '', i = 0;
  const num = () => Number(tok[i++]);
  const line = (x, y) => { poly.push([x, y]); cx = x; cy = y; };
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    switch (cmd.toUpperCase()) {
      case 'M': {
        const x = num() + ox, y = num() + oy;
        poly = [[x, y]]; polys.push(poly); cx = sx = x; cy = sy = y;
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': line(num() + ox, num() + oy); break;
      case 'H': line(num() + ox, cy); break;
      case 'V': line(cx, num() + oy); break;
      case 'C': {
        const x1 = num() + ox, y1 = num() + oy, x2 = num() + ox, y2 = num() + oy, x = num() + ox, y = num() + oy;
        const x0 = cx, y0 = cy, n = 32;
        for (let k = 1; k <= n; k++) {
          const t = k / n, u = 1 - t;
          line(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
            u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y);
        }
        break;
      }
      case 'Z':
        cx = sx; cy = sy;
        if (i < tok.length && !/[a-zA-Z]/.test(tok[i])) throw new Error('seo-kit: numbers after Z');
        break;
      default: throw new Error(`seo-kit: unsupported path command ${cmd}`);
    }
  }
  return polys;
}

export function bounds(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
}

/** The ink box: every layer's outline intersected with its clip. */
export function inkBounds(emblem) {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const l of emblem.layers) {
    const p = bounds(l.polys);
    b.x0 = Math.min(b.x0, Math.max(p.x0, l.clip.x0)); b.y0 = Math.min(b.y0, Math.max(p.y0, l.clip.y0));
    b.x1 = Math.max(b.x1, Math.min(p.x1, l.clip.x1)); b.y1 = Math.max(b.y1, Math.min(p.y1, l.clip.y1));
  }
  return b;
}

/** Emblem width = canvas height / 3 (square icons: also width / 3), centred on its ink. */
export function placement(emblem, w, h) {
  const ink = inkBounds(emblem);
  const s = Math.min(w, h) / 3 / (ink.x1 - ink.x0);
  return { s, tx: w / 2 - s * (ink.x0 + ink.x1) / 2, ty: h / 2 - s * (ink.y0 + ink.y1) / 2, ink };
}

/* ---------- raster ---------- */

const SUB = 8; // sub-scanlines per pixel; horizontal coverage is exact per span

/** Coverage (0..1) of a nonzero-filled polygon set inside a clip rect, on a w x h grid. */
function coverage(polys, clip, w, h) {
  const cov = new Float32Array(w * h);
  const edges = [];
  for (const p of polys) for (let k = 0; k < p.length; k++) {
    const [ax, ay] = p[k], [bx, by] = p[(k + 1) % p.length];
    if (ay !== by) edges.push(ay < by ? [ax, ay, bx, by, 1] : [bx, by, ax, ay, -1]);
  }
  const yMin = Math.max(0, Math.floor(clip.y0)), yMax = Math.min(h, Math.ceil(clip.y1));
  for (let py = yMin; py < yMax; py++) {
    for (let s = 0; s < SUB; s++) {
      const y = py + (s + 0.5) / SUB;
      if (y < clip.y0 || y >= clip.y1) continue;
      const xs = [];
      for (const [ax, ay, bx, by, dir] of edges) if (y >= ay && y < by) xs.push([ax + (y - ay) * (bx - ax) / (by - ay), dir]);
      xs.sort((a, b) => a[0] - b[0]);
      let wind = 0;
      for (let k = 0; k < xs.length - 1; k++) {
        wind += xs[k][1];
        if (!wind) continue;
        const l = Math.max(xs[k][0], clip.x0, 0), r = Math.min(xs[k + 1][0], clip.x1, w);
        if (r <= l) continue;
        const row = py * w;
        const li = Math.floor(l), ri = Math.floor(r);
        if (li === ri) { cov[row + li] += (r - l) / SUB; continue; }
        cov[row + li] += (li + 1 - l) / SUB;
        for (let x = li + 1; x < ri && x < w; x++) cov[row + x] += 1 / SUB;
        if (ri < w) cov[row + ri] += (r - ri) / SUB;
      }
    }
  }
  return cov;
}

const rgb = (hex) => [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16));

/** RGBA pixels: an opaque canvas with the emblem drawn layer by layer (source-over). */
export function rasterize(emblem, colors, w, h) {
  const { s, tx, ty } = placement(emblem, w, h);
  const bg = rgb(colors.bg), ink = rgb(colors.ink);
  const px = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) px.set(bg, i * 3);
  for (const l of emblem.layers) {
    const polys = l.polys.map((p) => p.map(([x, y]) => [x * s + tx, y * s + ty]));
    const clip = { x0: l.clip.x0 * s + tx, y0: l.clip.y0 * s + ty, x1: l.clip.x1 * s + tx, y1: l.clip.y1 * s + ty };
    const cov = coverage(polys, clip, w, h);
    for (let i = 0; i < w * h; i++) {
      const a = Math.min(1, cov[i]) * l.opacity;
      if (a <= 0) continue;
      for (let c = 0; c < 3; c++) px[i * 3 + c] = px[i * 3 + c] * (1 - a) + ink[c] * a;
    }
  }
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(px[i * 3 + c]);
    out[i * 4 + 3] = 255;
  }
  return out;
}

/* ---------- encoders ---------- */

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

export function png(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** An ICO holding PNG images (Vista and later read PNG entries). */
export function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, data }, k) => {
    const e = 6 + 16 * k;
    head[e] = size >= 256 ? 0 : size; head[e + 1] = size >= 256 ? 0 : size;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.data)]);
}

/** The vector icon: the emblem on the canvas tile at full clear space. */
export function iconSvg(emblem, colors) {
  const N = 512;
  const { s, tx, ty } = placement(emblem, N, N);
  const inner = emblem.svg
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
    .replace(/currentColor/g, colors.ink);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}"><rect width="${N}" height="${N}" fill="${colors.bg}"/><g transform="translate(${+tx.toFixed(3)} ${+ty.toFixed(3)}) scale(${+s.toFixed(6)})">${inner}</g></svg>\n`;
}

/* ---------- the kit ---------- */

const canonical = (p) => (p === '/' ? `${SITE}/` : `${SITE}${p}`);

export function sitemap(paths) {
  const urls = paths.map((p) => `  <url><loc>${canonical(p)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;

export function manifest(colors) {
  return JSON.stringify({
    name: 'VERSEVA Design',
    short_name: 'VERSEVA',
    start_url: '/',
    display: 'browser',
    background_color: colors.bg,
    theme_color: colors.bg,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }, null, 2) + '\n';
}

/** Writes the kit into dir; returns the file names written. */
export function writeSeoKit(dir, paths) {
  const emblem = readEmblem();
  const colors = readTokens();
  const square = (n) => png(rasterize(emblem, colors, n, n), n, n);
  const files = {
    'icon.svg': iconSvg(emblem, colors),
    'favicon.ico': ico([16, 32].map((size) => ({ size, data: square(size) }))),
    'apple-touch-icon.png': square(180),
    'icon-192.png': square(192),
    'icon-512.png': square(512),
    // Maskable safe zone is the centre 80% circle; the emblem at one third sits well inside it.
    'icon-maskable-512.png': square(512),
    'og.png': png(rasterize(emblem, colors, 1200, 630), 1200, 630),
    'site.webmanifest': manifest(colors),
    'robots.txt': robots(),
    'sitemap.xml': sitemap(paths),
  };
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
  return Object.keys(files);
}
