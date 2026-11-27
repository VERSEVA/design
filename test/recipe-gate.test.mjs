// Recipe gate. Signal 1: contract-owned elements built by hand. Signal 2: a material census, one
// project-level finding when nothing scanned consumes the signature material. Advisory by
// default, exit 1 only under --strict. The GREEN set is every shipped block and template.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { contractClasses, contractParts, materialClasses, materialSelectors, MATERIAL_RE, PART_FLOOR } from '../bin/contract-classes.mjs';

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
const census = (out) => out.split('\n').filter((l) => /^ {2}project {2}/.test(l));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-recipe-'));

/* ---- contract class set ---- */

test('the class set is parsed from components.css at run time', () => {
  const classes = contractClasses();
  assert.ok(classes.size > 200, `only ${classes.size} classes`);
  for (const c of ['btn', 'btn-primary', 'field', 'table', 'modal', 'seg', 'searchbox', 'cmdk']) assert.ok(classes.has(c), c);
  const css = path.join(tmp(), 'c.css');
  fs.writeFileSync(css, '/* .ghost */ .part-a{color:red} .part-a.mod-b, a.state-c{top:0} @media (min-width:1px){.part-d :is(.part-e, .part-f) > .part-g:not(.mod-h){top:0}} .mt-3{top:0}');
  assert.deepEqual([...contractClasses(css)].sort(), ['part-a', 'part-d', 'part-e', 'part-f', 'part-g']);
});

test('the class set holds no value fragment, at-rule word or comment word', () => {
  const classes = contractClasses();
  for (const c of classes) assert.match(c, /^[a-zA-Z_-][\w-]*$/, c);
  for (const c of ['5px', 'board', 'px-4', 'rounded-md', 'w-full']) assert.ok(!classes.has(c), c);
});

test('only root part classes count: modifiers, spacing utilities and sr-only are not in the set', () => {
  const classes = contractClasses();
  for (const c of ['sm', 'lg', 'two-line', 'active', 'on', 'error', 'gap-2', 'mt-2', 'mt-4', 'mb-4', 'pt-1', 'pb-9', 'sr-only']) assert.ok(!classes.has(c), c);
  for (const c of ['btn', 'btn-primary', 'menu-item', 'chk', 'sheet', 'drawer', 'pick', 'switch']) assert.ok(classes.has(c), c);
});

test('every hard-coded floor part is a class the contract ships', () => {
  const classes = contractClasses();
  const floor = Object.values(PART_FLOOR).flat();
  assert.ok(floor.length >= 10);
  assert.deepEqual(floor.filter((c) => !classes.has(c)), []);
  assert.ok(!floor.includes('tabs') && !floor.includes('chips'));
});

test('parent parts are keyed per element: the floor plus every ".part <element>" rule', () => {
  const parts = contractParts();
  assert.equal(parts.any, undefined, 'no part covers every element');
  for (const c of ['seg', 'menu', 'switcher', 'pick']) assert.ok(parts.button.has(c), c);
  for (const c of ['field', 'sel', 'pick', 'switch']) assert.ok(parts.input.has(c), c);
  assert.ok(parts.textarea.has('field') && parts.select.has('field'));
  assert.ok(!parts.button.has('field'), 'a field does not cover a button');
  assert.ok(!parts.input.has('seg') && !parts.input.has('menu'));
  assert.equal(parts.table.size + parts.dialog.size, 0);
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

test('RED: utility-built elements are reported even when a utility name is also a contract class', () => {
  const r = run(['--strict', fx('red-utilities.html')]);
  assert.equal(r.code, 1);
  const f = findings(r.out);
  assert.deepEqual(f.map((l) => l.match(/:(\d+) {2}(<[^>]+>)/).slice(1).join(' ')), [
    '2 <button>', '3 <button>', '4 <table>', '7 <select>', '8 <input>', '9 <button>', '10 <button>', '11 <input>',
  ], r.out);
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
    /* One file alone can hold no material; the census is judged over the whole set below. */
    const r = run([f]);
    assert.equal(r.code, 0, `${path.basename(f)}\n${r.out}`);
    assert.deepEqual(findings(r.out), [], `${path.basename(f)}\n${r.out}`);
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
  const r = run([fx('green.html')]);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(findings(r.out), [], r.out);
});

test('an unclosed cell does not lend its part to the next cell', () => {
  const f = findings(run([fx('stale-part.html')]).out);
  assert.equal(f.length, 1, f.join('\n'));
  assert.match(f[0], /stale-part\.html:4 {2}<input>/);
});

/* ---- material census (signal 2) ---- */

test('the material class set is derived from components.css: classes whose rules consume material', () => {
  const mat = materialClasses();
  for (const c of ['glass', 'navshell', 'navmain', 'cside', 'bulkbar', 'wtile', 'lact', 'cmdk', 'tab', 'snav']) assert.ok(mat.has(c), c);
  for (const c of ['btn', 'card', 'field', 'table', 'modal', 'on', 'active']) assert.ok(!mat.has(c), c);
  const roots = contractClasses();
  for (const c of mat) assert.ok(roots.has(c), `${c} is a root part class`);
});

test('material classes: --e-* does not count, a declaration is not consumption, nesting and :is() are read', () => {
  const css = path.join(tmp(), 'c.css');
  fs.writeFileSync(css, [
    '/* .ghost{background:var(--glass-fill-3)} */',
    '.elev{box-shadow:var(--e-1)}',
    '.pane{background:var(--glass-fill-3)}',
    '.inert{--glass-blur:0;--accent-bloom:none}',
    '.bare{color:var(--glass)}',
    '@media (min-width:1px){.rail .pill.on{border:1px solid var(--nav-frame)}}',
    '.wrap:is(.halo){background:var(--accent-bloom)}',
    '@keyframes k{from{opacity:0}to{opacity:1}}',
  ].join('\n'));
  assert.deepEqual([...materialClasses(css)].sort(), ['halo', 'pane', 'pill', 'rail', 'wrap']);
});

test('CENSUS: a project that consumes no material yields one project-level finding', () => {
  const r = run([fx('material', 'bare')]);
  assert.equal(r.code, 0, 'advisory without --strict');
  assert.deepEqual(findings(r.out), [], r.out);
  const c = census(r.out);
  assert.equal(c.length, 1, r.out);
  assert.match(c[0], /^ {2}project {2}no material consumed in 3 files {2}Glass panel: \.glass$/);
  const strict = run(['--strict', fx('material', 'bare')]);
  assert.equal(strict.code, 1);
  assert.doesNotMatch(strict.out, /clean/, 'a failing run never says clean');
  assert.match(strict.out, /^verseva-recipe-gate: no hand-built elements \(1 contract-owned element, /);
});

test('CENSUS: the same project with material "none" is skipped, and the output says so', () => {
  const cwd = tmp();
  fs.cpSync(fx('material', 'bare'), cwd, { recursive: true });
  fs.writeFileSync(path.join(cwd, 'verseva.json'), '{"material": "none"}');
  const r = run(['--strict', '.'], cwd);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(census(r.out), []);
  assert.match(r.out, /^verseva-recipe-gate: clean /);
  assert.match(r.out, /\nverseva-recipe-gate: material census skipped \(material: none\)\n$/);
});

test('CENSUS: material "full" is the default and runs the census', () => {
  const cwd = tmp();
  fs.cpSync(fx('material', 'bare'), cwd, { recursive: true });
  fs.writeFileSync(path.join(cwd, 'verseva.json'), '{"material": "full"}');
  assert.equal(census(run(['.'], cwd).out).length, 1);
});

test('CENSUS: each kind of consumption passes on its own', () => {
  const files = fs.readdirSync(fx('material', 'used'));
  assert.equal(files.length, 7);
  for (const f of files) {
    const r = run(['--strict', fx('material', 'used', f)]);
    assert.equal(r.code, 0, `${f}\n${r.out}`);
    assert.match(r.out, /\nverseva-recipe-gate: material census: \d+ uses? in 1 file\n$/, `${f}\n${r.out}`);
  }
});

test('CENSUS: a vendored components.css defines the material and does not count as consumption', () => {
  const r = run([fx('material', 'vendored')]);
  const c = census(r.out);
  assert.equal(c.length, 1, r.out);
  assert.match(c[0], /no material consumed in 2 files/);
});

test('CENSUS: only token names tokens.css defines count, not a project variable sharing the prefix', () => {
  const r = run([fx('material', 'own-nav')]);
  assert.equal(census(r.out).length, 1, r.out);
  for (const t of ['--nav-height', '--glass', '--glass-fill-9', '--accent-bloomish']) assert.doesNotMatch(`var(${t})`, MATERIAL_RE, t);
  for (const t of ['--nav-gap', '--glass-fill-3', '--accent-bloom', '--glass-inset']) assert.match(`var( ${t})`, MATERIAL_RE, t);
});

test('CENSUS: a class is credited only with the compound its material rule styles: .tab alone is not .tab.on', () => {
  assert.equal(census(run([fx('material', 'tab-only')]).out).length, 1);
  assert.equal(census(run([fx('material', 'used', 'tab.html')]).out).length, 0);
  assert.ok(materialSelectors().some((sel) => sel.length === 1 && sel[0].join('.') === 'tab.on'));
});

test('CENSUS: one consuming file anywhere passes the whole project', () => {
  const r = run(['--strict', fx('material', 'bare'), fx('material', 'used', 'var.css')]);
  assert.equal(r.code, 0, r.out);
});

test('CENSUS: files skipped by dir, recipeAllow or --allow do not count as consumption', () => {
  const cwd = tmp();
  fs.cpSync(fx('material', 'bare'), path.join(cwd, 'app'), { recursive: true });
  fs.cpSync(fx('material', 'used'), path.join(cwd, 'kit'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'verseva.json'), '{"dir": "kit"}');
  assert.equal(census(run(['.'], cwd).out).length, 1, 'a vendored kit under dir does not pass the project');
  fs.writeFileSync(path.join(cwd, 'verseva.json'), '{}');
  assert.equal(census(run(['--allow', 'kit/', '.'], cwd).out).length, 1);
  assert.equal(census(run(['.'], cwd).out).length, 0);
});

test('CENSUS: blocks/console.html passes on its own, and so do react/ and the block and template set', () => {
  for (const p of [['blocks/console.html'], ['react'], ['blocks', 'templates']]) {
    const r = run(['--strict', ...p.map((x) => path.join(root, x))]);
    /* react/ carries one signal-1 element finding that predates the census (a className passed by spread). */
    if (p[0] !== 'react') assert.equal(r.code, 0, `${p}\n${r.out}`);
    assert.deepEqual(census(r.out), [], `${p}\n${r.out}`);
    assert.match(r.out, /\nverseva-recipe-gate: material census: \d+ uses? in \d+ files?\n$/, `${p}\n${r.out}`);
  }
});

test('CENSUS: nothing scanned is not a finding', () => {
  const r = run(['--strict', '--allow', 'red.', fx('red.html')]);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(census(r.out), []);
});

test('an invalid material value exits 2 with one line', () => {
  for (const v of ['"partial"', 'true', '""', 'null']) {
    const cwd = tmp();
    fs.writeFileSync(path.join(cwd, 'verseva.json'), `{"material": ${v}}`);
    const r = run([fx('red.html')], cwd);
    assert.equal(r.code, 2, v);
    assert.match(r.out, /^verseva-recipe-gate: verseva\.json "material" must be "full" or "none"\n$/, v);
  }
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

test('jsx comments and string literals are not scanned for tags', () => {
  const f = findings(run([fx('comments-strings.tsx')]).out);
  assert.equal(f.length, 1, f.join('\n'));
  assert.match(f[0], /comments-strings\.tsx:15 {2}<table>/);
});

test('an unclosed comment inside a tag is read once, not once per tag', () => {
  const cwd = tmp();
  const body = '<a /*'.repeat(40_000);
  assert.ok(body.length >= 200_000);
  fs.writeFileSync(path.join(cwd, 'big.tsx'), body);
  const t0 = performance.now();
  const r = run(['big.tsx'], cwd);
  const ms = performance.now() - t0;
  assert.equal(r.code, 0, r.out);
  assert.ok(ms < 2000, `took ${Math.round(ms)}ms`);
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

/* ---- overlapping scan paths (issue 191 review) ---- */

test('overlapping scan paths are read once: each finding and each census file counts once', () => {
  const once = run([fx('red.html')]).out;
  for (const args of [[fx('red.html'), fx('red.html')], [fx(), fx('red.html')], [fx('red.html'), fx()]]) {
    const r = run(args);
    const f = findings(r.out);
    assert.equal(f.filter((l) => /red\.html:/.test(l)).length, findings(once).length, `${args}\n${r.out}`);
    assert.equal(new Set(f).size, f.length, `no finding repeats\n${r.out}`);
  }
  const files = (out) => Number(out.match(/material census: (?:\d+ uses? in |no material consumed in )?(\d+) files?/)?.[1] ?? out.match(/in (\d+) files?/)?.[1]);
  assert.equal(files(run([fx(), fx('red.html')]).out), files(run([fx()]).out));
});
