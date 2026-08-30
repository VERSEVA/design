import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'contrast-gate.mjs');
const fx = (...p) => path.join(here, 'fixtures', ...p);
const shipped = path.join(here, '..', 'tokens.css');

function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

test('the shipped signature tokens clear every floor in both themes', () => {
  const r = run(['--tokens', shipped]);
  assert.equal(r.code, 0);
  assert.match(r.out, /clean \(\d+ pairs measured across 2 themes, 0 skipped\)/);
});

test('a dim text ladder fails and names pair, ratio, floor', () => {
  const r = run(['--tokens', fx('tokens-contrast-bad.css')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /text-2 on bg/);
  assert.match(r.out, /floor 4\.5/);
});

test('status text is measured against its tint composited over surface', () => {
  const r = run(['--tokens', fx('tokens-contrast-bad.css')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /success on success-bg\+surface/);
});

test('modern color syntax (space rgb, hsl, % and / alpha, var chain) measures and passes', () => {
  const r = run(['--tokens', fx('tokens-modern.css')]);
  assert.equal(r.code, 0);
  assert.match(r.out, /0 skipped/);
});

test('an unresolvable REQUIRED pair fails, never silently skips', () => {
  const r = run(['--tokens', fx('tokens-unresolvable.css')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /UNRESOLVABLE/);
});

test('brand theme blocks are measured as their own themes', () => {
  const r = run(['--tokens', shipped, '--tokens', fx('theme-brand-bad.css')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /acme/);
});

test('a tokens file contributing zero custom properties is a usage error', () => {
  const r = run(['--tokens', fx('proj-type', 'good.css')]);
  assert.equal(r.code, 2);
  assert.match(r.out, /zero custom properties/);
});

test('positional paths are rejected: this gate takes token files only', () => {
  const r = run(['--tokens', shipped, 'src']);
  assert.equal(r.code, 2);
});

test('no --tokens is a usage error', () => {
  const r = run([]);
  assert.equal(r.code, 2);
});
