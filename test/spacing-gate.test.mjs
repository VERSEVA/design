import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'spacing-gate.mjs');
const fx = (...p) => path.join(here, 'fixtures', ...p);

function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

test('inline style spacing in html fails and names the line', () => {
  const r = run([fx('proj-seam', 'inline.html')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /inline\.html:2/);
});

test('class-level rhythm in a stylesheet block passes', () => {
  const r = run([fx('proj-seam', 'clean.html')]);
  assert.equal(r.code, 0);
});

test('sp-ok marker suppresses the line', () => {
  const r = run([fx('proj-seam', 'marked.html')]);
  assert.equal(r.code, 0);
});

test('jsx style-object spacing is caught', () => {
  const r = run([fx('proj-seam', 'jsx.tsx')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /jsx\.tsx/);
});

test('--allow skips the file', () => {
  const r = run(['--allow', 'proj-seam', fx('proj-seam')]);
  assert.equal(r.code, 0);
});

test('multi-line jsx style objects are caught (prettier formatting)', () => {
  const r = run([fx('proj-seam', 'multiline.tsx')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /multiline\.tsx/);
});

test('an attribute merely ending in "style" is not a violation', () => {
  const r = run([fx('proj-seam', 'boundary.html')]);
  assert.equal(r.code, 0);
});

test('the shipped contract css is clean', () => {
  const r = run([path.join(here, '..', 'components.css')]);
  assert.equal(r.code, 0);
});
