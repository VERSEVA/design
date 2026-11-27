// Subcommand discovery: bin/verseva.mjs loads every bin/cmd-<name>.mjs beside it, so a new
// command is one new file. These tests run a copy of bin/ with a module dropped in, and hold
// discovery to that one directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(bin, args, cwd) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8', cwd }) };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-discovery-'));

/** A copy of the package's bin/ and registry.json, with verseva.mjs byte-for-byte as shipped. */
function copyOfPackage() {
  const pkg = tmp();
  fs.cpSync(path.join(root, 'bin'), path.join(pkg, 'bin'), { recursive: true });
  fs.copyFileSync(path.join(root, 'registry.json'), path.join(pkg, 'registry.json'));
  return pkg;
}

/** A command module that prints `said` when run and writes `marker` when merely loaded. */
const probe = (word, order, marker) => `import fs from 'node:fs';
${marker ? `fs.writeFileSync(${JSON.stringify(marker)}, 'loaded');` : ''}
export const match = '${word}';
export const order = ${order};
export const usage = ['npx verseva ${word} <thing>'];
export function run({ rest }) {
  if (!rest[0]) return;
  console.log('${word} ran with ' + rest[0]);
  process.exit(0);
}
`;

const shippedHelp = run(path.join(root, 'bin', 'verseva.mjs'), [], tmp()).out;

test('a cmd- module dropped into bin/ is dispatched and listed in help, with verseva.mjs untouched', () => {
  const pkg = copyOfPackage();
  const bin = path.join(pkg, 'bin', 'verseva.mjs');
  assert.equal(run(bin, [], tmp()).out, shippedHelp, 'the copy should start with the shipped help');

  fs.writeFileSync(path.join(pkg, 'bin', 'cmd-probe.mjs'), probe('probe', 15));
  assert.deepEqual(fs.readFileSync(bin), fs.readFileSync(path.join(root, 'bin', 'verseva.mjs')));

  const ran = run(bin, ['probe', 'x'], tmp());
  assert.deepEqual(ran, { code: 0, out: 'probe ran with x\n' });

  /* order 15 sits between list (10) and init (20); every other help line is unchanged. */
  const lines = shippedHelp.split('\n');
  const at = lines.indexOf('  npx verseva init');
  assert.notEqual(at, -1);
  const expected = [...lines.slice(0, at), '  npx verseva probe <thing>', ...lines.slice(at)].join('\n');
  const help = run(bin, ['help'], tmp());
  assert.deepEqual(help, { code: 0, out: expected });

  /* a command that returns without exiting falls through to the help, exit 2 */
  assert.deepEqual(run(bin, ['probe'], tmp()), { code: 2, out: expected });
});

test('discovery loads only regular cmd-<name>.mjs files in the package bin directory', () => {
  const pkg = copyOfPackage();
  const bin = path.join(pkg, 'bin', 'verseva.mjs');
  const cwd = tmp();
  const outside = tmp();
  const marker = (n) => path.join(outside, `${n}.loaded`);

  /* in the working directory, and in a bin/ under it */
  fs.writeFileSync(path.join(cwd, 'cmd-cwd.mjs'), probe('cwd', 1, marker('cwd')));
  fs.mkdirSync(path.join(cwd, 'bin'));
  fs.writeFileSync(path.join(cwd, 'bin', 'cmd-cwdbin.mjs'), probe('cwdbin', 1, marker('cwdbin')));
  /* a symlink in the package bin/ pointing outside it */
  fs.writeFileSync(path.join(outside, 'linked.mjs'), probe('linked', 1, marker('linked')));
  fs.symlinkSync(path.join(outside, 'linked.mjs'), path.join(pkg, 'bin', 'cmd-linked.mjs'));
  /* names off the pattern, and a subdirectory */
  fs.writeFileSync(path.join(pkg, 'bin', 'cmd-notjs.txt'), probe('notjs', 1, marker('notjs')));
  fs.writeFileSync(path.join(pkg, 'bin', 'xcmd-prefix.mjs'), probe('prefix', 1, marker('prefix')));
  fs.mkdirSync(path.join(pkg, 'bin', 'sub'));
  fs.writeFileSync(path.join(pkg, 'bin', 'sub', 'cmd-nested.mjs'), probe('nested', 1, marker('nested')));

  assert.deepEqual(run(bin, [], cwd), { code: 0, out: shippedHelp });
  for (const word of ['cwd', 'cwdbin', 'linked', 'notjs', 'prefix', 'nested']) {
    assert.deepEqual(run(bin, [word, 'x'], cwd), { code: 2, out: shippedHelp }, word);
  }
  /* a path in the arguments is a word like any other, never an import */
  for (const arg of ['./cmd-cwd.mjs', path.join(cwd, 'cmd-cwd.mjs'), '../cmd-cwd.mjs']) {
    assert.deepEqual(run(bin, [arg, 'x'], cwd), { code: 2, out: shippedHelp }, arg);
  }
  assert.deepEqual(fs.readdirSync(outside).filter((f) => f.endsWith('.loaded')), []);
});

/** One line on stderr, exit 1, and nothing that looks like a stack trace. */
function assertOneLine(r, pattern) {
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, pattern);
  assert.equal(r.out.trimEnd().split('\n').length, 1, `expected one line, got:\n${r.out}`);
}

test('a match word claimed twice, or a reserved word, stops startup naming the files', () => {
  const dup = copyOfPackage();
  fs.writeFileSync(path.join(dup, 'bin', 'cmd-other.mjs'), probe('list', 5));
  for (const args of [['list'], ['init'], []]) {
    const r = run(path.join(dup, 'bin', 'verseva.mjs'), args, tmp());
    assertOneLine(r, /^verseva: command "list" is claimed by both bin\/cmd-list\.mjs and bin\/cmd-other\.mjs\n$/);
  }

  /* an array of match words is checked word by word */
  const arr = copyOfPackage();
  fs.writeFileSync(path.join(arr, 'bin', 'cmd-other.mjs'), probe('other', 5).replace("match = 'other'", "match = ['other', 'build']"));
  assertOneLine(run(path.join(arr, 'bin', 'verseva.mjs'), [], tmp()), /"build" is claimed by both bin\/cmd-build\.mjs and bin\/cmd-other\.mjs/);

  for (const word of ['help', '--help', '-h', '--version']) {
    const pkg = copyOfPackage();
    fs.writeFileSync(path.join(pkg, 'bin', 'cmd-taken.mjs'), probe(word, 5));
    const r = run(path.join(pkg, 'bin', 'verseva.mjs'), ['list'], tmp());
    assertOneLine(r, new RegExp(`^verseva: bin/cmd-taken\\.mjs claims the reserved word "${word}"\\n$`));
  }
});

test('a module with a missing or invalid export, or one that throws on import, stops startup in one line', () => {
  const good = probe('probe', 15);
  const cases = {
    'no usage': [good.replace(/^export const usage.*\n/m, ''), /usage/],
    'no order': [good.replace(/^export const order.*\n/m, ''), /order/],
    'no match': [good.replace(/^export const match.*\n/m, ''), /match/],
    'no run': [good.replace('export function run', 'function run'), /run/],
    'usage not lines': [good.replace(/^export const usage.*$/m, "export const usage = 'npx verseva probe';"), /usage/],
    'usage with a non-string': [good.replace(/^export const usage.*$/m, 'export const usage = [undefined];'), /usage/],
    'order not a number': [good.replace('order = 15', "order = 'first'"), /order/],
    'empty match': [good.replace("match = 'probe'", 'match = []'), /match/],
    'run not a function': [good.replace('export function run', 'export const run = 1; function _run'), /run/],
  };
  for (const [name, [source, names]] of Object.entries(cases)) {
    const pkg = copyOfPackage();
    fs.writeFileSync(path.join(pkg, 'bin', 'cmd-probe.mjs'), source);
    for (const args of [[], ['list']]) {
      const r = run(path.join(pkg, 'bin', 'verseva.mjs'), args, tmp());
      assertOneLine(r, /^verseva: bin\/cmd-probe\.mjs is not a command module \(missing or invalid export: /);
      assert.match(r.out, names, name);
      assert.doesNotMatch(r.out, /undefined/, name);
    }
  }

  const broken = { 'throws on import': "throw new Error('boom');\n" + good, 'does not parse': 'export const match = ;\n' };
  for (const [name, source] of Object.entries(broken)) {
    const pkg = copyOfPackage();
    fs.writeFileSync(path.join(pkg, 'bin', 'cmd-probe.mjs'), source);
    const r = run(path.join(pkg, 'bin', 'verseva.mjs'), ['list'], tmp());
    assertOneLine(r, /^verseva: bin\/cmd-probe\.mjs failed to load \(/);
    assert.doesNotMatch(r.out, /\n\s+at /, name);
  }
});
