import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'type-gate.mjs');
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

test('an off-token font-family fails', () => {
  const r = run([...shipped, fx('proj-type', 'badfam.css')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /off-token font-family/);
});

test('a font-size below the contract floor fails and names the floor', () => {
  const r = run([...shipped, fx('proj-type', 'tiny.css')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /below 9\.5px floor/);
});

test('trio faces and on-floor sizes pass', () => {
  const r = run([...shipped, fx('proj-type', 'good.css')]);
  assert.equal(r.code, 0);
});

test('type-ok marker suppresses the line', () => {
  const r = run([...shipped, fx('proj-type', 'marked.css')]);
  assert.equal(r.code, 0);
});

test('the font: shorthand is caught on both face and size', () => {
  const r = run([...shipped, fx('proj-type', 'shorthand.css')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /off-token font shorthand/);
  assert.match(r.out, /8px below 9\.5px floor/);
});

test('the shipped contract css is clean, including its 9.5px navshell label', () => {
  const r = run([...shipped, path.join(here, '..', 'components.css')]);
  assert.equal(r.code, 0);
});

test('a missing scan path exits 2 with one line, no stack trace', () => {
  const r = run([...shipped, fx('nope')]);
  assert.equal(r.code, 2);
  assert.match(r.out, /^verseva-type-gate: no such file: .*nope\n$/);
});

test('a missing token file exits 2', () => {
  const r = run(['--tokens', fx('missing.css'), fx('proj-type', 'good.css')]);
  assert.equal(r.code, 2);
  assert.match(r.out, /^verseva-type-gate: no such file: .*missing\.css\n$/);
});

test('a trailing --tokens exits 2', () => {
  const r = run([fx('proj-type', 'good.css'), '--tokens']);
  assert.equal(r.code, 2);
  assert.match(r.out, /^verseva-type-gate: --tokens needs a value\n$/);
});
