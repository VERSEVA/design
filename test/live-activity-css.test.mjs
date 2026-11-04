// Live activity recipes (1.6.0): every contract state, ring colors off the accent,
// tokens only, phone sheet, reduced motion, contrast in light and dark. Reads files only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const RAW = read('components.css');
const TOKENS_RAW = read('tokens.css');
const THEMES = ['cobalt', 'forest', 'slate', 'violet'];
const HEAD = '/* ---- Live activity (1.6.0): top bar capsule and its panel of jobs ---- */';

function section() {
  const a = RAW.indexOf(HEAD);
  assert.ok(a > -1, 'live activity section header missing');
  const b = RAW.indexOf('/* ---- ', a + HEAD.length);
  return RAW.slice(a, b === -1 ? undefined : b);
}

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

const RULES = parseRules(section());
const SELECTORS = new Set(RULES.flatMap((r) => r.selectors));
const bodyOf = (sel, media = null) => RULES.filter((r) => r.media === media && r.selectors.includes(sel)).map((r) => r.body).join(';');
const missing = (list) => list.filter((s) => !SELECTORS.has(s));
const RM = '@media (prefers-reduced-motion:reduce)';

test('placement: one live activity section', () => {
  assert.equal(RAW.split(HEAD).length, 2);
});

test('capsule: hover, open, focus-visible, press, disabled, loading, done, error and empty-hidden states', () => {
  assert.deepEqual(missing([
    '.lact', '.lact:hover', '.lact[aria-expanded="true"]', '.lact:focus-visible', '.lact:active', '.lact:disabled', '.lact[aria-disabled="true"]',
    '.lact[hidden]', '.lact-wrap[hidden]', '.lact[data-state="pending"] .lact-ring svg', '.lact[data-state="done"]', '.lact[data-state="error"]',
    '.lact[data-state="done"] .lact-ti', '.lact[data-state="error"] .lact-ti', '.lact-ring', '.lact-track', '.lact-arc', '.lact-tx', '.lact-name', '.lact-pc', '.lact-more',
  ]), []);
  assert.match(bodyOf('.lact:focus-visible'), /outline:2px solid var\(--focus\)/);
  assert.match(bodyOf('.lact:disabled'), /opacity:\.45/);
  assert.match(bodyOf('.lact[hidden]'), /display:none/);
});

test('panel: rows, step, bar, actions, error line, loading bar and the empty state', () => {
  assert.deepEqual(missing([
    '.menu-list.lact-panel', '.lact-list', '.lact-item', '.lact-top', '.lact-top b', '.lact-top svg', '.lact-step', '.lact-err', '.lact-bar', '.lact-bar i',
    '.lact-item[data-state="done"] .lact-bar i', '.lact-item[data-state="error"] .lact-bar i', '.lact-item[data-state="error"] .lact-err',
    '.lact-item[data-state="pending"] .lact-bar i', '.lact-acts', '.lact-panel .panel-empty',
  ]), []);
});

test('ring and bar: --text-1 while running, --success done, --danger error; no accent anywhere in the section', () => {
  assert.match(bodyOf('.lact-arc'), /stroke:var\(--text-1\)/);
  assert.match(bodyOf('.lact[data-state="done"] .lact-arc'), /stroke:var\(--success\)/);
  assert.match(bodyOf('.lact[data-state="error"] .lact-arc'), /stroke:var\(--danger\)/);
  assert.match(bodyOf('.lact-bar i'), /background:var\(--text-1\)/);
  assert.match(bodyOf('.lact-item[data-state="done"] .lact-bar i'), /background:var\(--success\)/);
  assert.match(bodyOf('.lact-item[data-state="error"] .lact-bar i'), /background:var\(--danger\)/);
  assert.doesNotMatch(section(), /--accent/);
});

test('motion: transform and opacity only for movement; the bar scales, never animates width', () => {
  const sec = section();
  assert.doesNotMatch(sec, /transition:[^;}]*\b(width|height|left|top|margin|padding)\b/);
  assert.match(bodyOf('.lact-bar i'), /transition:transform var\(--dur-3\)/);
  for (const r of RULES.filter((x) => x.selectors[0].startsWith('@keyframes'))) assert.doesNotMatch(r.body, /\b(width|left|top|margin)\s*:/, r.selectors[0]);
  for (const m of sec.matchAll(/(?:transition|animation):([^;}]+)/g)) assert.doesNotMatch(m[1], /\d+m?s\b(?![^(]*\))/, `durations come from tokens: ${m[1]}`);
});

test('reduced motion: transitions, the press and both loading animations are off, inside the section', () => {
  assert.match(bodyOf('.lact', RM), /transition:none/);
  assert.match(bodyOf('.lact-bar i', RM), /transition:none/);
  assert.match(bodyOf('.lact:active', RM), /transform:none/);
  assert.match(bodyOf('.lact[data-state="pending"] .lact-ring svg', RM), /animation:none/);
  assert.match(bodyOf('.lact-item[data-state="pending"] .lact-bar i', RM), /animation:none/);
});

test('phone: a bottom sheet under 900px that beats the notifications panel rule; 44px on touch; the name is read, not shown, under 600px', () => {
  const m900 = '@media (max-width:899.98px)';
  const sheet = bodyOf('.tbar .lact-wrap .menu-list.lact-panel', m900);
  assert.match(sheet, /position:fixed;top:auto;bottom:0;left:0;right:0;width:auto/);
  assert.match(sheet, /env\(safe-area-inset-bottom\)/);
  assert.ok(RAW.indexOf(HEAD) > RAW.indexOf('.tbar .menu .menu-list.panel{position:fixed'), 'the sheet rule follows the console shell rule it overrides');
  assert.match(bodyOf('.lact', '@media (pointer:coarse)'), /height:44px/);
  const hide = bodyOf('.lact-name', '@media (max-width:599.98px)');
  assert.match(hide, /clip-path:inset\(50%\)/);
  assert.doesNotMatch(hide, /display:\s*none/);
});

test('tokens only: every var() resolves; no hex, rgba or !important; no --text-3 text', () => {
  const declared = new Set([...TOKENS_RAW.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1]));
  const sec = section();
  const unknown = [...new Set([...sec.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]))].filter((n) => !declared.has(n));
  assert.deepEqual(unknown, []);
  assert.doesNotMatch(sec, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(sec, /rgba?\(/i);
  assert.doesNotMatch(sec, /!important/);
  assert.doesNotMatch(sec, /color:var\(--text-3\)/);
});

// ---- contrast ----
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
  let props = { ...base[':root'] };
  if (mode === 'light') props = { ...props, ...base['[data-theme="light"]'] };
  if (brand) {
    const b = blocks(read(`themes/${brand}.css`));
    props = { ...props, ...b[`[data-brand="${brand}"]`] };
    if (mode === 'light') props = { ...props, ...b[`[data-brand="${brand}"][data-theme="light"]`] };
  }
  return props;
}
function color(v) {
  const s = v.trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return { rgb: [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)), a: 1 };
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error(`unparsed color: ${v}`);
}
const over = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
const lin = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

function scene(mode, brand) {
  const p = themeProps(mode, brand);
  const solid = (name) => color(p[name]).rgb;
  const bg = solid('bg');
  const fill = color(p['glass-fill-3']);
  const glass = over(fill.rgb, fill.a, bg);
  const catchLight = +p['surface-body'].match(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)/)[1];
  return {
    capsule: over([255, 255, 255], catchLight, glass), surface2: solid('surface-2'),
    text1: solid('text-1'), text2: solid('text-2'), success: solid('success'), danger: solid('danger'),
  };
}

function check(pairs) {
  const fails = [];
  for (const brand of [null, ...THEMES]) for (const mode of ['dark', 'light']) {
    const s = scene(mode, brand);
    for (const [name, fg, bg, floor] of pairs(s)) {
      const r = ratio(fg, bg);
      if (r < floor) fails.push(`${brand ?? 'base'} ${mode} ${name}: ${r.toFixed(2)}`);
    }
  }
  return fails;
}

test('contrast, text: capsule name and percent on the worst-case catch-light; row text, step, error line and +n on --surface-2 (4.5:1)', () => {
  assert.deepEqual(check((s) => [
    ['capsule name --text-1', s.text1, s.capsule, 4.5],
    ['capsule percent --text-2', s.text2, s.capsule, 4.5],
    ['row name --text-1', s.text1, s.surface2, 4.5],
    ['step / +n --text-2', s.text2, s.surface2, 4.5],
  ]), []);
});

test('contrast, parts: the ring and icon (--text-1, --success, --danger) on the capsule and the bar on --surface-2 (3:1)', () => {
  assert.deepEqual(check((s) => [
    ['ring running', s.text1, s.capsule, 3], ['ring done', s.success, s.capsule, 3], ['ring error', s.danger, s.capsule, 3],
    ['bar running', s.text1, s.surface2, 3], ['bar done', s.success, s.surface2, 3], ['bar error', s.danger, s.surface2, 3],
  ]), []);
});
