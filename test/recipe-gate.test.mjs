// Recipe gate, signal 1: contract-owned elements built by hand. Advisory by default,
// exit 1 only under --strict. The GREEN set is every shipped block and template.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { contractClasses, contractParts } from '../bin/contract-classes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const bin = path.join(root, 'bin', 'recipe-gate.mjs');
const fx = (...p) => path.join(here, 'fixtures', 'recipe', ...p);

/* Both streams, whatever the exit code: an advisory run reports findings and still exits 0. */
function run(args, cwd = root) {
  const r = spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', cwd });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}
const findings = (out) => out.split('\n').filter((l) => /^ {2}.+:\d+ {2}</.test(l));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-recipe-'));

/* ---- contract class set ---- */

test('the class set is parsed from components.css and holds every 1.5.0 class', () => {
  const classes = contractClasses();
  const baseline = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'classes-1.5.0.json'), 'utf8')).classes;
  const missing = baseline.filter((c) => !classes.has(c));
  assert.deepEqual(missing, []);
  for (const c of ['btn', 'btn-primary', 'field', 'table', 'modal', 'seg', 'searchbox', 'cmdk']) assert.ok(classes.has(c), c);
});

test('the class set holds no value fragment, at-rule word or comment word', () => {
  const classes = contractClasses();
  for (const c of classes) assert.match(c, /^[a-zA-Z_-][\w-]*$/, c);
  for (const c of ['5px', 'board', 'px-4', 'rounded-md', 'w-full']) assert.ok(!classes.has(c), c);
});

test('parent parts are read from the contract: the ticket floor plus every ".part <element>" rule', () => {
  const parts = contractParts();
  for (const c of ['seg', 'tabs', 'chips', 'menu', 'pick', 'switcher', 'field', 'sel', 'switch']) assert.ok(parts.any.has(c), c);
  assert.ok(parts.input.has('searchbox'));
  assert.ok(parts.button.has('tabbar'));
  assert.ok(parts.button.has('panel-hd'));
  assert.ok(!parts.input.has('tabbar'), 'a button part does not cover an input');
  assert.ok(!parts.button.has('error'), 'a state class compounded on a part is not a part');
});

/* ---- RED ---- */

test('RED: the utility classes in the fixture are not contract classes', () => {
  const classes = contractClasses();
  const used = [...fs.readFileSync(fx('red.html'), 'utf8').matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
  assert.ok(used.length > 0);
  assert.deepEqual(used.filter((c) => classes.has(c)), []);
});

test('RED: one finding per hand-built element, with file, line, element and contract section', () => {
  const r = run([fx('red.html')]);
  assert.equal(r.code, 0, 'advisory without --strict');
  const f = findings(r.out);
  assert.equal(f.length, 4, r.out);
  assert.match(f[0], /red\.html:3 {2}<button> {2}Button: \.btn$/);
  assert.match(f[1], /red\.html:4 {2}<table> {2}Table: \.table$/);
  assert.match(f[2], /red\.html:8 {2}<select> {2}Input \/ field: \.field$/);
  assert.match(f[3], /red\.html:9 {2}<dialog> {2}Modal: \.modal$/);
});

test('RED: --strict exits 1', () => {
  const r = run(['--strict', fx('red.html')]);
  assert.equal(r.code, 1);
  assert.equal(findings(r.out).length, 4);
});

test('roles count as the element: role button and role dialog, plus loose inputs', () => {
  const f = findings(run([fx('roles.html')]).out);
  assert.equal(f.length, 5, f.join('\n'));
  assert.match(f[0], /roles\.html:2 {2}<div role="button"> {2}Button: \.btn$/);
  assert.match(f[1], /roles\.html:3 {2}<div role="dialog"> {2}Modal: \.modal$/);
  assert.match(f[2], /roles\.html:6 {2}<input type="checkbox"> {2}Selection controls: \.sel, \.switch$/);
  assert.match(f[3], /roles\.html:7 {2}<input> {2}Input \/ field: \.field$/);
  assert.match(f[4], /roles\.html:8 {2}<textarea> {2}Input \/ field: \.field$/);
});

test('every section a finding can name is a heading in docs/component-contract.md', () => {
  const headings = fs.readFileSync(path.join(root, 'docs', 'component-contract.md'), 'utf8')
    .split('\n').filter((l) => l.startsWith('## ')).map((l) => l.replaceAll('`', ''));
  const out = [fx('red.html'), fx('roles.html')].map((p) => run([p]).out).join('\n');
  const named = new Set(findings(out).map((l) => l.split(/ {2}/).at(-1)));
  assert.equal(named.size, 5);
  for (const s of named) assert.ok(headings.some((h) => h.includes(s)), s);
});

/* ---- GREEN ---- */

test('GREEN: every block and template yields zero findings', () => {
  const files = ['blocks', 'templates'].flatMap((d) => fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith('.html')).map((f) => path.join(root, d, f)));
  assert.ok(files.length >= 7);
  for (const f of files) {
    const r = run(['--strict', f]);
    assert.equal(r.code, 0, `${path.basename(f)}\n${r.out}`);
  }
  const all = run(['--strict', path.join(root, 'blocks'), path.join(root, 'templates')]);
  assert.equal(all.code, 0, all.out);
  assert.match(all.out, /^verseva-recipe-gate: clean /);
});

test('GREEN: no block or template carries a recipe-ok marker', () => {
  for (const d of ['blocks', 'templates']) {
    for (const f of fs.readdirSync(path.join(root, d))) assert.ok(!fs.readFileSync(path.join(root, d, f), 'utf8').includes('recipe-ok'), f);
  }
});

test('contract classes, parent parts at any depth, hidden inputs, scripts and comments all pass', () => {
  const r = run(['--strict', fx('green.html')]);
  assert.equal(r.code, 0, r.out);
});

test('an unclosed cell does not lend its part to the next cell', () => {
  const f = findings(run([fx('stale-part.html')]).out);
  assert.equal(f.length, 1, f.join('\n'));
  assert.match(f[0], /stale-part\.html:4 {2}<input>/);
});

/* ---- marker ---- */

test('recipe-ok with a reason waives one element: on the line above, or inside the tag', () => {
  const f = findings(run([fx('marked.html')]).out);
  assert.equal(f.length, 3, f.join('\n'));
  assert.match(f[0], /marked\.html:8 {2}<dialog>/, 'an empty reason waives nothing');
  assert.match(f[1], /marked\.html:11 {2}<select>/, 'the marker reaches one line, not two');
  assert.match(f[2], /marked\.html:13 {2}<button>/, 'a marker inside a tag waives that tag only');
});

test('recipe-ok in jsx: a comment above the tag, or inside a multi-line tag', () => {
  const f = findings(run([fx('marked.tsx')]).out);
  assert.equal(f.length, 1, f.join('\n'));
  assert.match(f[0], /marked\.tsx:12 {2}<button>/);
});

/* ---- jsx ---- */

test('a multi-line jsx tag is read to its own closing bracket and reported at its first line', () => {
  const f = findings(run([fx('multiline.tsx')]).out);
  assert.equal(f.length, 1, f.join('\n'));
  assert.match(f[0], /multiline\.tsx:18 {2}<button> {2}Button: \.btn$/);
});

test('a comment opener inside a jsx string hides nothing, and a comment inside a tag is skipped', () => {
  const f = findings(run([fx('comments.tsx')]).out);
  assert.equal(f.length, 2, f.join('\n'));
  assert.match(f[0], /comments\.tsx:5 {2}<table>/);
  assert.match(f[1], /comments\.tsx:7 {2}<button>/);
});

test('a className with no string literal is unknown; one literal with a contract class passes', () => {
  const f = findings(run([fx('literals.tsx')]).out);
  assert.equal(f.length, 2, f.join('\n'));
  assert.match(f[0], /literals\.tsx:16 {2}<button>/, 'literals with no contract class are a finding');
  assert.match(f[1], /literals\.tsx:18 {2}<input>/, 'a capitalised wrapper is not followed');
});

/* ---- config ---- */

test('verseva.json: files under dir are known-good and recipeAllow skips by path substring', () => {
  const r = run(['--strict', '.'], fx('proj'));
  assert.equal(r.code, 1);
  const f = findings(r.out);
  assert.equal(f.length, 2, r.out);
  assert.deepEqual(f, [...f].sort(), 'files are walked in name order on every platform');
  assert.match(f[0], /src\/page\.html:3 {2}<dialog>/);
  assert.match(f[1], /ui-kit\/page\.html:1 {2}<select>/, 'dir matches on a path boundary');
});

test('without verseva.json the same tree reports every hand-built element', () => {
  const cwd = tmp();
  fs.cpSync(fx('proj'), cwd, { recursive: true });
  fs.rmSync(path.join(cwd, 'verseva.json'));
  assert.equal(findings(run(['.'], cwd).out).length, 4);
});

test('--allow skips files by path substring', () => {
  const r = run(['--strict', '--allow', 'red.', fx('red.html')]);
  assert.equal(r.code, 0, r.out);
});

test('a malformed verseva.json exits 2 with one line', () => {
  const cwd = tmp();
  fs.writeFileSync(path.join(cwd, 'verseva.json'), '{"dir": "x",}');
  const r = run([fx('red.html')], cwd);
  assert.equal(r.code, 2);
  assert.match(r.out, /^verseva-recipe-gate: verseva\.json is not valid JSON\n$/);
});

test('a recipeAllow that is not a list of strings exits 2', () => {
  const cwd = tmp();
  fs.writeFileSync(path.join(cwd, 'verseva.json'), '{"recipeAllow": "legacy"}');
  const r = run([fx('red.html')], cwd);
  assert.equal(r.code, 2);
  assert.match(r.out, /^verseva-recipe-gate: verseva\.json "recipeAllow" must be a list of strings\n$/);
});

/* ---- arguments ---- */

test('a missing scan path exits 2 with one line, no stack trace', () => {
  const r = run([fx('nope')]);
  assert.equal(r.code, 2);
  assert.match(r.out, /^verseva-recipe-gate: no such file: .*nope\n$/);
});

test('no path exits 2 with usage', () => {
  const r = run(['--strict']);
  assert.equal(r.code, 2);
  assert.match(r.out, /^usage: verseva-recipe-gate /);
});

test('a trailing --allow exits 2', () => {
  const r = run([fx('red.html'), '--allow']);
  assert.equal(r.code, 2);
  assert.match(r.out, /^verseva-recipe-gate: --allow needs a value\n$/);
});

test('a path with a leading dash is refused before the separator', () => {
  const r = run(['--strcit', fx('red.html')]);
  assert.equal(r.code, 2);
  assert.match(r.out, /^verseva-recipe-gate: unknown option: --strcit\n$/);
});

test('after -- every argument is a path, never a flag', () => {
  const cwd = tmp();
  fs.copyFileSync(fx('red.html'), path.join(cwd, '--strict'));
  const r = run(['--', '--strict'], cwd);
  assert.equal(r.code, 0, 'the file named --strict was scanned and --strict was not set');
  assert.equal(findings(r.out).length, 4);
});

test('the bin is registered in package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.bin['verseva-recipe-gate'], 'bin/recipe-gate.mjs');
});
