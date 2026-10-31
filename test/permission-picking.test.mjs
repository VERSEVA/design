// 1.5.0 permission picking: neutral checkbox, picker row, search block, tag chip, centred table cells. Reads files only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(root, 'components.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (sel) => {
  const i = CSS.indexOf(`${sel}{`);
  assert.ok(i >= 0, `missing rule ${sel}`);
  return CSS.slice(i + sel.length + 1, CSS.indexOf('}', i));
};

test('table cells centre vertically', () => {
  assert.match(rule('.table th,.table td'), /vertical-align:middle/);
});
test('the checkbox and picker rows spend no accent (law 3 budget)', () => {
  for (const sel of ['.chk', '.chk:checked', '.pickrow', '.pickrow:has(.chk:checked)', '.tchip', '.tchip.on']) assert.doesNotMatch(rule(sel), /--accent/, sel);
  assert.match(rule('.chk:checked'), /background:var\(--text-1\)/);
});
test('picker rows are centred and at least 44px', () => {
  const row = rule('.pickrow');
  assert.match(row, /align-items:center/);
  assert.match(row, /min-height:44px/);
});
test('the search block spaces field and chips evenly and keeps chips on one line', () => {
  assert.match(rule('.searchblock'), /gap:var\(--s-3\)/);
  assert.match(rule('.searchblock'), /padding:var\(--s-4\)/);
  assert.match(rule('.searchblock .chiprow'), /flex-wrap:nowrap/);
});
test('the checkbox shows focus', () => {
  assert.match(rule('.chk:focus-visible'), /outline:2px solid var\(--focus\)/);
});
