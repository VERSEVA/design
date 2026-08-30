import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'verseva-gate.mjs');
const fx = (...p) => path.join(here, 'fixtures', ...p);
const shipped = ['--tokens', path.join(here, '..', 'tokens.css')];

function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

test('all four gates clean on a conforming file', () => {
  const r = run([...shipped, fx('proj-type', 'good.css')]);
  assert.equal(r.code, 0);
  assert.match(r.out, /all 4 gates clean/);
});

test('one failing gate fails the suite and names it', () => {
  const r = run([...shipped, fx('proj-seam', 'inline.html')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /gate failed: spacing/);
});

test('a failing gate prints its output exactly once', () => {
  const r = run([...shipped, fx('proj-seam', 'inline.html')]);
  assert.equal(r.out.split('SEAM LAW').length - 1, 1);
});

test('the shipped contract passes the full suite', () => {
  const r = run([...shipped, path.join(here, '..', 'components.css')]);
  assert.equal(r.code, 0);
});
