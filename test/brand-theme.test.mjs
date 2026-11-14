/* A partner brand keeps its own theme.css outside this package. These tests generate that
   brand's Swift token file from tokens.css plus the one theme file, into a folder of the
   caller's choice, and hold the result to the fixture and to the contrast floors. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveTokens } from '../bin/token-resolver.mjs';
import { measureResolved } from '../bin/contrast-measure.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const cli = path.join(root, 'bin', 'emit-swift.mjs');
const tokensCss = path.join(root, 'tokens.css');
const generatedDir = path.join(root, 'swift', 'Sources', 'VersevaDesign', 'Generated');
const typesFile = path.join(root, 'swift', 'Sources', 'VersevaDesign', 'Tokens', 'TokenValues.swift');
const fixture = path.join(here, 'fixtures', 'theme-brand-harbor.css');

const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
/* Names and bytes of the committed generated files. */
const committed = () => fs.readdirSync(generatedDir).sort()
  .map((f) => `${f} ${createHash('sha256').update(fs.readFileSync(path.join(generatedDir, f))).digest('hex')}`);
const COMMITTED = ['CobaltTokens.swift', 'ForestTokens.swift', 'SignatureTokens.swift', 'SlateTokens.swift', 'VioletTokens.swift'];

/* A partner's layout, outside the package: <tmp>/brand/theme.css in, <tmp>/Generated out. */
function partner(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-brand-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'brand'));
  const theme = path.join(dir, 'brand', 'theme.css');
  fs.copyFileSync(fixture, theme);
  return { theme, out: path.join(dir, 'Generated') };
}
const modes = (text) => {
  const at = text.indexOf('    public static let light = TokenSet(');
  assert.ok(at > 0);
  return { dark: text.slice(0, at), light: text.slice(at) };
};

test('--brand writes that brand\'s Swift file, and only that file, into the chosen folder', (t) => {
  const { theme, out } = partner(t);
  const before = committed();
  const r = run('--tokens', tokensCss, '--tokens', theme, '--brand', 'harbor', '--out', out);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(fs.readdirSync(out), ['HarborTokens.swift']);
  const text = fs.readFileSync(path.join(out, 'HarborTokens.swift'), 'utf8');
  assert.match(text, /^\/\/ GENERATED FILE\. DO NOT EDIT BY HAND\.\n/);
  assert.match(text, /^\/\/ Inputs: tokens\.css, theme\.css$/m);
  assert.match(text, /^\/\/ Theme: harbor, \[data-brand="harbor"\], dark and light\.$/m);
  assert.match(text, /^public enum HarborTokens \{$/m);
  assert.equal(run('--tokens', tokensCss, '--tokens', theme, '--brand', 'harbor', '--out', out, '--check').status, 0);

  /* The committed files: same names, same bytes, still in step with the package's CSS. */
  assert.deepEqual(committed(), before);
  assert.deepEqual(before.map((line) => line.split(' ')[0]), COMMITTED);
  assert.equal(run('--check').status, 0);
});

/* Expected by hand from the fixture: each 8-bit channel divided by 255, six decimals,
   trailing zeros trimmed. Dark accent is 45, 212, 191; light accent is 15, 118, 110. */
test('the generated values are the fixture\'s, in both modes, over the signature\'s', (t) => {
  const { theme, out } = partner(t);
  assert.equal(run('--tokens', tokensCss, '--tokens', theme, '--brand', 'harbor', '--out', out).status, 0);
  const { dark, light } = modes(fs.readFileSync(path.join(out, 'HarborTokens.swift'), 'utf8'));

  assert.ok(dark.includes('        accent: TokenColor(r: 0.176471, g: 0.831373, b: 0.74902, a: 1.0),'));
  assert.ok(dark.includes('        accentHover: TokenColor(r: 0.368627, g: 0.917647, b: 0.831373, a: 1.0),'));
  assert.ok(dark.includes('        accentInk: TokenColor(r: 0.015686, g: 0.12549, b: 0.109804, a: 1.0),'));
  assert.ok(dark.includes('        focus: TokenColor(r: 0.176471, g: 0.831373, b: 0.74902, a: 1.0),'));

  assert.ok(light.includes('        accent: TokenColor(r: 0.058824, g: 0.462745, b: 0.431373, a: 1.0),'));
  assert.ok(light.includes('        accentHover: TokenColor(r: 0.066667, g: 0.368627, b: 0.34902, a: 1.0),'));
  assert.ok(light.includes('        accentInk: TokenColor(r: 1.0, g: 1.0, b: 1.0, a: 1.0),'));
  assert.ok(light.includes('        focus: TokenColor(r: 0.058824, g: 0.462745, b: 0.431373, a: 1.0),'));

  /* What the brand does not set comes from tokens.css: the dark canvas, the light canvas, spacing. */
  assert.ok(dark.includes('        bg: TokenColor(r: 0.043137, g: 0.05098, b: 0.062745, a: 1.0),'));
  assert.ok(!light.includes('        bg: TokenColor(r: 0.043137, g: 0.05098, b: 0.062745, a: 1.0),'));
  assert.ok(dark.includes('        s4: 16.0,') && light.includes('        s4: 16.0,'));
});

test('without --brand the same inputs write the signature file too', (t) => {
  const { theme, out } = partner(t);
  assert.equal(run('--tokens', tokensCss, '--tokens', theme, '--out', out).status, 0);
  assert.deepEqual(fs.readdirSync(out).sort(), ['HarborTokens.swift', 'SignatureTokens.swift']);
});

test('--brand owns one file: every other generated file in the folder survives, byte for byte', (t) => {
  const { theme, out } = partner(t);
  /* The folder already holds files this run's inputs do not produce: the package's Cobalt
     file, and a generated file no theme anywhere produces. Neither is this run's to remove. */
  fs.mkdirSync(out);
  const cobalt = fs.readFileSync(path.join(generatedDir, 'CobaltTokens.swift'), 'utf8');
  fs.writeFileSync(path.join(out, 'CobaltTokens.swift'), cobalt);
  fs.writeFileSync(path.join(out, 'RetiredTokens.swift'), cobalt);
  fs.writeFileSync(path.join(out, 'HarborTokens.swift'), cobalt);
  const args = ['--tokens', tokensCss, '--tokens', theme, '--brand', 'harbor', '--out', out];

  /* Before the write, --check names the stale Harbor file and nothing else. */
  let r = run(...args, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /HarborTokens\.swift: stale/);
  assert.doesNotMatch(r.stderr, /CobaltTokens|RetiredTokens/);

  r = run(...args);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(fs.readdirSync(out).sort(), ['CobaltTokens.swift', 'HarborTokens.swift', 'RetiredTokens.swift']);
  assert.equal(fs.readFileSync(path.join(out, 'CobaltTokens.swift'), 'utf8'), cobalt);
  assert.equal(fs.readFileSync(path.join(out, 'RetiredTokens.swift'), 'utf8'), cobalt);
  assert.match(fs.readFileSync(path.join(out, 'HarborTokens.swift'), 'utf8'), /^public enum HarborTokens \{$/m);

  /* Harbor is current: the other themes' files are not strays to a brand run. */
  r = run(...args, '--check');
  assert.equal(r.status, 0, r.stderr);
});

test('--brand on a copy of the package\'s Generated folder removes nothing', (t) => {
  const { theme, out } = partner(t);
  fs.cpSync(generatedDir, out, { recursive: true });
  const r = run('--tokens', tokensCss, '--tokens', theme, '--brand', 'harbor', '--out', out);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(fs.readdirSync(out).sort(), [...COMMITTED, 'HarborTokens.swift'].sort());
  for (const f of COMMITTED) assert.equal(fs.readFileSync(path.join(out, f), 'utf8'), fs.readFileSync(path.join(generatedDir, f), 'utf8'), f);
});

test('--brand without --out exits 2 and writes nothing: a brand run never defaults into the package', (t) => {
  const { theme } = partner(t);
  const before = committed();
  for (const extra of [[], ['--check']]) {
    const r = run('--tokens', tokensCss, '--tokens', theme, '--brand', 'harbor', ...extra);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^emit-swift: --brand needs --out/);
    assert.equal(r.stdout, '');
  }
  assert.deepEqual(committed(), before);
  assert.deepEqual(fs.readdirSync(generatedDir).sort(), COMMITTED);
});

test('--brand --check reads only that brand\'s file', (t) => {
  const { theme, out } = partner(t);
  const args = ['--tokens', tokensCss, '--tokens', theme, '--brand', 'harbor', '--out', out];
  let r = run(...args, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /HarborTokens\.swift: missing/);
  assert.doesNotMatch(r.stderr, /SignatureTokens/);
  assert.equal(run(...args).status, 0);
  const file = path.join(out, 'HarborTokens.swift');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('s4: 16.0', 's4: 17.0'));
  r = run(...args, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /HarborTokens\.swift: stale/);
});

test('--brand usage errors exit 2 and write nothing', (t) => {
  const { theme, out } = partner(t);
  let r = run('--tokens', tokensCss, '--tokens', theme, '--brand', 'harbour', '--out', out);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^emit-swift: no theme named "harbour" in the inputs \(found: harbor, signature\)\n$/);
  assert.ok(!fs.existsSync(out));
  r = run('--tokens', tokensCss, '--tokens', theme, '--out', out, '--brand');
  assert.equal(r.status, 2);
  assert.ok(!fs.existsSync(out));
});

test('the fixture brand clears every contrast floor on the values its Swift file is generated from', () => {
  const files = [tokensCss, fixture];
  const m = measureResolved(resolveTokens(files.map((p) => fs.readFileSync(p, 'utf8')), files));
  assert.deepEqual(m.failures, []);
  assert.ok(m.contexts.includes('harbor·dark') && m.contexts.includes('harbor·light'));
});

const swiftc = spawnSync('swiftc', ['--version'], { encoding: 'utf8' });
const hasSwiftc = !swiftc.error && swiftc.status === 0;
test('swiftc -typecheck: the brand file is valid Swift 6 beside the hand-written types', {
  skip: hasSwiftc ? false : 'swiftc not found on this machine: Swift validity NOT checked here (run on a Mac with the Swift toolchain)',
}, (t) => {
  const { theme, out } = partner(t);
  assert.equal(run('--tokens', tokensCss, '--tokens', theme, '--brand', 'harbor', '--out', out).status, 0);
  const r = spawnSync('swiftc', ['-typecheck', '-swift-version', '6', '-warnings-as-errors', '-module-name', 'HarborDesign', typesFile, path.join(out, 'HarborTokens.swift')], { encoding: 'utf8' });
  assert.equal(r.status, 0, `swiftc -typecheck failed:\n${r.stdout}\n${r.stderr}`);
});
