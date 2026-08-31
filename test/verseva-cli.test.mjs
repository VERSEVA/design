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

test('theme add copies a gate-proven preset with usage guidance', () => {
  const cwd = tmp();
  const r = run(['theme', 'add', 'cobalt'], cwd);
  assert.equal(r.code, 0);
  const css = fs.readFileSync(path.join(cwd, 'verseva-themes', 'cobalt.css'), 'utf8');
  assert.match(css, /\[data-brand="cobalt"\]/);
  assert.match(r.out, /contrast-gate/);
});

test('build flattens the registry into hostable per-item json with content', () => {
  const cwd = tmp();
  const out = path.join(cwd, 'r');
  const r = run(['build', '--output', out], cwd);
  assert.equal(r.code, 0);
  const button = JSON.parse(fs.readFileSync(path.join(out, 'button.json'), 'utf8'));
  assert.equal(button.name, 'button');
  assert.match(button.files[0].content, /forwardRef/);
  assert.ok(fs.existsSync(path.join(out, 'quote-tool.json')));
  assert.ok(fs.existsSync(path.join(out, 'cobalt.json')));
  assert.ok(fs.existsSync(path.join(out, 'registry.json')));
});

test('add installs a local .json registry item, flattening paths to basenames', () => {
  const cwd = tmp();
  fs.writeFileSync(path.join(cwd, 'thing.json'), JSON.stringify({
    name: 'thing', kind: 'component', deps: [],
    files: [{ path: '../../evil/thing.tsx', content: '// thing source' }],
  }));
  const r = run(['add', './thing.json'], cwd);
  assert.equal(r.code, 0);
  const dest = path.join(cwd, 'src', 'components', 'verseva', 'thing.tsx');
  assert.ok(fs.existsSync(dest), 'file written inside the target dir despite traversal path');
  assert.ok(!fs.existsSync(path.join(cwd, 'evil')), 'no traversal outside the target dir');
});

test('mcp init writes the claude .mcp.json wiring', () => {
  const cwd = tmp();
  const r = run(['mcp', 'init'], cwd);
  assert.equal(r.code, 0);
  const cfg = JSON.parse(fs.readFileSync(path.join(cwd, '.mcp.json'), 'utf8'));
  assert.equal(cfg.mcpServers.verseva.command, 'npx');
  assert.ok(cfg.mcpServers.verseva.args.includes('verseva-mcp'));
});

test('a fetched/file item without embedded content is refused (no host-file read)', () => {
  const cwd = tmp();
  fs.writeFileSync(path.join(cwd, 'leak.json'), JSON.stringify({
    name: 'leak', kind: 'component', deps: [],
    files: [{ path: '../../../../etc/hosts.ts' }],
  }));
  const r = run(['add', './leak.json'], cwd);
  assert.equal(r.code, 1);
  assert.match(r.out, /embed content/);
});

test('non-installable extensions are refused', () => {
  const cwd = tmp();
  fs.writeFileSync(path.join(cwd, 'sh.json'), JSON.stringify({
    name: 'sh', kind: 'component', deps: [],
    files: [{ path: 'evil.sh', content: 'echo pwned' }],
  }));
  const r = run(['add', './sh.json'], cwd);
  assert.equal(r.code, 1);
  assert.match(r.out, /not an installable type/);
});

test('a symlink destination is refused even with --force', () => {
  const cwd = tmp();
  const dir = path.join(cwd, 'src', 'components', 'verseva');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(cwd, 'precious.txt'), 'do not clobber');
  fs.symlinkSync(path.join(cwd, 'precious.txt'), path.join(dir, 'badge.tsx'));
  const r = run(['add', 'badge', '--force'], cwd);
  assert.equal(r.code, 1);
  assert.match(r.out, /symlink/);
  assert.equal(fs.readFileSync(path.join(cwd, 'precious.txt'), 'utf8'), 'do not clobber');
});

test('build with no --output writes to ./r in the project, never into the package', () => {
  const cwd = tmp();
  const r = run(['build'], cwd);
  assert.equal(r.code, 0);
  assert.ok(fs.existsSync(path.join(cwd, 'r', 'button.json')));
});

test('the committed site/r registry cannot drift from the sources', () => {
  const root = path.join(here, '..');
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'registry.json'), 'utf8'));
  for (const c of registry.components) {
    const built = JSON.parse(fs.readFileSync(path.join(root, 'site', 'r', `${c.name}.json`), 'utf8'));
    const source = fs.readFileSync(path.join(root, c.file), 'utf8');
    assert.equal(built.files[0].content, source, `site/r/${c.name}.json drifted from ${c.file}`);
  }
  assert.equal(
    fs.readFileSync(path.join(root, 'site', 'r', 'registry.json'), 'utf8'),
    JSON.stringify(registry, null, 2) + '\n',
    'site/r/registry.json drifted'
  );
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
