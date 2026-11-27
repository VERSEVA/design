// The deck template (issue 198): templates/deck.html, registered under blocks as a template,
// and the add fallback that installs it as one self-contained file (tokens.css and
// components.css inlined where the links stood). The served half lives in test/served/deck.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classUse } from './class-names.test.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'verseva.mjs');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'registry.json'), 'utf8'));
const deckFile = path.join(root, 'templates', 'deck.html');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-deck-'));
const cli = (args, cwd) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });

test('deck is registered under blocks as a template, with no laws and no contract', () => {
  const deck = registry.blocks.find((b) => b.name === 'deck');
  assert.ok(deck, 'registry.blocks has deck');
  assert.equal(deck.kind, 'template');
  assert.equal(deck.file, 'templates/deck.html');
  assert.equal(deck.assets, false);
  assert.equal('laws' in deck, false);
  assert.equal('contract' in deck, false);
  assert.ok(fs.existsSync(deckFile));
});

const html = () => fs.readFileSync(deckFile, 'utf8');
const slides = (src) => [...src.matchAll(/<section class="deck-slide\b[^"]*"[^>]*>([\s\S]*?)<\/section>/g)].map((m) => m[1]);

test('every slide face carries one title and one support line, and no footer', () => {
  const faces = slides(html());
  assert.equal(faces.length, 8);
  for (const [i, f] of faces.entries()) {
    assert.equal((f.match(/<h[12]\b/g) ?? []).length, 1, `slide ${i + 1}: one title`);
    assert.equal((f.match(/class="deck-sub"/g) ?? []).length, 1, `slide ${i + 1}: one support line`);
    assert.doesNotMatch(f, /<footer\b/, `slide ${i + 1}: no footer`);
  }
});

test('every number on a face is labelled fact, estimate or projection', () => {
  for (const [i, f] of slides(html()).entries()) {
    const nums = (f.match(/class="num"|class="glass deck-chart"/g) ?? []).length;
    const labels = (f.match(/class="badge"[^>]*>(Fact|Estimate|Projection)</g) ?? []).length;
    assert.equal(labels, nums, `slide ${i + 1}: ${nums} numbers, ${labels} labels`);
  }
});

test('the source links only the two package stylesheets, by relative path, and no font host', () => {
  const links = [...html().matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(links, ['<link rel="stylesheet" href="../tokens.css">', '<link rel="stylesheet" href="../components.css">']);
  assert.doesNotMatch(html(), /https?:\/\//);
});

test('the template adds only deck- classes, none a generic standalone name', () => {
  const style = [...html().matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const pkg = classUse(fs.readFileSync(path.join(root, 'components.css'), 'utf8'));
  const own = [...classUse(style).keys()].filter((n) => !pkg.has(n));
  assert.ok(own.length > 0);
  assert.deepEqual(own.filter((n) => !/^deck-/.test(n)), [], 'classes outside the deck- prefix');
});

test('verseva add deck writes one file with tokens.css and components.css inlined and no stylesheet link', () => {
  const cwd = tmp();
  const r = cli(['add', 'deck', '--dir', 'decks'], cwd);
  assert.equal(r.status, 0, r.stderr);
  const out = fs.readFileSync(path.join(cwd, 'decks', 'deck.html'), 'utf8');
  assert.deepEqual(fs.readdirSync(path.join(cwd, 'decks')), ['deck.html']);
  assert.doesNotMatch(out, /<link\b/);
  assert.ok(out.includes(fs.readFileSync(path.join(root, 'tokens.css'), 'utf8').trim()), 'tokens.css verbatim');
  assert.ok(out.includes(fs.readFileSync(path.join(root, 'components.css'), 'utf8').trim()), 'components.css verbatim');
  assert.ok(out.indexOf('--accent:') < out.indexOf('.deck-slide'), 'the package CSS sits where the links stood, before the deck styles');
});

test('the add output passes the four gates', () => {
  const cwd = tmp();
  assert.equal(cli(['add', 'deck', '--dir', 'decks'], cwd).status, 0);
  const g = spawnSync(process.execPath, [path.join(root, 'bin', 'verseva-gate.mjs'), '--tokens', path.join(root, 'tokens.css'), path.join(cwd, 'decks')], { encoding: 'utf8' });
  assert.equal(g.status, 0, g.stdout + g.stderr);
  assert.match(g.stdout, /all 4 gates clean/);
  assert.match(g.stdout, /verseva-recipe-gate: clean/);
});

test('block add and build hand out the same self-contained file', () => {
  const cwd = tmp();
  assert.equal(cli(['add', 'deck', '--dir', 'a'], cwd).status, 0);
  assert.equal(cli(['block', 'add', 'deck', '--dir', 'b'], cwd).status, 0);
  assert.equal(cli(['build', '--output', 'r'], cwd).status, 0);
  const a = fs.readFileSync(path.join(cwd, 'a', 'deck.html'), 'utf8');
  assert.equal(fs.readFileSync(path.join(cwd, 'b', 'deck.html'), 'utf8'), a);
  const item = JSON.parse(fs.readFileSync(path.join(cwd, 'r', 'deck.json'), 'utf8'));
  assert.equal(item.kind, 'template');
  assert.equal(item.files[0].content, a);
});

test('a component name still wins over a block name, and an unknown name still fails', () => {
  const cwd = tmp();
  assert.equal(cli(['add', 'badge', '--dir', 'x'], cwd).status, 0);
  assert.ok(fs.existsSync(path.join(cwd, 'x', 'badge.tsx')));
  const r = cli(['add', 'console', '--dir', 'y'], cwd);
  assert.equal(r.status, 1, 'a plain block is not a template: add does not fall back to it');
  assert.match(r.stderr, /unknown component: console/);
});

test('the committed site/r deck item matches the build', () => {
  const cwd = tmp();
  execFileSync(process.execPath, [bin, 'build', '--output', 'r'], { cwd, encoding: 'utf8' });
  assert.equal(fs.readFileSync(path.join(root, 'site', 'r', 'deck.json'), 'utf8'), fs.readFileSync(path.join(cwd, 'r', 'deck.json'), 'utf8'));
});
