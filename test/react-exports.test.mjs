// The React kit is importable from the package (`@verseva/design/react/<name>`, raw source), and
// every file in react/ that needs the client boundary says so on its first line. Both tests
// enumerate react/, so a new file has to comply: an export that resolves, and the directive when
// it calls a hook, attaches an event handler or reaches for a browser-only global.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const reactDir = path.join(root, 'react');
const files = fs.readdirSync(reactDir).filter((f) => /\.tsx?$/.test(f)).sort();
const read = (f) => fs.readFileSync(path.join(reactDir, f), 'utf8');
const stem = (f) => f.replace(/\.tsx?$/, '');

const DIRECTIVE = "'use client';";

/* Comments out, so a hook named in a doc comment or a handler in an example does not count. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/** Why a source needs the client boundary, or null when it is pure. */
export function clientReason(src) {
  const code = stripComments(src);
  const hook = code.match(/\bReact\.use[A-Z]\w*\s*[(<]/) ?? code.match(/(?<![.\w])use[A-Z]\w*\s*[(<]/)
    ?? code.match(/import\s*\{[^}]*\buse[A-Z]\w*[^}]*\}\s*from\s*['"]react['"]/);
  if (hook) return `hook: ${hook[0].trim()}`;
  // Attached in JSX (onClick={...}), declared as a prop or handed on in an object (onSelect: ...).
  const handler = code.match(/\son[A-Z]\w*=\{/) ?? code.match(/(?<![.\w])on[A-Z]\w*\??\s*:/);
  if (handler) return `event handler: ${handler[0].trim()}`;
  const browser = code.match(/(?<![.\w])(?:window|document|localStorage|sessionStorage|navigator)\s*\.|\btypeof\s+(?:window|document)\b/);
  if (browser) return `browser-only API: ${browser[0].trim()}`;
  return null;
}

test('the detector reads code, not comments', () => {
  assert.equal(clientReason("/** const t = useToast(); */\nexport const a = 1;\n"), null);
  assert.equal(clientReason("// onClick={() => go()}\nexport const a = 1;\n"), null);
  assert.equal(clientReason("const s = (globalThis as { localStorage?: Store }).localStorage;\n"), null);
  assert.equal(clientReason("export function B(p: P) { return <button {...p} />; }\n"), null);
  assert.match(clientReason("const [a] = React.useState(0);\n"), /^hook/);
  assert.match(clientReason("import { useState } from 'react';\n"), /^hook/);
  assert.match(clientReason("const id = useId();\n"), /^hook/);
  assert.match(clientReason("return <a href=\"https://x.test\" onClick={go} />;\n"), /^event handler/);
  assert.match(clientReason("interface P { onSwitch: (id: string) => void }\n"), /^event handler/);
  assert.match(clientReason("items.push({ id, onSelect: onCreate });\n"), /^event handler/);
  assert.match(clientReason("const raw = localStorage.getItem(k);\n"), /^browser-only/);
  assert.match(clientReason("const ok = typeof window !== 'undefined';\n"), /^browser-only/);
});

test('every stateful file in react/ starts with the client directive; pure files carry none', () => {
  assert.ok(files.length > 0);
  const missing = [];
  const extra = [];
  for (const f of files) {
    const src = read(f);
    const has = src.split('\n', 1)[0] === DIRECTIVE;
    const why = clientReason(src);
    if (why && !has) missing.push(`react/${f} (${why})`);
    if (!why && has) extra.push(`react/${f}`);
  }
  assert.deepEqual(missing, [], `first line must be ${DIRECTIVE}`);
  assert.deepEqual(extra, [], `no hook, handler or browser API found, so server code may import these; drop ${DIRECTIVE}`);
});

test('the pure logic modules stay server-importable: cx and the state reducers have no directive', () => {
  for (const f of ['cx.ts', ...files.filter((x) => x.endsWith('-state.ts'))]) {
    assert.ok(files.includes(f), `react/${f} exists`);
    assert.equal(clientReason(read(f)), null, `react/${f} is pure`);
    assert.doesNotMatch(read(f), /^\s*['"]use client['"]/);
  }
});

test('exports: every file in react/ resolves as @verseva/design/react/<name>, and every react export has a file', () => {
  const require = createRequire(path.join(root, 'package.json'));
  assert.equal(new Set(files.map(stem)).size, files.length, 'no two react files share a name');
  for (const f of files) {
    const spec = `${pkg.name}/react/${stem(f)}`;
    let resolved;
    assert.doesNotThrow(() => { resolved = require.resolve(spec); }, `${spec} does not resolve`);
    assert.equal(resolved, fs.realpathSync(path.join(reactDir, f)), `${spec} resolves to react/${f}`);
    assert.ok(fs.existsSync(resolved));
  }
  const keys = Object.keys(pkg.exports).filter((k) => k.startsWith('./react/'));
  assert.ok(keys.includes('./react/*'), 'the pattern export covers new .tsx parts');
  assert.equal(pkg.exports['./react/*'], './react/*.tsx');
  for (const k of keys.filter((x) => !x.includes('*'))) {
    assert.ok(fs.existsSync(path.join(root, pkg.exports[k])), `${k} points at a missing file: ${pkg.exports[k]}`);
  }
});

test('the directive survives the copy: verseva add, and the hosted registry items', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'registry.json'), 'utf8'));
  const parts = registry.components.filter((c) => c.file.startsWith('react/'));
  const stateful = parts.filter((c) => clientReason(fs.readFileSync(path.join(root, c.file), 'utf8')));
  assert.ok(stateful.length > 0);
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vsv-directive-'));
  try {
    fs.writeFileSync(path.join(cwd, 'package.json'), '{"name":"app","private":true}\n');
    const r = spawnSync(process.execPath, [path.join(root, 'bin', 'verseva.mjs'), 'add', ...parts.map((c) => c.name)], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    for (const c of parts) {
      const copied = fs.readFileSync(path.join(cwd, 'src/components/verseva', path.basename(c.file)), 'utf8');
      assert.equal(copied, fs.readFileSync(path.join(root, c.file), 'utf8'), `${c.name} is copied byte for byte`);
    }
    for (const c of stateful) {
      const copied = fs.readFileSync(path.join(cwd, 'src/components/verseva', path.basename(c.file)), 'utf8');
      assert.ok(copied.startsWith(`${DIRECTIVE}\n`), `${c.name}: copied file starts with the directive`);
      const item = JSON.parse(fs.readFileSync(path.join(root, 'site/r', `${c.name}.json`), 'utf8'));
      assert.ok(item.files[0].content.startsWith(`${DIRECTIVE}\n`), `site/r/${c.name}.json starts with the directive`);
    }
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});
