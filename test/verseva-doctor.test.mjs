// verseva doctor: version lag and local overrides of package classes. Every run here goes
// through a fetch stub preloaded with --import, so no test reaches the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'verseva.mjs');
const fixtures = path.join(here, 'fixtures', 'doctor');
const stub = pathToFileURL(path.join(fixtures, 'fetch-stub.mjs')).href;
const LATEST_URL = 'https://registry.npmjs.org/@verseva/design/latest';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-doctor-'));

/** A fresh copy of a fixture consumer in a temp directory. */
function consumer(name) {
  const dir = tmp();
  fs.cpSync(path.join(fixtures, name), dir, { recursive: true });
  return dir;
}

/** Run `verseva doctor` in cwd with the stub. Returns code, stdout, stderr and the fetch calls. */
function doctor(cwd, args = [], { latest = '1.7.0', offline = false, body, pad, timeout } = {}) {
  const log = path.join(tmp(), 'calls.log');
  const env = { ...process.env, DOCTOR_STUB_LOG: log, DOCTOR_STUB_LATEST: latest, DOCTOR_STUB: offline ? 'offline' : '' };
  if (body !== undefined) env.DOCTOR_STUB_BODY = body;
  if (pad !== undefined) env.DOCTOR_STUB_PAD = String(pad);
  let code = 0;
  let out = '';
  let err = '';
  try {
    out = execFileSync(process.execPath, ['--import', stub, bin, 'doctor', ...args], { encoding: 'utf8', cwd, env, stdio: ['ignore', 'pipe', 'pipe'], timeout, maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    code = e.signal ? `signal ${e.signal}` : e.status;
    out = e.stdout ?? '';
    err = e.stderr ?? '';
  }
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { code, out, err, calls };
}

const OVERRIDE = { file: 'src/app.css', line: 5, selector: '.checkout .btn', classes: ['btn'] };

test('a lagging pin and one override are both reported in text', () => {
  const r = doctor(consumer('lagging'));
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /installed\s+1\.5\.0 \(package-lock\.json; package\.json \^1\.5\.0\)/);
  assert.match(r.out, /latest\s+1\.7\.0/);
  assert.match(r.out, /lag\s+2 minor behind/);
  assert.match(r.out, /overrides\s+1\n/);
  assert.match(r.out, /\n {2}src\/app\.css:5 {2}\.checkout \.btn {2}\(btn\)\n/);
  /* a comment, a lookalike class and an attribute value are not overrides */
  assert.doesNotMatch(r.out, /btn-like|mybtn|data-kind/);
});

test('--json is the documented shape, alone on stdout', () => {
  const r = doctor(consumer('lagging'), ['--json']);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(r.out), {
    schema: 1,
    package: '@verseva/design',
    declared: '^1.5.0',
    installed: '1.5.0',
    installedFrom: 'package-lock.json',
    latest: '1.7.0',
    lag: { major: 0, minor: 2, patch: 0 },
    state: 'behind',
    overrides: [OVERRIDE],
    skipped: [],
  });
});

test('one GET to the public npm registry, https, no redirects, with a timeout', () => {
  const r = doctor(consumer('lagging'), ['--json']);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(r.calls, [{ url: LATEST_URL, method: 'GET', redirect: 'error', signal: true, headers: null }]);
});

test('--strict exits 1 on the fixture with an override, 0 on a clean one', () => {
  assert.equal(doctor(consumer('lagging'), ['--strict']).code, 1);
  assert.equal(doctor(consumer('lagging'), ['--strict', '--json']).code, 1);
  const clean = doctor(consumer('clean'), ['--strict']);
  assert.equal(clean.code, 0, clean.err);
  assert.match(clean.out, /installed\s+1\.7\.0/);
  assert.match(clean.out, /lag\s+up to date/);
  assert.match(clean.out, /overrides\s+0\n/);
});

test('offline: latest unknown, overrides still reported, exit 0', () => {
  const r = doctor(consumer('lagging'), [], { offline: true });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /latest\s+unknown/);
  assert.match(r.out, /lag\s+unknown/);
  assert.match(r.out, /src\/app\.css:5 {2}\.checkout \.btn/);
  const j = doctor(consumer('lagging'), ['--json'], { offline: true });
  assert.equal(j.code, 0, j.err);
  const out = JSON.parse(j.out);
  assert.equal(out.latest, null);
  assert.equal(out.lag, null);
  assert.deepEqual(out.overrides, [OVERRIDE]);
  assert.equal(doctor(consumer('lagging'), ['--strict'], { offline: true }).code, 1);
});

test('a registry answer that is not a plain version counts as latest unknown', () => {
  for (const body of ['not json', JSON.stringify({ version: '1.7.0\u001b[31m' }), JSON.stringify({ version: 7 }), '[]']) {
    const r = doctor(consumer('lagging'), ['--json'], { body });
    assert.equal(r.code, 0, r.err);
    assert.equal(JSON.parse(r.out).latest, null, body);
  }
});

test('node_modules, dot directories and the verseva.json dir are not scanned', () => {
  const cwd = consumer('clean');
  const bad = '.btn { color: red; }\n';
  for (const d of ['node_modules/@verseva/design', '.next/static', 'src/components/verseva']) {
    fs.mkdirSync(path.join(cwd, d), { recursive: true });
    fs.writeFileSync(path.join(cwd, d, 'x.css'), bad);
  }
  fs.writeFileSync(path.join(cwd, 'verseva.json'), JSON.stringify({ dir: 'src/components/verseva' }));
  const r = doctor(cwd, ['--json']);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(r.out).overrides, []);
});

test('a verseva.json dir outside the tree, absolute, or "." excludes nothing and reads nothing outside', () => {
  for (const dir of ['../elsewhere', '/', '.', '']) {
    const cwd = consumer('lagging');
    fs.writeFileSync(path.join(cwd, 'verseva.json'), JSON.stringify({ dir }));
    const r = doctor(cwd, ['--json']);
    assert.equal(r.code, 0, `${dir}: ${r.err}`);
    assert.deepEqual(JSON.parse(r.out).overrides, [OVERRIDE], dir);
  }
});

test('path escape: symlinked files and directories pointing outside are skipped', () => {
  const cwd = consumer('clean');
  const outside = tmp();
  fs.writeFileSync(path.join(outside, 'leak.css'), '.btn { color: red; }\n');
  fs.symlinkSync(outside, path.join(cwd, 'linked-dir'));
  fs.symlinkSync(path.join(outside, 'leak.css'), path.join(cwd, 'src', 'linked.css'));
  const r = doctor(cwd, ['--json']);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(r.out).overrides, []);
});

test('path escape: a symlinked package.json or lockfile is refused, exit 2', () => {
  const outside = tmp();
  fs.writeFileSync(path.join(outside, 'package.json'), JSON.stringify({ dependencies: { '@verseva/design': '1.0.0' } }));
  fs.writeFileSync(path.join(outside, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/@verseva/design': { version: '1.0.0' } } }));
  for (const file of ['package.json', 'package-lock.json']) {
    const cwd = consumer('lagging');
    fs.rmSync(path.join(cwd, file));
    fs.symlinkSync(path.join(outside, file), path.join(cwd, file));
    const r = doctor(cwd, ['--json']);
    assert.equal(r.code, 2, file);
    assert.match(r.err, new RegExp(`verseva doctor: refused: ${file.replace('.', '\\.')} is a symlink`));
    assert.equal(r.out, '');
  }
});

test('path escape: a symlinked verseva.json is refused by the entry file, exit 1, nothing of it printed', () => {
  const outside = tmp();
  fs.writeFileSync(path.join(outside, 'verseva.json'), 'SECRET_TOKEN_abc123 \u001b[2J not json');
  const cwd = consumer('lagging');
  fs.symlinkSync(path.join(outside, 'verseva.json'), path.join(cwd, 'verseva.json'));
  const r = doctor(cwd, ['--json']);
  assert.equal(r.code, 1);
  assert.match(r.err, /^verseva: refused: verseva\.json is a symlink; fix or remove it\n$/);
  assert.doesNotMatch(r.err, /SECRET|\u001b/);
  assert.equal(r.out, '');
});

test('a long report survives a pipe in full', () => {
  const cwd = consumer('clean');
  fs.writeFileSync(path.join(cwd, 'src', 'big.css'), '.btn { color: red; }\n'.repeat(5000));
  const r = doctor(cwd, ['--json']);
  assert.equal(r.code, 0, r.err);
  assert.equal(JSON.parse(r.out).overrides.length, 5000);
});

test('a keyframe step is not a selector', () => {
  const cwd = consumer('clean');
  fs.writeFileSync(path.join(cwd, 'src', 'k.css'), '@keyframes k { from { opacity: 0; } 50% { opacity: .5; } to { opacity: 1; } }\n');
  const r = doctor(cwd, ['--json']);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(r.out).overrides, []);
});

test('errors exit 2 in one line: no package.json, invalid package.json', () => {
  const none = doctor(tmp());
  assert.equal(none.code, 2);
  assert.match(none.err, /^verseva doctor: no package\.json in the working directory\n$/);
  const cwd = tmp();
  fs.writeFileSync(path.join(cwd, 'package.json'), '{ nope');
  const bad = doctor(cwd);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /^verseva doctor: package\.json is not valid JSON/);
  assert.equal(bad.err.trimEnd().split('\n').length, 1);
  const lock = consumer('lagging');
  fs.writeFileSync(path.join(lock, 'package-lock.json'), '{ nope');
  const badLock = doctor(lock);
  assert.equal(badLock.code, 2);
  assert.match(badLock.err, /^verseva doctor: package-lock\.json is not valid JSON/);
});

test('no lockfile or a non-version pin: installed unknown, still exit 0', () => {
  const cwd = consumer('lagging');
  fs.rmSync(path.join(cwd, 'package-lock.json'));
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  pkg.dependencies['@verseva/design'] = 'file:../design';
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(pkg));
  const r = doctor(cwd, ['--json']);
  assert.equal(r.code, 0, r.err);
  const out = JSON.parse(r.out);
  assert.equal(out.declared, 'file:../design');
  assert.equal(out.installed, null);
  assert.equal(out.lag, null);

  const missing = consumer('clean');
  fs.writeFileSync(path.join(missing, 'package.json'), '{}');
  fs.rmSync(path.join(missing, 'package-lock.json'));
  const m = doctor(missing);
  assert.equal(m.code, 0, m.err);
  assert.match(m.out, /installed\s+not a dependency/);
});

test('one row per selector in a list; rows sorted by file then line; control characters stripped', () => {
  const cwd = consumer('clean');
  fs.writeFileSync(path.join(cwd, 'src', 'b.css'), '.x { color: red; }\n\n.card .hd,\n.field:focus-within > .help { color: red; }\n');
  fs.writeFileSync(path.join(cwd, 'a\u001b[2Jz.css'), '.btn.mine { color: red; }\n');
  const r = doctor(cwd, ['--json']);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(r.out).overrides.map((o) => [o.file, o.line, o.selector, o.classes]), [
    ['a\u001b[2Jz.css', 1, '.btn.mine', ['btn']],
    ['src/b.css', 3, '.card .hd', ['card', 'hd']],
    ['src/b.css', 4, '.field:focus-within > .help', ['field', 'help']],
  ]);
  const text = doctor(cwd);
  assert.doesNotMatch(text.out, /\u001b/);
  assert.match(text.out, /a\?\[2Jz\.css:1 {2}\.btn\.mine/);
});

test('linear time: a 1 MB stylesheet with no braces, unclosed comments and quotes', () => {
  const cwd = consumer('clean');
  const chunk = '.btn /* "x \'y ';
  fs.writeFileSync(path.join(cwd, 'src', 'flat.css'), chunk.repeat(Math.floor(1_000_000 / chunk.length)));
  const t0 = Date.now();
  const r = doctor(cwd, ['--json'], { timeout: 10_000 });
  const ms = Date.now() - t0;
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(r.out).overrides, []);
  assert.ok(ms < 5000, `took ${ms} ms`);
});

test('a CSS file over 1 MB is skipped and named in the report', () => {
  const cwd = consumer('lagging');
  fs.writeFileSync(path.join(cwd, 'src', 'huge.css'), '.btn { color: red; }\n'.repeat(60_000));
  const j = doctor(cwd, ['--json'], { timeout: 10_000 });
  assert.equal(j.code, 0, j.err);
  const out = JSON.parse(j.out);
  assert.deepEqual(out.overrides, [OVERRIDE]);
  assert.deepEqual(out.skipped, [{ file: 'src/huge.css', reason: 'over 1 MB' }]);
  const t = doctor(cwd, [], { timeout: 10_000 });
  assert.match(t.out, /\n {2}skipped {4}src\/huge\.css \(over 1 MB\)/);
});

test('bidirectional control characters are stripped from text output', () => {
  const cwd = consumer('clean');
  fs.writeFileSync(path.join(cwd, 'a‮z⁦.css'), '.btn { color: red; }\n');
  const r = doctor(cwd);
  assert.equal(r.code, 0, r.err);
  assert.doesNotMatch(r.out, /[‪-‮⁦-⁩]/);
  assert.match(r.out, /a\?z\?\.css:1/);
});

test('a registry answer over 1 MB counts as latest unknown', () => {
  const r = doctor(consumer('lagging'), ['--json'], { pad: 1_100_000 });
  assert.equal(r.code, 0, r.err);
  assert.equal(JSON.parse(r.out).latest, null);
});

test('prerelease is behind its release; newer than latest is ahead', () => {
  const cases = [['1.7.0-rc.1', '1.7.0', 'behind', /lag\s+behind \(prerelease\)/], ['1.8.0', '1.7.0', 'ahead', /lag\s+ahead of latest/], ['1.7.0', '1.7.0', 'current', /lag\s+up to date/]];
  for (const [installed, latest, state, line] of cases) {
    const cwd = consumer('clean');
    fs.writeFileSync(path.join(cwd, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/@verseva/design': { version: installed } } }));
    const j = JSON.parse(doctor(cwd, ['--json'], { latest }).out);
    assert.equal(j.state, state, installed);
    assert.deepEqual(j.lag, { major: 0, minor: 0, patch: 0 }, installed);
    assert.match(doctor(cwd, [], { latest }).out, line, installed);
  }
  const off = JSON.parse(doctor(consumer('clean'), ['--json'], { offline: true }).out);
  assert.equal(off.state, null);
});

test('a class inside :not(), even nested in :is() or :where(), is not an override', () => {
  const cwd = consumer('clean');
  fs.writeFileSync(path.join(cwd, 'src', 'n.css'), '.mine:not(:is(.x, :where(.btn))) { color: red; }\n:is(.mine, :where(.field)) { color: red; }\n');
  const r = doctor(cwd, ['--json']);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(r.out).overrides.map((o) => [o.line, o.classes]), [[2, ['field']]]);
});

/** Spawn doctor, read one chunk of stdout, then close the pipe (like `| head -c 100`). */
function doctorClosedEarly(cwd, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', stub, bin, 'doctor', ...args], { cwd, env: { ...process.env, DOCTOR_STUB_LATEST: '1.7.0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.stdout.once('data', () => child.stdout.destroy());
    child.on('close', (code) => resolve({ code, err }));
  });
}

test('a reader that closes the pipe early: no stack trace, the normal exit code', async () => {
  const cwd = consumer('clean');
  fs.writeFileSync(path.join(cwd, 'src', 'big.css'), '.btn { color: red; }\n'.repeat(20_000));
  const plain = await doctorClosedEarly(cwd, ['--json']);
  assert.deepEqual(plain, { code: 0, err: '' });
  const strict = await doctorClosedEarly(cwd, ['--json', '--strict']);
  assert.deepEqual(strict, { code: 1, err: '' });
});

test('doctor is listed in the help', () => {
  let out = '';
  try {
    out = execFileSync(process.execPath, [bin, 'help'], { encoding: 'utf8', cwd: tmp() });
  } catch (e) {
    out = e.stdout;
  }
  assert.match(out, /npx verseva doctor \[--json\] \[--strict\]/);
});
