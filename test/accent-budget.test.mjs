// 1.4.0 accent budget (law 3) and the two new recipes. Reads files only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const CSS = read('components.css');
const TOKENS = read('tokens.css');
const rule = (sel) => {
  const i = CSS.indexOf(`${sel}{`);
  assert.ok(i >= 0, `missing rule ${sel}`);
  return CSS.slice(i + sel.length + 1, CSS.indexOf('}', i));
};

test('active glow is none in every mode', () => {
  const values = [...TOKENS.matchAll(/--accent-active-glow:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(values.length >= 2);
  for (const v of values) assert.equal(v, 'none');
});

test('pressed filter chip and hot counts spend no accent', () => {
  for (const sel of ['.fchip[aria-pressed="true"]', '.snav .cnt.hot']) assert.doesNotMatch(rule(sel), /--accent/, sel);
  assert.doesNotMatch(rule('.cside[data-collapsed] .snav .cnt.hot'), /--accent/);
});

test('two-line choice keeps a 44px hit area and a secondary line', () => {
  assert.match(rule('.sel.two-line'), /min-height:44px/);
  assert.match(rule('.sel.two-line .metaline'), /color:var\(--text-2\)/);
});

test('identity cell: name one line, email in text-2 that never truncates', () => {
  assert.match(rule('.table .ident b'), /white-space:nowrap/);
  const email = rule('.table .ident small');
  assert.match(email, /color:var\(--text-2\)/);
  assert.match(email, /overflow-wrap:anywhere/);
  assert.doesNotMatch(email, /ellipsis|nowrap/);
});
