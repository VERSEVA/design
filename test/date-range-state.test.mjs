// Date range logic (react/date-range-state.ts) and the CSS the part adds. Node strips the types on import.
// The CSS block is the approved prototype's (plans/proto-1.8-studio-parts/proposed.css), rule for rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUSTOM_RANGE, DATE_RANGE_LABELS, isDate, dayText, rangeText, checkRange, snapRange, moveIndex, chosenPreset } from '../react/date-range-state.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'components.css'), 'utf8');

test('a date is a real calendar day written YYYY-MM-DD', () => {
  for (const ok of ['2026-11-29', '2024-02-29']) assert.equal(isDate(ok), true, ok);
  for (const bad of ['', '2026-2-9', '2026-02-30', '2026-13-01', '29/11/2026', null, undefined, 20261129]) assert.equal(isDate(bad), false, String(bad));
  /* a half-typed year is not a date: the field reads 0002 while the user is still typing 2026 */
  for (const bad of ['0002-11-02', '0202-11-02', '0999-12-31']) assert.equal(isDate(bad), false, bad);
  assert.equal(isDate('1000-01-01'), true);
});

test('the range line reads day and month, then the full end date, in UTC', () => {
  assert.equal(rangeText('2026-11-23', '2026-11-29'), '23 Nov to 29 Nov 2026');
  /* across a year end the start carries its own year, or the range reads backwards */
  assert.equal(rangeText('2025-12-29', '2026-01-04'), '29 Dec 2025 to 4 Jan 2026');
  assert.equal(rangeText('2025-12-01', '2026-11-29'), '1 Dec 2025 to 29 Nov 2026');
  assert.equal(rangeText('2025-11-23', '2026-11-29'), '23 Nov 2025 to 29 Nov 2026');
  assert.notEqual(rangeText('2025-11-23', '2026-11-29'), rangeText('2026-11-23', '2026-11-29'));
  assert.equal(rangeText('2026-01-01', '2026-12-31'), '1 Jan to 31 Dec 2026');
  assert.equal(dayText('2026-01-05'), '5 Jan 2026');
  assert.equal(rangeText('', 'soon'), ' to soon', 'what is not a date is left as written');
});

test('a custom range is two dates, the start not after the end, inside min and max', () => {
  assert.deepEqual(checkRange('2026-11-02', '2026-11-29'), { ok: true, errors: {} });
  assert.deepEqual(checkRange('2026-11-02', '2026-11-02'), { ok: true, errors: {} }, 'one day is a range');
  assert.deepEqual(checkRange('2026-11-16', '2026-11-08'), { ok: false, errors: { to: 'End is before start' } });
  assert.deepEqual(checkRange('', ''), { ok: false, errors: { from: 'Enter a start date', to: 'Enter an end date' } });
  assert.deepEqual(checkRange('2026-11-02', 'x'), { ok: false, errors: { to: 'Enter an end date' } });
  const lim = { min: '2026-01-05', max: '2026-11-29' };
  assert.deepEqual(checkRange('2026-01-05', '2026-11-29', lim), { ok: true, errors: {} });
  assert.deepEqual(checkRange('2025-12-29', '2026-12-06', lim), { ok: false, errors: { from: 'Earliest start is 5 Jan 2026', to: 'Latest end is 29 Nov 2026' } });
  /* a malformed limit is no limit */
  assert.deepEqual(checkRange('2026-11-02', '2026-11-29', { min: 'soon', max: '2026-13-40' }), { ok: true, errors: {} });
  assert.deepEqual(checkRange('2026-11-02', '2026-11-29', { min: '0002-01-01', max: '2026-11-08' }), { ok: false, errors: { to: 'Latest end is 8 Nov 2026' } });
  assert.deepEqual(checkRange('2026-11-16', '2026-11-08', { labels: { ...DATE_RANGE_LABELS, endBeforeStart: 'Fin avant le debut' } }).errors, { to: 'Fin avant le debut' });
});

test('a preset is chosen only when its name and both dates match the value; the first of two wins', () => {
  const presets = [{ value: '7', label: 'This week', from: '2026-11-23', to: '2026-11-29' }, { value: '28', label: '4 weeks', from: '2026-11-02', to: '2026-11-29' }, { value: '28', label: 'Again', from: '2026-11-02', to: '2026-11-29' }];
  assert.equal(chosenPreset(presets, { range: '7', from: '2026-11-23', to: '2026-11-29', compare: false }), 0);
  assert.equal(chosenPreset(presets, { range: '28', from: '2026-11-02', to: '2026-11-29', compare: true }), 1);
  assert.equal(chosenPreset(presets, { range: '7', from: '2026-11-16', to: '2026-11-22', compare: false }), -1, 'last week under the name of this week');
  assert.equal(chosenPreset(presets, { range: 'custom', from: '2026-11-23', to: '2026-11-29', compare: false }), -1);
  assert.equal(chosenPreset([], { range: '7', from: '2026-11-23', to: '2026-11-29', compare: false }), -1);
});

test('snapping is the host function, per edge, and leaves a half-typed date alone', () => {
  const snap = (d, edge) => `${d.slice(0, 8)}${edge === 'from' ? '01' : '28'}`;
  assert.deepEqual(snapRange('2026-11-04', '2026-11-11', snap), { from: '2026-11-01', to: '2026-11-28' });
  assert.deepEqual(snapRange('', '2026-11-11', snap), { from: '', to: '2026-11-28' });
  assert.deepEqual(snapRange('2026-11-04', '2026-11-11'), { from: '2026-11-04', to: '2026-11-11' });
});

test('arrows, Home and End move through a list, wrapping', () => {
  assert.deepEqual(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End', 'a'].map((k) => moveIndex(k, 0, 4)), [1, 1, 3, 3, 0, 3, null]);
  assert.equal(moveIndex('ArrowRight', 3, 4), 0);
  assert.equal(moveIndex('End', 0, 0), null);
  assert.equal(CUSTOM_RANGE, 'custom');
});

test('the module is pure: no directive, no hook, no handler, no browser global', () => {
  const src = fs.readFileSync(path.join(root, 'react/date-range-state.ts'), 'utf8');
  assert.doesNotMatch(src, /['"]use client['"]/);
  assert.doesNotMatch(src, /from\s+['"]react['"]|\bwindow\.|\bdocument\.|\bmatchMedia\b|(?<![.\w])on[A-Z]\w*\??\s*:/);
  const part = fs.readFileSync(path.join(root, 'react/date-range.tsx'), 'utf8');
  assert.equal(part.split('\n', 1)[0], "'use client';");
  assert.doesNotMatch(part, /location\b|history\b|URLSearchParams/, 'the part never reads or writes the URL');
  assert.doesNotMatch(part, /^export\s+(const|let|var|enum|class)\s/m, 'a client file exports components and types only');
});

test('components.css carries the prototype rules, rule for rule', () => {
  for (const rule of [
    '.range-ctl{display:flex;flex-wrap:wrap;align-items:flex-end;gap:var(--s-3)}',
    '.range-ctl>.metaline{align-self:center}',
    '.range-fields{display:flex;flex-wrap:wrap;gap:var(--s-3)}',
    '.range-fields[hidden]{display:none}',
    '.range-fields .field{flex:1 1 10rem;min-width:0}',
    '.range-ctl>.range-fields{flex:0 1 22rem}',
    '.range-fields .field input{width:100%}',
    '@media (max-width:559.98px){\n  .range-ctl>.range-fields{display:none}\n  .range-ctl>.seg{display:flex;width:100%}\n  .range-ctl>.seg button{flex:1;padding-inline:var(--s-2);white-space:nowrap}\n}',
    '@media (pointer:coarse){.range-ctl>.seg button{min-height:44px}}',
    '.seg button[aria-checked="true"]{background:var(--surface);color:var(--text-1);font-weight:600;box-shadow:var(--e-1)}',
    'dialog.sheet,dialog.modal{padding:0;color:var(--text-1);max-width:none;max-height:none}',
    'dialog.sheet{margin:auto auto var(--s-2)}',
    'dialog.modal{margin:auto}',
    '.fchip{font-family:inherit}',
    'dialog.sheet::backdrop,dialog.modal::backdrop{background:color-mix(in srgb,var(--bg) 45%,transparent)}',
  ]) assert.ok(css.includes(rule), rule);
  /* the radiogroup form looks exactly like the tablist form */
  const decl = (sel) => { const at = css.indexOf(`${sel}{`) + sel.length + 1; return css.slice(at, css.indexOf('}', at)); };
  assert.equal(decl('.seg button[aria-checked="true"]'), decl('.seg button[aria-selected="true"]'));
});

test('the part adds two classes, the wrapper and the custom-date row', () => {
  const block = css.slice(css.indexOf('/* ---- Date range (1.8)'));
  const added = new Set([...block.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.(range-[\w-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...added].sort(), ['range-ctl', 'range-fields']);
  assert.equal(css.slice(0, css.indexOf('/* ---- Date range (1.8)')).includes('range-ctl'), false);
});
