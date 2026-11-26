// Bounded section recipe (.bounded): rows past the cap are dropped for the default and for every
// data-cap from 1 to 12, an unknown data-cap keeps the default, Show all is dropped below the cap
// unless data-all="always", and the recipe is tokens only, spends no accent and carries no motion. Reads components.css only; the rendered heights live
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

test('Show all is dropped below the cap, per cap, unless data-all="always"; apart from the cap rules', () => {
  const others = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12];
  assert.ok(BLOCK.includes(`.bounded:not([data-all="always"],${others.map((n) => `[data-cap="${n}"]`).join(',')}):not(:has(.bounded-rows>:nth-child(5))) .bounded-all`), 'default');
  for (const n of others) {
    assert.ok(BLOCK.includes(`.bounded[data-cap="${n}"]:not([data-all="always"]):not(:has(.bounded-rows>:nth-child(${n}))) .bounded-all`), `data-cap ${n}`);
  }
  /* a browser without :has drops a whole rule: the cap rule must not share one with :has */
  const rules = [...BLOCK.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => m[1]);
  for (const sel of rules.filter((r) => r.includes(':has('))) assert.doesNotMatch(sel, /nth-child\(n\+/, 'cap rule shares a rule with :has');
});

test('rows are divided on the top edge, lists and tables alike', () => {
  assert.ok(BLOCK.includes('.bounded-rows>.lrow,.bounded-rows>tr>td{border-bottom:0}'));
  assert.ok(BLOCK.includes('.bounded-rows>.lrow+.lrow,.bounded-rows>tr+tr>td{border-top:1px solid var(--hairline)}'));
});

test('count and action sit together on the trailing edge; 44px for a finger; one radius', () => {
  assert.match(BLOCK, /\.bounded-foot\{[^}]*justify-content:flex-end;gap:var\(--s-3\)\}/);
  assert.doesNotMatch(BLOCK, /margin-left/);
  assert.ok(BLOCK.includes('@media (pointer:coarse){.bounded-all{min-height:44px}}'));
  assert.ok(BLOCK.includes('.bounded .empty{border-radius:var(--r-md)}'));
  assert.match(BLOCK, /\.bounded-name\{[^}]*font-family:var\(--font-display\);font-weight:var\(--heading-weight\);font-size:1rem;color:var\(--text-1\)\}/);
});

test('tokens only, no accent, no motion; the count is quiet body text', () => {
  assert.doesNotMatch(BLOCK, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(BLOCK, /accent|transition|animation|text-transform|letter-spacing/);
  assert.deepEqual([...BLOCK.matchAll(/font-family:([^;}]+)/g)].map((m) => m[1]), ['var(--font-display)']);
  assert.match(BLOCK, /\.bounded-more\{[^}]*color:var\(--text-2\)/);
  assert.doesNotMatch(BLOCK.match(/\.bounded-more\{[^}]*\}/)[0], /font-family/);
  for (const [, v] of BLOCK.matchAll(/(?:margin|gap|padding)[\w-]*:([^;}]+)/g)) {
    for (const part of v.trim().split(/\s+/)) assert.match(part, /^(0|auto|var\(--s-\d+\))$/, v);
  }
});
