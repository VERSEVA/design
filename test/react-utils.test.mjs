// Small React utilities (react/cx.ts, react/inert-for.ts). Node strips the types on import.
// inertFor lives in react/inert-for.ts so it imports without 'react', which the root does not install.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cx } from '../react/cx.ts';
import { inertFor } from '../react/inert-for.ts';

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

describe('inertFor', () => {
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
