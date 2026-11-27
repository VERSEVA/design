// The document template (issue 199): templates/document.html, registered under blocks as a
// template and installed by `verseva add document` with tokens.css and components.css inlined.
// The served half lives in test/served/document.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classUse } from './class-names.test.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'verseva.mjs');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'registry.json'), 'utf8'));
const docFile = path.join(root, 'templates', 'document.html');
const html = () => fs.readFileSync(docFile, 'utf8');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-doc-'));
const cli = (args, cwd) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });

test('document is registered under blocks as a template, with no laws and no contract', () => {
  const doc = registry.blocks.find((b) => b.name === 'document');
  assert.ok(doc, 'registry.blocks has document');
  assert.equal(doc.kind, 'template');
  assert.equal(doc.file, 'templates/document.html');
  assert.equal(doc.assets, false);
  assert.equal('laws' in doc, false);
  assert.equal('contract' in doc, false);
  assert.ok(fs.existsSync(docFile));
});

test('one h1, four sections each opened by an h2, and no footer on the page', () => {
  const src = html();
  assert.equal((src.match(/<h1\b/g) ?? []).length, 1);
  const sections = [...src.matchAll(/<section class="doc-section"[^>]*>\s*<h2\b/g)];
  assert.equal(sections.length, 4);
  assert.doesNotMatch(src, /<footer\b/);
});

test('every number is labelled on a neutral badge and joined to its unit by a non-breaking space', () => {
  const src = html();
  const nums = (src.match(/<div class="num">/g) ?? []).length;
  const labels = (src.match(/class="badge neutral"[^>]*>(Fact|Estimate|Projection)</g) ?? []).length;
  assert.ok(nums > 0);
  assert.equal(labels, nums + (src.match(/class="glass doc-chart"/g) ?? []).length, 'one label per number and per chart');
  assert.doesNotMatch(src, /<span class="badge">/);
  assert.doesNotMatch(src, /\d <small>|<small> /, 'units sit after &nbsp;');
});

test('the chart spends the accent on one bar; the rest sit on the data ladder', () => {
  const src = html();
  const bars = (src.match(/<span class="htrack"><i\b/g) ?? []).length;
  const quiet = (src.match(/<span class="htrack"><i class="doc-quiet"/g) ?? []).length;
  assert.ok(bars >= 3);
  assert.equal(quiet, bars - 1);
});

test('the source links only the two package stylesheets, by relative path, and no font host', () => {
  const links = [...html().matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(links, ['<link rel="stylesheet" href="../tokens.css">', '<link rel="stylesheet" href="../components.css">']);
  assert.doesNotMatch(html(), /https?:\/\//);
});

test('the template adds only doc- classes, none a generic standalone name', () => {
  const style = [...html().matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const pkg = classUse(fs.readFileSync(path.join(root, 'components.css'), 'utf8'));
  const own = [...classUse(style).keys()].filter((n) => !pkg.has(n));
  assert.ok(own.length > 0);
  assert.deepEqual(own.filter((n) => !/^doc-/.test(n)), [], 'classes outside the doc- prefix');
});

test('verseva add document writes one file with the package CSS inlined and no link', () => {
  const cwd = tmp();
  const r = cli(['add', 'document', '--dir', 'docs'], cwd);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(fs.readdirSync(path.join(cwd, 'docs')), ['document.html']);
  const out = fs.readFileSync(path.join(cwd, 'docs', 'document.html'), 'utf8');
  assert.doesNotMatch(out, /<link\b/);
  assert.ok(out.includes(fs.readFileSync(path.join(root, 'tokens.css'), 'utf8').trim()), 'tokens.css verbatim');
  assert.ok(out.includes(fs.readFileSync(path.join(root, 'components.css'), 'utf8').trim()), 'components.css verbatim');
});

test('the add output passes the four gates and the recipe gate', () => {
  const cwd = tmp();
  assert.equal(cli(['add', 'document', '--dir', 'docs'], cwd).status, 0);
  const g = spawnSync(process.execPath, [path.join(root, 'bin', 'verseva-gate.mjs'), '--tokens', path.join(root, 'tokens.css'), path.join(cwd, 'docs')], { encoding: 'utf8' });
  assert.equal(g.status, 0, g.stdout + g.stderr);
  assert.match(g.stdout, /all 4 gates clean/);
  assert.match(g.stdout, /verseva-recipe-gate: clean/);
});

test('the committed site/r document item is the self-contained template', () => {
  const item = JSON.parse(fs.readFileSync(path.join(root, 'site', 'r', 'document.json'), 'utf8'));
  assert.equal(item.kind, 'template');
  assert.deepEqual(item.files.map((f) => f.path), ['document.html']);
  assert.doesNotMatch(item.files[0].content, /<link\b/);
  assert.match(item.files[0].content, /--accent:/);
});
