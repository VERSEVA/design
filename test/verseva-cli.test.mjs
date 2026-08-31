import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'verseva.mjs');

function run(args, cwd) {
  try {
    const stdout = execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8', cwd });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-cli-'));

test('list prints components and blocks', () => {
  const r = run(['list'], tmp());
  assert.equal(r.code, 0);
  assert.match(r.out, /button/);
  assert.match(r.out, /quote-tool/);
});

test('init writes verseva.json and a gate script', () => {
  const cwd = tmp();
  fs.writeFileSync(path.join(cwd, 'package.json'), '{}\n');
  const r = run(['init'], cwd);
  assert.equal(r.code, 0);
  assert.ok(fs.existsSync(path.join(cwd, 'verseva.json')));
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.gate, /verseva-gate/);
});

test('add copies the component plus its cx dep, and keeps existing files', () => {
  const cwd = tmp();
  const r = run(['add', 'button'], cwd);
  assert.equal(r.code, 0);
  const dir = path.join(cwd, 'src', 'components', 'verseva');
  assert.ok(fs.existsSync(path.join(dir, 'button.tsx')));
  assert.ok(fs.existsSync(path.join(dir, 'cx.ts')));
  const again = run(['add', 'button'], cwd);
  assert.equal(again.code, 0);
  assert.match(again.out, /kept/);
});

test('add respects --dir and verseva.json', () => {
  const cwd = tmp();
  fs.writeFileSync(path.join(cwd, 'verseva.json'), JSON.stringify({ dir: 'ui' }));
  run(['add', 'badge'], cwd);
  assert.ok(fs.existsSync(path.join(cwd, 'ui', 'badge.tsx')));
  run(['add', 'stat', '--dir', 'other'], cwd);
  assert.ok(fs.existsSync(path.join(cwd, 'other', 'stat.tsx')));
});

test('add of an unknown name exits 1 and points at list', () => {
  const r = run(['add', 'nope'], tmp());
  assert.equal(r.code, 1);
  assert.match(r.out, /verseva list/);
});

test('block add copies the page and rewrites css hrefs to node_modules', () => {
  const cwd = tmp();
  const r = run(['block', 'add', 'quote-tool'], cwd);
  assert.equal(r.code, 0);
  const html = fs.readFileSync(path.join(cwd, 'verseva-blocks', 'quote-tool.html'), 'utf8');
  assert.match(html, /node_modules\/@verseva\/design\/tokens\.css/);
  assert.doesNotMatch(html, /\.\.\/\.\.\/tokens\.css/);
});

test('asset-heavy blocks refuse with a pointer to the repo', () => {
  const r = run(['block', 'add', 'store'], tmp());
  assert.equal(r.code, 1);
  assert.match(r.out, /repo/);
});

test('blocks/ cannot drift from site/examples/ (byte-identical)', () => {
  for (const name of ['console', 'quote-tool', 'landing', 'three-hero']) {
    const a = fs.readFileSync(path.join(here, '..', 'blocks', `${name}.html`), 'utf8');
    const b = fs.readFileSync(path.join(here, '..', 'site', 'examples', `${name}.html`), 'utf8');
    assert.equal(a, b, `${name}.html drifted between blocks/ and site/examples/`);
  }
});

test('every registry component file exists in the package', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(here, '..', 'registry.json'), 'utf8'));
  for (const c of registry.components) {
    assert.ok(fs.existsSync(path.join(here, '..', c.file)), `${c.file} missing`);
  }
  for (const b of registry.blocks.filter((x) => !x.source)) {
    assert.ok(fs.existsSync(path.join(here, '..', b.file)), `${b.file} missing`);
  }
});
