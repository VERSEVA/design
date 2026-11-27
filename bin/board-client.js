/* verseva board, in the browser (an ES module).
   The switcher: picking a theme points one stylesheet at /theme/<id>.css and sets
   <html data-brand="<id>">; Baseline removes both. ?brand=<id> opens a theme directly; an id the
   menu does not list falls back to Baseline. Open, close and the outside click come from the
   specimen page's own .menu wiring; this adds the pick, Escape, and arrow keys between items.
   The checks: for the theme and mode on screen, a ratio per pair in contrast-pairs.mjs against
   its floor (alpha composited over the real backdrop, the contrast gate's math), and each ban the
   theme declares asserted on every specimen its rows name (board-bans.mjs). Every cell is text.
   Redrawn when the theme sheet loads and when data-brand or data-theme changes; each section's
   data-board-for says which brand|mode it shows. */
import { PAIRS } from '/contrast-pairs.mjs';
import { BANS, holds, isBan } from '/board-bans.mjs';

const root = document.documentElement;
const button = document.getElementById('board-current');
const list = document.getElementById('board-themes');
const items = list ? [...list.querySelectorAll('[data-board-theme]')] : [];
let link = document.getElementById('board-theme');

/* ---- contrast: the gate's math on the live computed tokens ---- */
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
  return [f(0), f(8), f(4)];
}

function parseColor(value) {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    let h = hex[1].toLowerCase();
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (o) => parseInt(h.slice(o, o + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const num = (s, scale = 1) => (s.endsWith('%') ? (parseFloat(s) / 100) * scale : parseFloat(s));
  const rgb = v.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
  if (rgb) return [num(rgb[1], 255), num(rgb[2], 255), num(rgb[3], 255), rgb[4] === undefined ? 1 : num(rgb[4])];
  const hsl = v.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
  if (hsl) return [...hslToRgb(parseFloat(hsl[1]), parseFloat(hsl[2]), parseFloat(hsl[3])), hsl[4] === undefined ? 1 : num(hsl[4])];
  return null;
}

const luminance = ([r, g, b]) => {
  const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (fg, bg) => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (top, under) => [0, 1, 2].map((i) => top[3] * top[i] + (1 - top[3]) * under[i]);

function measure() {
  const style = getComputedStyle(root);
  const read = (name) => {
    let value = style.getPropertyValue(`--${name}`).trim();
    for (let hops = 0; hops < 4; hops++) {
      const ref = value.match(/^var\(--([\w-]+)\)$/);
      if (!ref) break;
      value = style.getPropertyValue(`--${ref[1]}`).trim();
    }
    return value ? parseColor(value) : null;
  };
  const canvas = read('bg');
  return PAIRS.map(([fgName, chain, floor]) => {
    const fg = read(fgName);
    /* the backdrop chain is top layer first: composite from the canvas up */
    let backdrop = canvas ? canvas.slice(0, 3) : null;
    for (const layerName of [...chain].reverse()) {
      if (!backdrop) break;
      const [token, factor] = layerName.split('*');
      const layer = read(token);
      if (!layer) { backdrop = null; break; }
      backdrop = over(factor ? [layer[0], layer[1], layer[2], layer[3] * parseFloat(factor)] : layer, backdrop);
    }
    if (!fg || !backdrop) return { fg: fgName, bg: chain.join(' + '), ratio: null, floor, pass: false };
    const r = ratio(fg[3] < 1 ? over(fg, backdrop) : fg.slice(0, 3), backdrop);
    return { fg: fgName, bg: chain.join(' + '), ratio: r, floor, pass: r >= floor };
  });
}

/* ---- drawing: text cells and contract badges only ---- */
const cell = (text, cls) => {
  const td = document.createElement('td');
  if (cls) td.className = cls;
  td.textContent = text;
  return td;
};
const badge = (pass, text) => {
  const b = document.createElement('span');
  b.className = `badge ${pass ? 'ok' : 'err'}`;
  b.textContent = text;
  return b;
};
const resultCell = (pass, text = pass ? 'Pass' : 'Fail') => {
  const td = document.createElement('td');
  td.append(badge(pass, text));
  return td;
};

function drawContrast(section, rows) {
  const body = section.querySelector('tbody');
  body.replaceChildren(...rows.map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.pass = String(r.pass);
    tr.append(cell(r.fg), cell(r.bg), cell(r.ratio === null ? 'unresolved' : `${r.ratio.toFixed(2)}:1`, 'num'), cell(String(r.floor), 'num'), resultCell(r.pass));
    return tr;
  }));
  section.querySelector('[data-board-count]').textContent = `${rows.filter((r) => r.pass).length} of ${rows.length} pass`;
}

/* Specimens are the contract sections, never the board's own check sections. */
const specimens = (selector) => [...document.querySelectorAll('.doccol .comp:not(#board-contrast):not(#board-bans)')]
  .flatMap((comp) => [...comp.querySelectorAll(selector)]);

function drawBans(section, bans) {
  const rows = bans.flatMap((ban) => BANS[ban].map((row) => {
    const els = specimens(row.specimen);
    const failed = els.filter((el) => !holds(row, getComputedStyle(el).getPropertyValue(row.property)));
    /* a row that matches nothing proves nothing: it fails */
    const pass = els.length > 0 && failed.length === 0;
    const seen = failed[0] ? getComputedStyle(failed[0]).getPropertyValue(row.property).trim() : '';
    return { ban, row, checked: els.length, pass, seen };
  }));
  const chips = section.querySelector('.chiprow');
  const count = chips.querySelector('[data-board-count]');
  count.textContent = `${bans.length} ban${bans.length === 1 ? '' : 's'}`;
  chips.replaceChildren(count, ...bans.map((ban) => {
    const pass = rows.filter((r) => r.ban === ban).every((r) => r.pass);
    const b = badge(pass, `${ban} ${pass ? 'Pass' : 'Fail'}`);
    b.dataset.boardBan = ban;
    b.dataset.pass = String(pass);
    return b;
  }));
  section.querySelector('tbody').replaceChildren(...rows.map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.pass = String(r.pass);
    tr.append(cell(r.ban), cell(r.row.check), cell(r.row.specimen), cell(r.row.property), cell(r.row.expect), cell(String(r.checked), 'num'),
      resultCell(r.pass, r.pass ? 'Pass' : r.checked ? `Fail: ${r.seen}` : 'Fail: no specimen'));
    return tr;
  }));
}

function draw() {
  const brand = root.dataset.brand || '';
  /* a theme's sheet not loaded yet would measure the base tokens: its load event draws instead */
  if (brand && !link.sheet) return;
  const mode = root.dataset.theme === 'light' ? 'light' : 'dark';
  const item = items.find((i) => i.dataset.boardTheme === brand);
  const bans = (item?.dataset.boardBans ?? '').split(' ').filter(isBan);
  const contrast = document.getElementById('board-contrast');
  const banned = document.getElementById('board-bans');
  if (contrast) { drawContrast(contrast, measure()); contrast.dataset.boardFor = `${brand}|${mode}`; }
  if (banned) { drawBans(banned, bans); banned.dataset.boardFor = `${brand}|${mode}`; }
}

/* ---- the switcher ---- */
function apply(id) {
  const item = items.find((i) => i.dataset.boardTheme === id) || items[0];
  const theme = item.dataset.boardTheme;
  /* a fresh link per switch: the old sheet goes with its element; checks redraw once it loads */
  const next = document.createElement('link');
  next.rel = 'stylesheet';
  next.id = 'board-theme';
  if (theme) {
    next.addEventListener('load', () => { if (link === next) draw(); });
    next.href = `/theme/${theme}.css`;
  }
  link.replaceWith(next);
  link = next;
  if (theme) root.dataset.brand = theme; else delete root.dataset.brand;
  items.forEach((i) => i.setAttribute('aria-checked', String(i === item)));
  button.textContent = item.textContent;
  const url = new URL(location.href);
  if (theme) url.searchParams.set('brand', theme); else url.searchParams.delete('brand');
  history.replaceState(null, '', url);
  if (!theme) draw();
}

if (button && list) {
  const open = () => {
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    (items.find((i) => i.getAttribute('aria-checked') === 'true') || items[0]).focus();
  };
  const close = (refocus) => {
    if (list.hidden) return;
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
  };
  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); open(); }
  });
  items.forEach((item, ix) => {
    item.addEventListener('click', () => { apply(item.dataset.boardTheme); close(true); });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        items[(ix + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      }
    });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(true); });

  /* light and dark flip by data-theme (theme.js): the checks follow it */
  new MutationObserver(() => draw()).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  apply(new URLSearchParams(location.search).get('brand') || '');
}
