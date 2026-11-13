import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const tokens = ['--tokens', path.join(root, 'tokens.css')];
const swiftFixture = path.join(root, 'swift', 'GateFixtures', 'WebGateBait.swift');
const baitFixture = path.join(root, 'swift', 'GateFixtures', 'web-gate-bait.html');
const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;

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

for (const gate of ['hex-gate', 'spacing-gate', 'type-gate']) {
  test(`${gate}: the bait is live when pointed at directly`, () => {
    assert.equal(run(gate, [...tokens, baitFixture]).code, 1);
  });

  test(`${gate}: walking the repo skips swift/`, () => {
    const r = run(gate, [...tokens, '.']);
    assert.doesNotMatch(r.out, /swift\//);
  });
}

test('contrast-gate takes no scan paths, so swift/ cannot reach it', () => {
  assert.equal(run('contrast-gate', tokens).code, 0);
  assert.equal(run('contrast-gate', [...tokens, 'swift']).code, 2);
});

test('npm run gate passes with the swift fixture present', () => {
  const prefix = 'node bin/verseva-gate.mjs ';
  assert.ok(scripts.gate.startsWith(prefix));
  const r = run('verseva-gate', scripts.gate.slice(prefix.length).split(' '));
  assert.equal(r.code, 0, r.out);
});

test('the node test globs stay inside test/, never swift/', () => {
  for (const name of ['test', 'test:served']) {
    const globs = scripts[name].split(' ').filter((a) => a.includes('*'));
    assert.ok(globs.length > 0, name);
    for (const g of globs) assert.match(g, /^test\//, `${name}: ${g}`);
  }
});
