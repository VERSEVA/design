// Small React utilities (react/cx.ts, react/inert.ts). Node strips the types on import.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cx } from '../react/cx.ts';

// react/inert.ts imports 'react', which the root package does not install.
// When it cannot be resolved, the inertFor tests skip with that reason instead of failing.
let inertFor;
let inertSkip = false;
try {
  ({ inertFor } = await import('../react/inert.ts'));
} catch (err) {
  inertSkip = `react/inert.ts not importable by the root test runner (${err.code ?? err.message})`;
}

describe('cx', () => {
  test('joins strings with a space', () => {
    assert.equal(cx('a', 'b', 'c'), 'a b c');
  });
  test('drops false, null, undefined and empty strings', () => {
    assert.equal(cx('a', false, null, undefined, '', 'b'), 'a b');
  });
  test('returns an empty string for no args', () => {
    assert.equal(cx(), '');
  });
});

describe('inertFor', { skip: inertSkip }, () => {
  test('off returns no props', () => {
    assert.deepEqual(inertFor('18.3.1', false), {});
    assert.deepEqual(inertFor('19.0.0', false), {});
  });
  test('React 18 gets an empty string', () => {
    assert.deepEqual(inertFor('18.3.1', true), { inert: '' });
  });
  test('React 19 gets a boolean', () => {
    assert.deepEqual(inertFor('19.0.0', true), { inert: true });
  });
});
