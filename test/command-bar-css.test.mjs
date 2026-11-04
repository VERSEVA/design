// Command bar recipes (1.6.0): .cmdk parts with every contract state, the phone sheet, reduced
// motion, tokens only, contrast, and the three-column .tbar that applies only with a .searchbox.
// Reads files only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const RAW = read('components.css');
const TOKENS_RAW = read('tokens.css');
const HEAD = '/* ---- Command bar (1.6.0): .cmdk, its trigger, the three-column top bar ---- */';
const THEMES = ['cobalt', 'forest', 'slate', 'violet'];
const MOTION_OK = '@media (prefers-reduced-motion:no-preference)';
const PHONE = '@media (max-width:599.98px)';

function splitSelectors(prelude) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of prelude) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

function parseRules(src) {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  (function walk(text, media) {
    let i = 0;
    let start = 0;
    while (i < text.length) {
      if (text[i] === '{') {
        const prelude = text.slice(start, i).trim();
        let depth = 1;
        let j = i + 1;
        while (j < text.length && depth > 0) {
          if (text[j] === '{') depth++;
          else if (text[j] === '}') depth--;
          j++;
        }
        const body = text.slice(i + 1, j - 1);
        if (/^@(media|supports)\b/.test(prelude)) walk(body, prelude);
        else if (/^@keyframes\b/.test(prelude)) out.push({ media, selectors: [prelude.replace(/\s+/g, ' ')], body });
        else out.push({ media, selectors: splitSelectors(prelude), body });
        i = j;
        start = j;
      } else if (text[i] === '}') { i++; start = i; } else i++;
    }
  })(css, null);
  return out;
}

const section = () => {
  const a = RAW.indexOf(HEAD);
  assert.ok(a > -1, 'command bar section header missing');
  const next = RAW.indexOf('/* ---- ', a + HEAD.length);
  return next === -1 ? RAW.slice(a) : RAW.slice(a, next);
};
const SEC = parseRules(section());
const ALL = parseRules(RAW);
const sels = new Set(SEC.flatMap((r) => r.selectors));
const bodyOf = (sel, media = null, rules = SEC) => rules.filter((r) => r.media === media && r.selectors.includes(sel)).map((r) => r.body).join(';');
const missing = (list) => list.filter((s) => !sels.has(s));

// ---- contrast math (same model as the console shell test) ----
function blocks(src) {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    out[sel] = { ...(out[sel] ?? {}) };
    for (const p of m[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[sel][p[1]] = p[2].trim();
  }
  return out;
}
function themeProps(mode, brand) {
  const base = blocks(TOKENS_RAW);
  let p = { ...base[':root'] };
  if (mode === 'light') p = { ...p, ...base['[data-theme="light"]'] };
  if (brand) {
    const b = blocks(read(`themes/${brand}.css`));
    p = { ...p, ...b[`[data-brand="${brand}"]`] };
    if (mode === 'light') p = { ...p, ...b[`[data-brand="${brand}"][data-theme="light"]`] };
  }
  return p;
}
const hex = (v) => { const m = v.trim().match(/^#([0-9a-f]{6})$/i); assert.ok(m, `not a hex: ${v}`); return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)); };
const over = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
const lin = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function each(fn, floor) {
  const fails = [];
  for (const brand of [null, ...THEMES]) for (const mode of ['dark', 'light']) {
    const p = themeProps(mode, brand);
    const catchLight = +p['surface-body'].match(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)/)[1];
    const surface = hex(p.surface);
    const s = { panel: over([255, 255, 255], catchLight, surface), surface, surface2: hex(p['surface-2']), text1: hex(p['text-1']), text2: hex(p['text-2']), accent: hex(p.accent), danger: hex(p.danger) };
    for (const [name, r] of Object.entries(fn(s))) if (r < floor) fails.push(`${brand ?? 'base'} ${mode} ${name}: ${r.toFixed(2)}`);
  }
  return fails;
}

// ---- placement and parts ----
test('placement: one self-contained command bar section', () => {
  assert.equal(RAW.split(HEAD).length, 2, 'exactly one command bar section');
});

test('parts: overlay, panel, field, listbox, answer, footer and trigger selectors present', () => {
  assert.deepEqual(missing([
    '.cmdk-ovl', '.cmdk-ovl[hidden]', '.cmdk', '.cmdk-field', '.cmdk-field>svg', '.cmdk-input', '.cmdk-input::placeholder',
    '.cmdk-mode', '.cmdk-kbd', '.cmdk-list', '.cmdk-list ul', '.cmdk-group', '.cmdk-opt', '.cmdk-opt>svg', '.cmdk-label',
    '.cmdk-hint', '.cmdk-opt.ask>svg', '.cmdk-empty', '.cmdk-ans', '.cmdk-q', '.cmdk-a', '.cmdk-caret', '.cmdk-load',
    '.cmdk-widget', '.cmdk-acts', '.cmdk-err', '.cmdk-err svg', '.cmdk-ft', '.cmdk-trigger', '.cmdk-trigger>span',
  ]), []);
});

test('states: hover, focus-visible, press, disabled, loading, empty and error each have a rule', () => {
  assert.deepEqual(missing([
    '.cmdk-opt:hover', '.cmdk-trigger:hover',
    '.cmdk:has(.cmdk-input:focus-visible) .cmdk-opt[aria-selected="true"]', '.cmdk-trigger:focus-visible',
    '.cmdk-opt:active', '.cmdk-trigger:active',
    '.cmdk-opt[aria-disabled="true"]', '.cmdk-opt[aria-disabled="true"]:hover', '.cmdk-opt[aria-disabled="true"]:active', '.cmdk-trigger:disabled',
    '.cmdk-opt[aria-selected="true"]',
    '.cmdk-ans:not([aria-busy="true"]) .cmdk-caret', '.cmdk-load .skel',
  ]), []);
  assert.match(bodyOf('.cmdk:has(.cmdk-input:focus-visible) .cmdk-opt[aria-selected="true"]'), /outline:2px solid var\(--focus\)/, 'the active option carries the focus ring while the field has focus');
  assert.match(bodyOf('.cmdk-opt[aria-disabled="true"]'), /opacity:\.45/);
  assert.match(bodyOf('.cmdk-trigger:disabled'), /opacity:\.45/);
  assert.match(bodyOf('.cmdk-empty'), /color:var\(--text-2\)/, 'empty state in --text-2');
  assert.match(bodyOf('.cmdk-err svg'), /color:var\(--danger\)/, 'error carries the danger icon; the word carries the meaning');
});

test('hit areas: options are at least 44px tall', () => {
  assert.match(bodyOf('.cmdk-opt'), /min-height:44px/);
});

test('stacking: the overlay sits above the drawer and the skip link', () => {
  assert.match(bodyOf('.cmdk-ovl'), /position:fixed;inset:0;z-index:19/);
});

test('phone: below 600px the bar is a full-height sheet', () => {
  assert.match(bodyOf('.cmdk-ovl', PHONE), /padding:0/);
  const sheet = bodyOf('.cmdk', PHONE);
  assert.match(sheet, /height:100dvh/);
  assert.match(sheet, /max-height:none/);
  assert.match(sheet, /border-radius:0/);
});

test('reduced motion: every animation and transition lives under no-preference', () => {
  const moving = SEC.filter((r) => !r.selectors[0].startsWith('@keyframes') && /(^|;)\s*(animation|transition)\s*:(?!\s*none)/.test(r.body));
  assert.ok(moving.length >= 3, 'the panel, the trigger and the caret move');
  assert.deepEqual(moving.filter((r) => r.media !== MOTION_OK).map((r) => r.selectors.join(',')), []);
  assert.equal(RAW.split('@media (prefers-reduced-motion:reduce)').length - 1, 2, 'no new reduce block: motion is opt-in instead');
});

test('tokens only: no hex, rgb or !important; every var() is a token', () => {
  const sec = section();
  assert.doesNotMatch(sec, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(sec, /rgba?\(/i);
  assert.doesNotMatch(sec, /!important/);
  const declared = new Set([...TOKENS_RAW.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1]));
  const unknown = [...new Set([...sec.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]))].filter((n) => !declared.has(n));
  assert.deepEqual(unknown, []);
});

test('no --text-3 on the glass panel; one accent: the Ask icon', () => {
  assert.doesNotMatch(section(), /--text-3/);
  const accent = SEC.filter((r) => /var\(--accent\b/.test(r.body)).map((r) => r.selectors.join(','));
  assert.deepEqual(accent, ['.cmdk-opt.ask>svg']);
});

test('contrast: --text-2 clears 4.5:1 on the panel catch-light, the selected row and the hover wash, every theme and mode', () => {
  assert.deepEqual(each((s) => ({
    'text-2 on panel': ratio(s.text2, s.panel),
    'text-2 on selected': ratio(s.text2, s.surface2),
    'text-2 on hover wash': ratio(s.text2, over(s.text1, 0.06, s.panel)),
    'text-1 on selected': ratio(s.text1, s.surface2),
  }), 4.5), []);
});

test('non-text contrast: the Ask icon and the error icon clear 3:1 where they sit', () => {
  assert.deepEqual(each((s) => ({
    'accent on panel': ratio(s.accent, s.panel),
    'accent on selected': ratio(s.accent, s.surface2),
    'danger on panel': ratio(s.danger, s.panel),
  }), 3), []);
});

// ---- three-column top bar ----
test('three-column top bar: a grid only when the bar holds a .searchbox', () => {
  const grid = bodyOf('.tbar:has(>.searchbox)');
  assert.match(grid, /display:grid/);
  const cols = grid.match(/grid-template-columns:([^;]+)/);
  assert.ok(cols, 'columns declared');
  assert.equal(splitSelectors(cols[1].replace(/\s+(?![^(]*\))/g, ',')).length, 3, 'three tracks');
  assert.match(bodyOf('.tbar:has(>.searchbox)>.searchbox'), /grid-column:2/);
  assert.match(bodyOf('.tbar:has(>.searchbox)>.tbar-end'), /grid-column:3/);
  assert.match(bodyOf('.tbar:has(>.searchbox)>.tbar-end'), /justify-self:end/);
});

test('three-column top bar: every other bar keeps the 1.3 flex layout', () => {
  const tbarRules = SEC.filter((r) => r.selectors.some((s) => /\.tbar\b/.test(s)));
  assert.ok(tbarRules.length >= 3);
  for (const r of tbarRules) for (const s of r.selectors) assert.match(s, /^\.tbar:has\(>\.searchbox\)/, `${s} must be scoped to a bar with a search`);
  assert.match(bodyOf('.tbar', null, ALL), /display:flex/, 'the base bar is still flex');
  const elsewhere = ALL.filter((r) => /display:grid/.test(r.body) && r.selectors.some((s) => /^(header)?\.tbar$/.test(s)));
  assert.deepEqual(elsewhere, [], 'no unscoped .tbar grid anywhere');
});

test('three-column top bar: the breadcrumb keeps its 150px floor, so the search shrinks before the page name clips', () => {
  assert.match(bodyOf('.tbar .crumbs', null, ALL), /min-width:150px/);
  assert.match(bodyOf('.tbar:has(>.searchbox)'), /grid-template-columns:minmax\(auto,1fr\) minmax\(0,360px\) minmax\(max-content,1fr\)/);
  assert.doesNotMatch(bodyOf('.tbar:has(>.searchbox)>.crumbs'), /min-width/);
});

test('three-column top bar: on phone the hidden breadcrumb leaves no empty track', () => {
  assert.match(bodyOf('.tbar .crumbs', PHONE, ALL), /display:none/, 'crumbs still hide under 600px');
  assert.match(bodyOf('.tbar:has(>.searchbox)', PHONE), /grid-template-columns:minmax\(0,1fr\) max-content/);
  assert.match(bodyOf('.tbar:has(>.searchbox)>.searchbox', PHONE), /grid-column:1/);
  assert.match(bodyOf('.tbar:has(>.searchbox)>.tbar-end', PHONE), /grid-column:2/);
});

test('phone close: a 44px Close button in the field row shows on the sheet; the esc chip goes', () => {
  assert.ok(sels.has('.cmdk-close'), '.cmdk-close rule');
  assert.match(bodyOf('.cmdk-close'), /display:none/, 'hidden above the phone sheet');
  assert.match(bodyOf('.cmdk-close', PHONE), /display:grid/);
  assert.match(bodyOf('.cmdk-close', PHONE), /width:44px;height:44px/);
  assert.match(bodyOf('.cmdk-field>.cmdk-kbd', PHONE), /display:none/);
});

test('three-column top bar: under 900px the search takes the free track', () => {
  assert.match(bodyOf('.tbar:has(>.searchbox)', '@media (max-width:899.98px)'), /grid-template-columns:minmax\(0,max-content\) minmax\(0,1fr\) max-content/);
});
