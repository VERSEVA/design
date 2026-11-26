// Bounded section recipe (.bounded): rows past the cap are dropped for the default and for every
// data-cap from 1 to 12, an unknown data-cap keeps the default, and the recipe is tokens only,
// spends no accent and carries no motion. Reads components.css only; the rendered heights live
// in test/served/bounded.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = fs.readFileSync(path.join(root, 'components.css'), 'utf8');
const HEAD = "/* ---- Bounded section (contract: no section's height grows with its data) ----";
const start = RAW.indexOf(HEAD);
const BLOCK = RAW.slice(start, RAW.indexOf('/* ---- Badge', start)).replace(/\/\*[\s\S]*?\*\//g, '');

test('the bounded block is in components.css', () => {
  assert.ok(start > 0 && BLOCK.includes('.bounded-rows'));
});

test('the default drops rows past 5, and no data-cap outside 6 to 12 escapes it', () => {
  const m = BLOCK.match(/\.bounded:not\(([^)]*)\) \.bounded-rows>:nth-child\(n\+6\)/);
  assert.ok(m, 'default rule');
  assert.deepEqual(m[1].split(','), [6, 7, 8, 9, 10, 11, 12].map((n) => `[data-cap="${n}"]`));
});

test('every data-cap from 1 to 12 but the default has its own rule, and all of them hide', () => {
  for (const n of [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12]) {
    assert.ok(BLOCK.includes(`.bounded[data-cap="${n}"] .bounded-rows>:nth-child(n+${n + 1})`), `data-cap ${n}`);
  }
  assert.match(BLOCK, /\.bounded\[data-cap="12"\] \.bounded-rows>:nth-child\(n\+13\)\{display:none\}/);
});

test('tokens only, no accent, no motion; the count is quiet body text', () => {
  assert.doesNotMatch(BLOCK, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(BLOCK, /accent|transition|animation|font-family|text-transform|letter-spacing/);
  assert.match(BLOCK, /\.bounded-more\{[^}]*color:var\(--text-2\)/);
  for (const [, v] of BLOCK.matchAll(/(?:margin|gap|padding)[\w-]*:([^;}]+)/g)) {
    for (const part of v.trim().split(/\s+/)) assert.match(part, /^(0|auto|var\(--s-\d+\))$/, v);
  }
});
