// Issue 194: the chart fold and window words, and the privacy floor, are plain values. They live in
// react/labels.ts (pure, server-importable), never in the client file that draws them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
/* Code only: comments out, so doctrine prose may name the words. */
const code = (src) => src.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/* Every string and template literal, the one console.warn message aside (it quotes an example display). */
const literals = (src) => [...code(src).replace(/console\.warn\([^]*?\);/g, '').matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]);

test('viz.tsx holds no fold or window word and no floor number', () => {
  const src = read('react/viz.tsx');
  const found = literals(src).filter((l) => /\bOther\b|\(other\)|<5|\bLast\b|\bweeks?\b/i.test(l));
  assert.deepEqual(found, [], 'move the word into VIZ_LABELS in react/labels.ts');
  assert.doesNotMatch(code(src), /[<>]=?\s*5\b(?!\d|\.)/, 'compare against VIZ_FLOOR, not a literal 5');
});

test('the scan catches what it is for', () => {
  assert.equal(literals("const a = 'Other';").length, 1);
  assert.deepEqual(literals("console.warn(`x display: \"<5\".`);\nconst b = \"<5\";"), ['"<5"']);
  assert.match("if (total < 5) x();", /[<>]=?\s*5\b(?!\d|\.)/);
});

test('labels.ts names Other, the floor label, the window note and the floor', () => {
  const src = read('react/labels.ts');
  assert.match(src, /other: 'Other'/);
  assert.match(src, /floor: '<5'/);
  assert.match(src, /window: \(n\) => `Last \$\{n\}`/);
  assert.match(src, /export const VIZ_FLOOR = 5;/);
  assert.doesNotMatch(src, /^\s*['"]use client['"]/);
});
