// Widget recipes (1.6.0): grid and tile, every contract state, edit mode, smart stack,
// gallery, reduced motion, tokens only, and the accent budget (law 3: one accent per view).
// Reads files only. The rendered accent count lives in studio/test/widget-grid.test.tsx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = fs.readFileSync(path.join(root, 'components.css'), 'utf8');
const HEAD = '/* ---- Widgets (1.6.0): grid, tile, edit mode, smart stack, gallery ---- */';
const RM = '(prefers-reduced-motion:reduce)';

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

export function parseRules(src) {
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
        while (j < text.length && depth > 0) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
        const body = text.slice(i + 1, j - 1);
        if (/^@(media|supports|container)\b/.test(prelude)) walk(body, prelude.replace(/\s+/g, ''));
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
  assert.ok(a > -1, 'widgets section header missing');
  const b = RAW.indexOf('/* ---- ', a + HEAD.length);
  return RAW.slice(a, b > -1 ? b : undefined);
};
const SECTION = section();
const RULES = parseRules(SECTION);
const OUTSIDE = parseRules(RAW.replace(SECTION, ''));
/* Reduced motion: the section carries its own block (1.6.0 sections are self-contained). */
const rmBody = (sel) => parseRules(RAW).filter((r) => r.media === `@media${RM}` && r.selectors.includes(sel)).map((r) => r.body).join(';');
const SELECTORS = new Set(RULES.flatMap((r) => r.selectors));
const bodyOf = (sel, media = null) => RULES.filter((r) => r.media === media && r.selectors.includes(sel)).map((r) => r.body).join(';');
const has = (sel, media = null) => RULES.some((r) => r.media === media && r.selectors.includes(sel));
/** Accent-bearing values: the accent and its derivations, and the accent rungs of the data ladder. */
export const ACCENT = /var\(--(?:accent(?:-hover|-on|-bloom|-fill)?|data-[123])\s*[,)]/;

test('grid: 4 columns, 2 under 1100px, 1 under 560px, sparse flow', () => {
  const g = bodyOf('.wgrid');
  assert.match(g, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(g, /grid-auto-flow:row(;|$)/);
  assert.doesNotMatch(g, /dense/);
  assert.match(bodyOf('.wgrid', '@media(max-width:1099.98px)'), /repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(bodyOf('.wgrid', '@media(max-width:559.98px)'), /grid-template-columns:minmax\(0,1fr\)/);
});

test('tile sizes span S 1x1, M 2x1, L 2x2, XL 4x2, and clamp on narrow grids', () => {
  const spans = { s: [1, 1], m: [2, 1], l: [2, 2], xl: [4, 2] };
  for (const [s, [c, r]] of Object.entries(spans)) {
    const b = bodyOf(`.wtile[data-size="${s}"]`);
    assert.match(b, new RegExp(`grid-column:span ${c}`), s);
    assert.match(b, new RegExp(`grid-row:span ${r}`), s);
  }
  assert.match(bodyOf('.wtile[data-size="xl"]', '@media(max-width:1099.98px)'), /grid-column:span 2/);
  assert.match(bodyOf('.wtile[data-size]', '@media(max-width:559.98px)'), /grid-column:span 1/);
});

test('a forced column count (data-cols) drives the grid and the spans', () => {
  assert.match(bodyOf('.wgrid[data-cols="4"]'), /repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(bodyOf('.wgrid[data-cols="2"]'), /repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(bodyOf('.wgrid[data-cols="1"]'), /grid-template-columns:minmax\(0,1fr\)/);
  assert.match(bodyOf('.wgrid[data-cols="4"] .wtile[data-size="xl"]'), /grid-column:span 4/);
  assert.match(bodyOf('.wgrid[data-cols="2"] .wtile[data-size="xl"]'), /grid-column:span 2/);
  assert.match(bodyOf('.wgrid[data-cols="1"] .wtile[data-size]'), /grid-column:span 1;grid-row:span 1/);
});

test('smart stack leaves vertical gestures to the page and slides sideways', () => {
  assert.match(bodyOf('.wstack'), /touch-action:pan-y/);
  assert.match(bodyOf('.wstack-page[data-pos="next"]'), /translateX/);
});

test('tile is glass at --r-lg', () => {
  const t = bodyOf('.wtile');
  assert.match(t, /border-radius:var\(--r-lg\)/);
  assert.match(t, /var\(--glass-fill-3\)/);
  assert.match(t, /var\(--glass-border\)/);
});

test('tile ships every contract state', () => {
  const need = [
    '.wtile:hover', '.wtile:focus-visible', '.wgrid[data-editing] .wtile:active', '.wtile[aria-disabled="true"]',
    '.wtile[aria-busy="true"] .wtile-body', '.wtile-skel', '.wtile-err', '.wgrid-empty',
  ];
  assert.deepEqual(need.filter((s) => !SELECTORS.has(s)), []);
  assert.match(bodyOf('.wtile:focus-visible'), /outline:2px solid var\(--focus\)/);
  assert.match(bodyOf('.wtile[aria-disabled="true"]'), /opacity:\.45/);
});

const CONTROLS = ['.wtile-x', '.wtile-sizes button', '.wtile-move button', '.wtile-handle', '.wgrid-add', '.wstack-dot', '.wstack-pause', '.wstack-step', '.wgal-sizes button'];

test('every control has hover, focus-visible, press and disabled', () => {
  const miss = [];
  for (const c of CONTROLS) for (const st of [':hover', ':focus-visible', ':active', '[aria-disabled="true"]']) if (!SELECTORS.has(`${c}${st}`) && !SELECTORS.has(`${c}${st}::before`)) miss.push(`${c}${st}`);
  assert.deepEqual(miss, []);
});

test('every control is a 44px hit area', () => {
  for (const c of CONTROLS) {
    const b = bodyOf(c);
    const w = /(?:^|;)(?:min-)?width:44px/.test(b);
    const h = /(?:^|;)(?:min-)?height:44px/.test(b);
    assert.ok(w && h, `${c} needs 44px width and height: ${b}`);
  }
});

test('edit mode: jiggle is rotation only and stops under reduced motion', () => {
  assert.match(bodyOf('.wgrid[data-editing] .wtile'), /animation:wtile-jiggle/);
  const kf = RULES.find((r) => r.selectors[0] === '@keyframes wtile-jiggle');
  assert.ok(kf, 'jiggle keyframes missing');
  const props = [...kf.body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(props)], ['transform']);
  for (const m of kf.body.matchAll(/transform:([^;}]+)/g)) assert.match(m[1].trim(), /^rotate\([^)]*\)$/);
  assert.match(rmBody('.wgrid[data-editing] .wtile'), /animation:none/);
});

test('edit mode: content goes quiet, controls appear only while editing', () => {
  assert.match(bodyOf('.wgrid[data-editing] .wtile-body'), /pointer-events:none/);
  for (const c of ['.wtile-x', '.wtile-edit', '.wtile-handle']) {
    assert.match(bodyOf(c), /display:none/, c);
    assert.ok(has(`.wgrid[data-editing] ${c}`), `${c} shown in edit mode`);
  }
  assert.match(bodyOf('.wtile-handle'), /touch-action:none/);
  assert.match(bodyOf('.wtile[data-dragging]'), /opacity/);
});

test('smart stack: pages move by transform and opacity, stop under reduced motion', () => {
  const t = bodyOf('.wstack-page');
  const props = [...t.matchAll(/transition:([^;]+)/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().split(' ')[0]));
  assert.ok(props.length > 0);
  for (const p of props) assert.ok(['opacity', 'transform'].includes(p), p);
  assert.match(rmBody('.wstack-page'), /transition:none/);
  assert.match(bodyOf('.wstack-dot[aria-current="true"]::before'), /var\(--text-1\)/);
});

test('reduced motion also drops tile and control motion', () => {
  assert.match(rmBody('.wtile'), /transition:none/);
  for (const s of ['.wgrid[data-editing] .wtile:active', '.wgrid-add:active', '.wstack-pause:active']) assert.match(rmBody(s), /transform:none/, s);
});

test('tokens only: no hex, no raw durations, no --text-3 on glass', () => {
  const css = SECTION.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
  for (const m of css.matchAll(/(?:transition|animation)(?:-duration|-delay)?:([^;}]+)/g)) assert.doesNotMatch(m[1], /(?<![\w-])\d*\.?\d+m?s\b/, m[0]);
  assert.doesNotMatch(css, /--text-3/);
});

test('accent budget: in the widgets section only the focus widget may spend the accent', () => {
  const bad = RULES.filter((r) => ACCENT.test(r.body)).flatMap((r) => r.selectors).filter((s) => !s.includes('[data-focus]') || s.includes(':not([data-focus])'));
  assert.deepEqual(bad, []);
});

test('accent budget: every accent-bearing chart mark is neutralised outside the focus widget', () => {
  const VIZ = new Set(['bar', 'heat', 'stat', 'hbar', 'actstrip', 'actcal', 'ring', 'markstrip', 'vizlegend']);
  const outside = OUTSIDE.filter((r) => !r.selectors[0].startsWith('@') && ACCENT.test(r.body));
  const marks = outside.flatMap((r) => r.selectors.map((s) => ({ s, props: [...r.body.matchAll(/([a-z-]+):[^;]*var\(--(?:accent|data-[123])/g)].map((m) => m[1]) })))
    .filter(({ s }) => VIZ.has((s.match(/^\.([\w-]+)/) || [])[1]) && !/:hover|:focus/.test(s));
  assert.ok(marks.length >= 8, `found ${marks.length} viz marks`);
  const miss = [];
  for (const { s, props } of marks) {
    const n = bodyOf(`.wtile:not([data-focus]) ${s}`);
    if (!n) { miss.push(s); continue; }
    assert.doesNotMatch(n, ACCENT, s);
    for (const p of props) assert.match(n, new RegExp(`(^|;)${p}:`), `${s} ${p}`);
  }
  assert.deepEqual(miss, []);
  for (const attr of ['stroke', 'fill', 'stop-color']) {
    const n = bodyOf(`.wtile:not([data-focus]) [${attr}="var(--data-3)"]`);
    assert.match(n, new RegExp(`${attr}:var\\(--text-1\\)`), attr);
  }
});
