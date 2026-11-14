import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { resolveTokens } from '../bin/token-resolver.mjs';
import { PAIRS } from '../bin/contrast-pairs.mjs';
import { measureResolved } from '../bin/contrast-measure.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const cli = path.join(root, 'bin', 'contrast-resolved.mjs');
const gate = path.join(root, 'bin', 'contrast-gate.mjs');
const fx = (name) => path.join(here, 'fixtures', name);

const shipped = ['tokens.css', ...fs.readdirSync(path.join(root, 'themes')).filter((f) => f.endsWith('.css')).sort().map((f) => `themes/${f}`)]
  .map((p) => path.join(root, p));
const resolve = (files) => resolveTokens(files.map((p) => fs.readFileSync(p, 'utf8')), files);
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const tokensArgs = (files) => files.flatMap((f) => ['--tokens', f]);

const CONTEXTS = ['signature', 'cobalt', 'forest', 'slate', 'violet'].flatMap((t) => [`${t}·dark`, `${t}·light`]);
const UNRESOLVABLE = 'UNRESOLVABLE (required pair; the gate must measure it)';

test('every pair clears its floor on the resolved values, for every shipped theme and mode', () => {
  const m = measureResolved(resolve(shipped));
  assert.deepEqual(m.failures, []);
  assert.deepEqual([...m.contexts].sort(), [...CONTEXTS].sort());
  assert.equal(m.measured, PAIRS.length * CONTEXTS.length);
  assert.equal(m.results.length, m.measured);
  for (const r of m.results) assert.ok(r.ratio >= r.floor, `[${r.context}] ${r.pair} ${r.ratio} under ${r.floor}`);
});

/* The existing gate parses the CSS itself; this check takes the resolver's values. On the
   shipped files they must tell the same story. The gate prints each ratio to two decimals,
   and the resolver rounds channels to 8 bits and alpha to four places, so the two are
   compared to within 0.01. */
test('agrees with verseva-contrast-gate on the shipped files: same ten contexts, same pairs, same ratios to 0.01', () => {
  const g = spawnSync(process.execPath, [gate, ...tokensArgs(shipped)], { cwd: root, encoding: 'utf8', env: { ...process.env, VERSEVA_GATE_VERBOSE: '1' } });
  assert.equal(g.status, 0, g.stderr);
  const total = g.stdout.match(/clean \((\d+) pairs measured across (\d+) themes, 0 skipped\)/);
  assert.ok(total, g.stdout);
  const fromGate = new Map();
  for (const line of g.stdout.split('\n')) {
    const ok = line.match(/^ {2}ok \[(.+?)\] (.+?) {2}([\d.]+):1 {2}\(floor ([\d.]+)\)$/);
    if (!ok) continue;
    /* The gate calls the unbranded theme "dark" and "light"; the resolver calls it "signature". */
    const context = ok[1].includes('·') ? ok[1] : `signature·${ok[1]}`;
    fromGate.set(`${context} ${ok[2]}`, { ratio: Number(ok[3]), floor: Number(ok[4]) });
  }
  const m = measureResolved(resolve(shipped));
  assert.equal(m.measured, Number(total[1]));
  assert.equal(m.contexts.length, Number(total[2]));
  assert.equal(m.contexts.length, 10);
  assert.equal(fromGate.size, m.measured);
  for (const r of m.results) {
    const other = fromGate.get(`${r.context} ${r.pair}`);
    assert.ok(other, `the gate did not measure [${r.context}] ${r.pair}`);
    assert.equal(other.floor, r.floor);
    assert.ok(Math.abs(other.ratio - r.ratio) <= 0.01, `[${r.context}] ${r.pair}: gate ${other.ratio}, resolved ${r.ratio}`);
  }
});

test('CLI: clean on the package files by default, stating pairs and themes', () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, `contrast-resolved: clean (${PAIRS.length * 10} pairs measured across 10 themes, 0 skipped)\n`);
});

test('CLI: a partner brand theme outside the package passes', () => {
  const r = run('--tokens', path.join(root, 'tokens.css'), '--tokens', fx('theme-brand-harbor.css'));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, `contrast-resolved: clean (${PAIRS.length * 4} pairs measured across 4 themes, 0 skipped)\n`);
});

test('CLI: a brand theme with a pair under its floor fails, naming theme, pair, ratio and floor', () => {
  const r = run('--tokens', path.join(root, 'tokens.css'), '--tokens', fx('theme-brand-harbor-dim.css'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, new RegExp(`^contrast-resolved: 2 failures \\(${PAIRS.length * 4} pairs measured\\)$`, 'm'));
  assert.match(r.stderr, /^ {2}\[harbor-dim·dark\] accent-ink on accent {2}1\.26:1 {2}\(floor 4\.5\)$/m);
  assert.match(r.stderr, /^ {2}\[harbor-dim·dark\] accent-ink on accent-hover {2}1\.00:1 {2}\(floor 4\.5\)$/m);
  assert.doesNotMatch(r.stderr, /harbor-dim·light|signature/);
  assert.equal(r.stdout, '');
});

test('a pair that cannot be measured is a failure, never a silent pass', () => {
  /* A named color outside the resolver's table stays a string; a missing token is absent. */
  const resolved = resolve([path.join(root, 'tokens.css')]);
  resolved.themes.signature.dark.accent = { type: 'string', value: 'rebeccapurple' };
  delete resolved.themes.signature.light['data-alt'];
  const m = measureResolved(resolved);
  assert.ok(m.failures.includes(`[signature·dark] accent on bg  ${UNRESOLVABLE}`));
  assert.ok(m.failures.includes(`[signature·dark] text-1 on accent*0.14+surface  ${UNRESOLVABLE}`));
  assert.ok(m.failures.includes(`[signature·light] data-alt on surface  ${UNRESOLVABLE}`));
  assert.equal(m.measured + m.failures.length, PAIRS.length * 2);
});

test('a theme with no canvas fails outright', () => {
  const resolved = resolve([path.join(root, 'tokens.css')]);
  delete resolved.themes.signature.dark.bg;
  const m = measureResolved(resolved);
  assert.ok(m.failures.includes('[signature·dark] --bg is unresolvable; nothing can be measured'));
  assert.equal(m.measured, PAIRS.length);
});

test('CLI: a token the resolver could not resolve fails its pairs (exit 1)', () => {
  const r = run('--tokens', fx('tokens-unresolvable.css'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\[signature·dark\] accent on bg {2}UNRESOLVABLE/);
});

test('translucent layers are composited over the real backdrop before measuring', () => {
  const color = (r, g, b, a = 1) => ({ type: 'color', r, g, b, a });
  const names = new Set(PAIRS.flatMap(([fg, chain]) => [fg, ...chain.map((c) => c.split('*')[0])]));
  const tokens = Object.fromEntries([...names].map((n) => [n, color(255, 255, 255)]));
  for (const n of ['bg', 'surface', 'surface-2', 'accent', 'accent-hover']) tokens[n] = color(0, 0, 0);
  /* Half-white over black is mid grey (127.5): white text on it is 3.98:1, under 4.5.
     Measured without compositing it would read 1:1. */
  tokens['success-bg'] = color(255, 255, 255, 0.5);
  const m = measureResolved({ themes: { signature: { dark: tokens } }, unresolved: [] });
  const hit = m.results.find((r) => r.pair === 'success on success-bg+surface');
  assert.ok(Math.abs(hit.ratio - 3.98) < 0.01, String(hit.ratio));
  assert.ok(m.failures.some((f) => f.startsWith('[signature·dark] success on success-bg+surface  3.98:1')));
});

test('CLI usage errors exit 2', () => {
  assert.equal(run('--tokens').status, 2);
  assert.equal(run('src').status, 2);
  const missing = run('--tokens', fx('missing.css'));
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /^contrast-resolved: no such file: .*missing\.css\n$/);
});
