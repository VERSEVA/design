// The package installs into a React 17 project (a CSS-only consumer must never hit ERESOLVE),
// and `verseva add` warns, in one line, when it copies React parts into a project whose
// installed react is below 18. The parts need React 18+; the CSS needs no React at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'verseva.mjs');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('npm pack, then install into a react@17.0.2 project: no ERESOLVE', { timeout: 180000 }, () => {
  const packDir = tmp('vsv-pack-');
  const app = tmp('vsv-r17-');
  try {
    const pack = spawnSync(npm, ['pack', '--silent', '--pack-destination', packDir], { cwd: root, encoding: 'utf8' });
    assert.equal(pack.status, 0, pack.stderr);
    const tgz = path.join(packDir, fs.readdirSync(packDir).find((f) => f.endsWith('.tgz')));
    fs.copyFileSync(path.join(root, 'test/fixtures/react17-consumer/package.json'), path.join(app, 'package.json'));
    const inst = spawnSync(npm, ['install', '--no-audit', '--no-fund', '--prefer-offline', tgz], { cwd: app, encoding: 'utf8' });
    assert.doesNotMatch(inst.stderr, /ERESOLVE/, inst.stderr);
    assert.equal(inst.status, 0, inst.stderr);
    assert.equal(JSON.parse(fs.readFileSync(path.join(app, 'node_modules/react/package.json'), 'utf8')).version, '17.0.2');
    assert.ok(fs.existsSync(path.join(app, 'node_modules/@verseva/design/tokens.css')));
  } finally {
    fs.rmSync(packDir, { recursive: true, force: true });
    fs.rmSync(app, { recursive: true, force: true });
  }
});

test('package.json declares no react peer (the exports are CSS and the preset; add copies source)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.peerDependencies?.react, undefined);
  assert.equal(pkg.peerDependenciesMeta?.react, undefined);
});

/* A project with node_modules/react at `version` (null: no react installed). */
function project(version) {
  const cwd = tmp('vsv-add-');
  fs.writeFileSync(path.join(cwd, 'package.json'), '{"name":"app","private":true}\n');
  if (version) {
    fs.mkdirSync(path.join(cwd, 'node_modules/react'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'node_modules/react/package.json'), JSON.stringify({ name: 'react', version, main: 'index.js' }));
    fs.writeFileSync(path.join(cwd, 'node_modules/react/index.js'), '');
  }
  return cwd;
}
const add = (cwd, ...names) => spawnSync(process.execPath, [bin, 'add', ...names], { cwd, encoding: 'utf8' });
const WARN = /^verseva: react 17\.0\.2 is installed; the React parts need React 18 or later\.$/m;

test('add warns once, in one line, when installed react is below 18', () => {
  const cwd = project('17.0.2');
  try {
    const r = add(cwd, 'widget-grid', 'button');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, WARN);
    assert.equal(r.stderr.split('\n').filter((l) => l.includes('need React 18')).length, 1);
    assert.ok(fs.existsSync(path.join(cwd, 'src/components/verseva/widget-grid.tsx')), 'the parts are still copied');
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('add does not warn on react 18 or 19, with no react installed, or for parts without React', () => {
  for (const [v, names] of [['18.3.1', ['widget-grid']], ['19.2.0', ['widget-grid']], [null, ['button']], ['17.0.2', ['cx']]]) {
    const cwd = project(v);
    try {
      const r = add(cwd, ...names);
      assert.equal(r.status, 0, r.stderr);
      assert.doesNotMatch(r.stderr, /need React 18/, `${v} ${names}`);
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
  }
});
