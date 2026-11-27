import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'verseva-gate.mjs');
const fx = (...p) => path.join(here, 'fixtures', ...p);
const shipped = ['--tokens', path.join(here, '..', 'tokens.css')];

function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

test('all four gates clean on a conforming file', () => {
  const r = run([...shipped, fx('proj-type', 'good.css')]);
  assert.equal(r.code, 0);
  assert.match(r.out, /all 4 gates clean/);
});

test('one failing gate fails the suite and names it', () => {
  const r = run([...shipped, fx('proj-seam', 'inline.html')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /gate failed: spacing/);
});

test('a failing gate prints its output exactly once', () => {
  const r = run([...shipped, fx('proj-seam', 'inline.html')]);
  assert.equal(r.out.split('SEAM LAW').length - 1, 1);
});

test('the shipped contract passes the full suite', () => {
  const r = run([...shipped, path.join(here, '..', 'components.css')]);
  assert.equal(r.code, 0);
});

test('a missing path errors the suite (exit 2), never reports a violation', () => {
  const r = run([...shipped, fx('nope')]);
  assert.equal(r.code, 2);
  assert.match(r.out, /errored/);
  assert.doesNotMatch(r.out, /gate failed/);
  assert.doesNotMatch(r.out, /\n\s+at /);
});

test('a missing token file errors the suite (exit 2)', () => {
  const r = run(['--tokens', fx('missing.css'), fx('proj-type', 'good.css')]);
  assert.equal(r.code, 2);
  assert.doesNotMatch(r.out, /gate failed/);
});

test('a trailing --tokens errors the suite (exit 2)', () => {
  const r = run([...shipped, fx('proj-type', 'good.css'), '--tokens']);
  assert.equal(r.code, 2);
});

/* ---- recipe gate, advisory (issue 191) ---- */

const recipeFx = (...p) => path.join(here, 'fixtures', 'recipe', ...p);
const HEADING = '\nadvisory: recipe gate (never changes the exit code)\n';

/* Both streams kept apart, from a chosen working directory (the recipe gate reads verseva.json there). */
function runIn(cwd, args) {
  const r = spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', cwd });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const quiet = () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-gate-'));
  fs.writeFileSync(path.join(cwd, 'verseva.json'), '{"recipeAllow": ["recipe"], "material": "none"}');
  return cwd;
};
const loud = () => fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-gate-'));
const beforeAdvisory = (out) => out.slice(0, out.indexOf(HEADING) === -1 ? out.length : out.indexOf(HEADING));

test('RECIPE: the suite exits 0 on the recipe RED fixture and prints its findings under the advisory heading', () => {
  const r = runIn(loud(), [...shipped, recipeFx('red.html')]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /verseva-gate: all 4 gates clean\n/);
  const at = r.stdout.indexOf(HEADING);
  assert.ok(at > r.stdout.indexOf('all 4 gates clean'), 'the advisory section prints after the four gates');
  const advisory = r.stdout.slice(at);
  assert.match(advisory, /verseva-recipe-gate: 4 hand-built elements \(advisory\)/);
  assert.match(advisory, /red\.html:3 {2}<button> {2}Button: \.btn/);
  assert.match(advisory, /material census: no material consumed/);
});

test('RECIPE: the suite exits 0 on the utility-built RED fixture and prints its findings', () => {
  const r = runIn(loud(), [...shipped, recipeFx('red-utilities.html')]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.stdout.slice(r.stdout.indexOf(HEADING)), /hand-built elements? \(advisory\)\n\n {2}.+red-utilities\.html:\d+ {2}</);
});

test('RECIPE: the four gates print the same bytes and exit the same with and without recipe findings', () => {
  for (const input of [[recipeFx('red.html')], [fx('proj-seam', 'inline.html')], [fx('nope')]]) {
    const a = runIn(loud(), [...shipped, ...input]);
    const b = runIn(quiet(), [...shipped, ...input]);
    assert.equal(a.code, b.code, String(input));
    assert.equal(beforeAdvisory(a.stdout), beforeAdvisory(b.stdout), String(input));
    assert.equal(a.stderr, b.stderr, String(input));
  }
});

test('RECIPE: the four-gate output is the four gates run alone, in order, then the summary', () => {
  const file = recipeFx('red.html');
  const alone = ['hex-gate.mjs', 'contrast-gate.mjs', 'spacing-gate.mjs', 'type-gate.mjs']
    .map((g) => {
      const args = g === 'contrast-gate.mjs' ? shipped : g === 'spacing-gate.mjs' ? [file] : [...shipped, file];
      return execFileSync(process.execPath, [path.join(here, '..', 'bin', g), ...args], { encoding: 'utf8' });
    })
    .join('');
  const r = runIn(loud(), [...shipped, file]);
  assert.equal(beforeAdvisory(r.stdout), `${alone}verseva-gate: all 4 gates clean\n`);
});

test('RECIPE: a recipe error (bad verseva.json) is reported and never changes the exit code', () => {
  const cwd = loud();
  fs.writeFileSync(path.join(cwd, 'verseva.json'), '{"material": "partial"}');
  const r = runIn(cwd, [...shipped, recipeFx('red.html')]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /verseva\.json "material" must be "full" or "none"/);
  assert.match(r.stderr, /advisory gate errored: recipe/);
  assert.doesNotMatch(r.stdout + r.stderr, /gate failed/);
});

test('RECIPE: a four-gate failure still exits 1, and the advisory section still prints', () => {
  const r = runIn(quiet(), [...shipped, fx('proj-seam', 'inline.html')]);
  assert.equal(r.code, 1);
  assert.ok(r.stdout.includes(HEADING), 'the advisory section still runs');
});

/* ---- review round: timeout, opt-out (issue 191) ---- */

/* A copy of bin/ whose recipe gate never finishes, so the advisory timeout is what ends it. */
function hangingBin() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-gate-bin-'));
  fs.cpSync(path.join(here, '..', 'bin'), dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'recipe-gate.mjs'), 'setInterval(() => {}, 1000);\n');
  return path.join(dir, 'verseva-gate.mjs');
}

test('RECIPE: a hanging recipe gate times out, is reported, and never changes the exit code', () => {
  const r = spawnSync(process.execPath, [hangingBin(), ...shipped, recipeFx('red.html')], {
    encoding: 'utf8', cwd: loud(), timeout: 30000, env: { ...process.env, VERSEVA_ADVISORY_TIMEOUT_MS: '500' },
  });
  assert.equal(r.error, undefined, 'the suite itself finished');
  assert.equal(r.code ?? r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /verseva-gate: all 4 gates clean\n/);
  assert.match(r.stderr, /advisory gate errored: recipe \(timed out; exit code unchanged\)/);
});

test('RECIPE: the advisory timeout defaults to 60 seconds', () => {
  const src = fs.readFileSync(bin, 'utf8');
  assert.match(src, /VERSEVA_ADVISORY_TIMEOUT_MS\) \|\| 60000/);
});

test('RECIPE: --no-advisory skips the recipe gate and leaves the four gates as they are', () => {
  for (const input of [[recipeFx('red.html')], [fx('proj-seam', 'inline.html')]]) {
    const on = runIn(loud(), [...shipped, ...input]);
    const off = runIn(loud(), ['--no-advisory', ...shipped, ...input]);
    assert.equal(off.code, on.code, String(input));
    assert.equal(off.stdout, beforeAdvisory(on.stdout), String(input));
    assert.doesNotMatch(off.stdout + off.stderr, /advisory|verseva-recipe-gate/, String(input));
  }
});

test('RECIPE: gate:studio passes --no-advisory (the source scan already covers studio)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8'));
  assert.match(pkg.scripts['gate:studio'], /^node bin\/verseva-gate\.mjs --no-advisory /);
  assert.doesNotMatch(pkg.scripts.gate, /--no-advisory/);
});
