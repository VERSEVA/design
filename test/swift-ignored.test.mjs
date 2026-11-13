import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const tokens = ['--tokens', path.join(root, 'tokens.css')];
const swiftFixture = path.join(root, 'swift', 'GateFixtures', 'WebGateBait.swift');
const baitFixture = path.join(root, 'swift', 'GateFixtures', 'web-gate-bait.html');
const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
const prefix = 'node bin/verseva-gate.mjs ';
const gateArgs = scripts.gate.slice(prefix.length).split(' ');
const walkers = ['hex-gate', 'spacing-gate', 'type-gate'];

// A consumer project: its own top-level swift/ and a nested x/swift/,
// each holding a copy of the bait.
const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-exclude-'));
const topBait = path.join(consumer, 'swift', 'bait.html');
const nestedBait = path.join(consumer, 'x', 'swift', 'bait.html');
for (const f of [topBait, nestedBait]) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.copyFileSync(baitFixture, f);
}
after(() => fs.rmSync(consumer, { recursive: true, force: true }));

function run(bin, args) {
  try {
    const stdout = execFileSync(process.execPath, [path.join(root, 'bin', `${bin}.mjs`), ...args], {
      encoding: 'utf8',
      cwd: root,
    });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

test('the swift fixture is in place with a raw hex and a raw size', () => {
  const swift = fs.readFileSync(swiftFixture, 'utf8');
  assert.match(swift, /#c0ffee/);
  assert.match(swift, /CGFloat = 13\b/);
  const bait = fs.readFileSync(baitFixture, 'utf8');
  assert.match(bait, /#c0ffee/);
  assert.match(bait, /margin-top: 13px/);
});

test('the gate scripts pass --exclude swift', () => {
  for (const name of ['gate', 'gate:studio']) assert.match(scripts[name], / --exclude swift /, name);
});

for (const gate of walkers) {
  test(`${gate}: the bait is live when pointed at directly`, () => {
    assert.equal(run(gate, [...tokens, baitFixture]).code, 1);
  });

  test(`${gate}: walking the repo with the gate script's arguments skips swift/`, () => {
    const r = run(gate, gateArgs);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /swift\//);
  });

  test(`${gate}: without --exclude, a consumer's swift/ folders are scanned at every depth`, () => {
    const r = run(gate, [...tokens, consumer]);
    assert.equal(r.code, 1);
    assert.ok(r.out.includes(topBait), r.out);
    assert.ok(r.out.includes(nestedBait), r.out);
  });

  test(`${gate}: --exclude swift drops only the top-level directory`, () => {
    const r = run(gate, [...tokens, '--exclude', 'swift', consumer]);
    assert.equal(r.code, 1);
    assert.ok(!r.out.includes(topBait), r.out);
    assert.ok(r.out.includes(nestedBait), r.out);
  });

  test(`${gate}: --exclude names a directory under the scan root, not a nested one`, () => {
    const r = run(gate, [...tokens, '--exclude', 'swift', path.join(consumer, 'swift')]);
    assert.equal(r.code, 1);
    assert.ok(r.out.includes(topBait), r.out);
  });

  test(`${gate}: a trailing --exclude is a usage error (exit 2)`, () => {
    assert.equal(run(gate, [...tokens, consumer, '--exclude']).code, 2);
  });
}

test('verseva-gate hands --exclude to the walking gates', () => {
  const without = run('verseva-gate', [...tokens, path.join(consumer, 'swift', '..')]);
  assert.equal(without.code, 1);
  assert.ok(without.out.includes(topBait), without.out);
  const withFlag = run('verseva-gate', [...tokens, '--exclude', 'swift', '--exclude', 'x', consumer]);
  assert.equal(withFlag.code, 0, withFlag.out);
  assert.equal(run('verseva-gate', [...tokens, consumer, '--exclude']).code, 2);
});

test('contrast-gate takes no scan paths, so swift/ cannot reach it', () => {
  assert.equal(run('contrast-gate', tokens).code, 0);
  assert.equal(run('contrast-gate', [...tokens, 'swift']).code, 2);
});

test('npm run gate passes with the swift fixture present', () => {
  assert.ok(scripts.gate.startsWith(prefix));
  const r = run('verseva-gate', gateArgs);
  assert.equal(r.code, 0, r.out);
});

test('the node test globs stay inside test/, never swift/', () => {
  for (const name of ['test', 'test:served']) {
    const globs = scripts[name].split(' ').filter((a) => a.includes('*'));
    assert.ok(globs.length > 0, name);
    for (const g of globs) assert.match(g, /^test\//, `${name}: ${g}`);
  }
});
