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
  // React.useState(, R.useState(, useId(, use(Ctx), a named hook import, and context creation.
  const hook = code.match(/\b\w+\.use[A-Z]\w*\s*[(<]/) ?? code.match(/(?<![.\w])use(?:[A-Z]\w*)?\s*[(<]/)
    ?? code.match(/import\s*\{[^}]*\buse(?:[A-Z]\w*)?\b[^}]*\}\s*from\s*['"]react['"]/)
    ?? code.match(/\bcreateContext\b/);
  if (hook) return `hook: ${hook[0].trim()}`;
  // Attached in JSX (onClick={...}), declared as a prop or handed on in an object (onSelect: ...),
  // passed in shorthand ({ onClick }), or bound by hand (addEventListener).
  const handler = code.match(/\son[A-Z]\w*=\{/) ?? code.match(/(?<![.\w])on[A-Z]\w*\??\s*:/)
    ?? code.match(/[{,]\s*on[A-Z]\w*\s*[,}]/) ?? code.match(/\baddEventListener\b/);
  if (handler) return `event handler: ${handler[0].trim()}`;
  const browser = code.match(/(?<![.\w])(?:window|document|localStorage|sessionStorage|navigator)\s*\.|\btypeof\s+(?:window|document)\b|\bmatchMedia\b/);
  if (browser) return `browser-only API: ${browser[0].trim()}`;
  return null;
}

const FN_INIT = /^(?:async\s+)?(?:function\b|(?:\([^]*?\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>|(?:React\.)?(?:forwardRef|memo|lazy)\b)/;
const fnName = (n) => /^[A-Z]/.test(n) || /^use[A-Z]/.test(n);

/* `a = 1, b = { c: [1, 2] }` split into [name, initializer] pairs, up to the statement's end. */
function declarators(code, from) {
  const parts = [];
  let depth = 0, quote = null, start = from, i = from;
  for (; i < code.length; i++) {
    const c = code[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (depth === 0 && c === ',') { parts.push(code.slice(start, i)); start = i + 1; }
    else if (depth === 0 && c === ';') break;
  }
  parts.push(code.slice(start, i));
  const out = [];
  for (const part of parts) {
    const m = part.match(/^\s*([A-Za-z_$][\w$]*)\s*(?::[^=]*?)?=(?!=|>)\s*([^]*)$/);
    if (m) out.push([m[1], m[2]]);
    else if (out.length) out[out.length - 1][1] += `,${part}`; // a comma inside <A, B>
  }
  return out;
}

/** Exported runtime values a client file defines that are neither a component nor a hook. */
export function clientValueExports(src) {
  const code = stripComments(src);
  const found = [];
  /* Every top-level binding the file declares: name -> true when it is a value to flag. */
  const local = new Map();
  for (const m of code.matchAll(/^(?:export\s+)?(?:declare\s+)?(?:const\s+)?(enum|class)\s+(\w+)/gm)) local.set(m[2], true);
  for (const m of code.matchAll(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+(\w+)/gm)) local.set(m[1], !fnName(m[1]));
  for (const m of code.matchAll(/^(export\s+)?(?:const|let|var)\s+(?!enum\b)/gm)) {
    for (const [name, init] of declarators(code, m.index + m[0].length)) {
      const bad = !(FN_INIT.test(init) && fnName(name));
      local.set(name, bad);
      if (m[1] && bad) found.push(name);
    }
  }
  for (const m of code.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?function\*?\s+(\w+)/gm)) if (local.get(m[1])) found.push(m[1]);
  for (const m of code.matchAll(/^export\s+(?:declare\s+)?(?:const\s+)?(?:enum|class)\s+(\w+)/gm)) found.push(m[1]);
  // export { A, B as C } with no `from`: flagged when the local name is a value declared here.
  for (const m of code.matchAll(/^export\s*\{([^}]*)\}(?!\s*from\b)/gm)) {
    for (const spec of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
      if (/^type\s/.test(spec)) continue;
      const [name, alias = name] = spec.split(/\s+as\s+/);
      if (local.get(name)) found.push(alias);
    }
  }
  // export default <expr>: fine for a function, a class component is not expected here.
  for (const m of code.matchAll(/^export\s+default\s+(?!(?:async\s+)?function\b)([^]*?);?\s*$/gm)) {
    const id = m[1].match(/^([A-Za-z_$][\w$]*)$/);
    if (id ? local.get(id[1]) !== false : !FN_INIT.test(m[1])) found.push('default');
  }
  return found;
}

test('the detector reads code, not comments', () => {
  assert.equal(clientReason("/** const t = useToast(); */\nexport const a = 1;\n"), null);
  assert.equal(clientReason("// onClick={() => go()}\nexport const a = 1;\n"), null);
  assert.equal(clientReason("const s = (globalThis as { localStorage?: Store }).localStorage;\n"), null);
  assert.equal(clientReason("export function B(p: P) { return <button {...p} />; }\n"), null);
  assert.match(clientReason("const [a] = React.useState(0);\n"), /^hook/);
  assert.match(clientReason("import * as R from 'react';\nconst [a] = R.useState(0);\n"), /^hook/);
  assert.match(clientReason("const v = use(Ctx);\n"), /^hook/);
  assert.match(clientReason("import { use } from 'react';\n"), /^hook/);
  assert.match(clientReason("import { createContext } from 'react';\nexport const C = createContext(null);\n"), /^hook/);
  assert.match(clientReason("export const C = React.createContext(null);\n"), /^hook/);
  assert.match(clientReason("return <button {...{ onClick }} />;\n"), /^event handler/);
  assert.match(clientReason("el.addEventListener('click', go);\n"), /^event handler/);
  assert.match(clientReason("const dark = matchMedia('(prefers-color-scheme: dark)').matches;\n"), /^browser-only/);
  assert.equal(clientReason("export function reuse(a: number) { return excuse(a); }\n"), null);
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

test('no client file defines an exported value that is not a component or a hook', () => {
  // A server component that imports such a value from a client module gets a client reference,
  // silently: spreading default labels yields nothing. Constants live in a pure module and the
  // client file re-exports them.
  assert.deepEqual(clientValueExports("'use client';\nexport const X_LABELS = { a: 'A' };\nexport const MAX = 3;\nexport function helper() {}\n"), ['X_LABELS', 'MAX', 'helper']);
  assert.deepEqual(clientValueExports("export const Button = React.forwardRef<HTMLButtonElement, P>((p, ref) => null);\nexport function HBars() {}\nexport function useToast() {}\nexport const useThing = () => 1;\nexport const Row = (p: P) => null;\nexport default function Page() {}\nexport type T = 1;\nexport interface P {}\n"), []);
  // A value is a value whatever its name looks like, and however it is exported.
  assert.deepEqual(clientValueExports("const DEFAULTS = { a: 1 };\nexport { DEFAULTS };\n"), ['DEFAULTS']);
  assert.deepEqual(clientValueExports("const DEFAULTS = { a: 1 };\nexport { DEFAULTS as Labels };\n"), ['Labels']);
  assert.deepEqual(clientValueExports("export const Labels = { a: 'A' };\n"), ['Labels']);
  assert.deepEqual(clientValueExports("export default { a: 1 };\n"), ['default']);
  assert.deepEqual(clientValueExports("const D = { a: 1 };\nexport default D;\n"), ['default']);
  assert.deepEqual(clientValueExports("export const Foo = 1, bar = 2;\n"), ['Foo', 'bar']);
  assert.deepEqual(clientValueExports("export const Foo = (p: P) => null, bar = { a: [1, 2], b: 'x,y' }, Baz = 3;\n"), ['bar', 'Baz']);
  assert.deepEqual(clientValueExports("export enum Tone { Ok, Err }\nexport const enum Size { S, M }\n"), ['Tone', 'Size']);
  assert.deepEqual(clientValueExports("export class Store {}\n"), ['Store']);
  // Re-exports of a pure module's names stay allowed, in either spelling, and so do components.
  assert.deepEqual(clientValueExports("export { X_LABELS, MAX } from './labels';\nexport * from './x-state';\nexport type { T } from './labels';\n"), []);
  assert.deepEqual(clientValueExports("import { X_LABELS } from './labels';\nexport { X_LABELS };\n"), []);
  assert.deepEqual(clientValueExports("function Part() { return null; }\nconst Row = () => null;\nexport { Part, Row };\nexport default Part;\n"), []);
  const found = [];
  for (const f of files) {
    const src = read(f);
    if (src.split('\n', 1)[0] !== DIRECTIVE) continue;
    for (const n of clientValueExports(src)) found.push(`react/${f}: ${n}`);
  }
  assert.deepEqual(found, [], 'move the value into a pure module (a *-state.ts or labels.ts) and re-export it');
});

test('the pure logic modules stay server-importable: cx and the state reducers have no directive', () => {
  for (const f of ['cx.ts', 'labels.ts', ...files.filter((x) => x.endsWith('-state.ts'))]) {
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
