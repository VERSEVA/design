// The file walk shared by the four scanning gates (hex, spacing, type, recipe): --exclude holds at
// every depth, a symlinked entry is never followed, and nothing outside a scanned root is read.
// The contrast gate takes no scan paths, so it has no walk. Each case runs every gate's CLI on
// the same tree, which also proves each gate walks through bin/gate-walk.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const TOKENS = path.join(here, 'fixtures', 'tokens.css');

/* One violation each gate reports, in a file type it scans. */
const GATES = [
  { name: 'hex', ext: '.css', bad: 'a { color: #FF00AA; }\n', args: ['--tokens', TOKENS] },
  { name: 'spacing', ext: '.html', bad: '<div style="margin: 4px"></div>\n', args: [] },
  { name: 'type', ext: '.css', bad: 'a { font-family: Arial; }\n', args: ['--tokens', TOKENS] },
  { name: 'recipe', ext: '.html', bad: '<button>Go</button>\n', args: [], dashdash: true },
];

const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-walk-')));
function put(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
function run(gate, extra, paths, cwd) {
  const args = [...gate.args, ...extra, ...(gate.dashdash ? ['--'] : []), ...paths];
  const r = spawnSync(process.execPath, [path.join(root, 'bin', `${gate.name}-gate.mjs`), ...args], { encoding: 'utf8', cwd });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

for (const gate of GATES) {
  test(`${gate.name}: --exclude skips the named directory at every depth`, () => {
    const dir = tmp();
    put(path.join(dir, 'ex', 'a', 'vendor', `nested${gate.ext}`), gate.bad);
    put(path.join(dir, 'vendor', `top${gate.ext}`), gate.bad);
    put(path.join(dir, 'ex', 'a', 'keep', `kept${gate.ext}`), gate.bad);
    const r = run(gate, ['--exclude', 'vendor'], [dir], dir);
    assert.ok(r.code === 0 || r.code === 1, r.out);
    assert.match(r.out, new RegExp(`kept\\${gate.ext}:1`), 'the control file is still scanned');
    assert.doesNotMatch(r.out, /nested\./, 'the nested vendor directory was scanned');
    assert.doesNotMatch(r.out, /top\./, 'the top-level vendor directory was scanned');
  });

  test(`${gate.name}: a symlinked file is not read, even when it points outside the scan path`, () => {
    const dir = tmp();
    const outside = path.join(dir, 'outside');
    const proj = path.join(dir, 'proj');
    put(path.join(outside, `secret${gate.ext}`), gate.bad);
    put(path.join(proj, `ctrl${gate.ext}`), gate.bad);
    fs.symlinkSync(path.join(outside, `secret${gate.ext}`), path.join(proj, `link${gate.ext}`));
    fs.symlinkSync(path.join(proj, `ctrl${gate.ext}`), path.join(proj, `inner${gate.ext}`));
    const r = run(gate, [], [proj], proj);
    assert.ok(r.code === 0 || r.code === 1, r.out);
    assert.match(r.out, new RegExp(`ctrl\\${gate.ext}:1`), 'the control file is still scanned');
    assert.doesNotMatch(r.out, /link\.|inner\.|secret\./, 'a symlinked file was read');
  });

  test(`${gate.name}: a symlinked directory is skipped, whatever its name`, () => {
    const dir = tmp();
    const outside = path.join(dir, 'outside');
    const proj = path.join(dir, 'proj');
    put(path.join(outside, `secret${gate.ext}`), gate.bad);
    put(path.join(proj, `ctrl${gate.ext}`), gate.bad);
    fs.symlinkSync(outside, path.join(proj, 'dirlink'));
    fs.symlinkSync(outside, path.join(proj, `dirlink${gate.ext}`));
    const r = run(gate, [], [proj], proj);
    assert.ok(r.code === 0 || r.code === 1, r.out);
    assert.match(r.out, new RegExp(`ctrl\\${gate.ext}:1`), 'the control file is still scanned');
    assert.doesNotMatch(r.out, /dirlink|secret\./, 'a symlinked directory was read');
  });

  test(`${gate.name}: a root reached through a symlinked parent is still scanned`, () => {
    const dir = tmp();
    put(path.join(dir, 'real', 'proj', `bad${gate.ext}`), gate.bad);
    fs.symlinkSync(path.join(dir, 'real'), path.join(dir, 'alias'));
    const r = run(gate, [], [path.join(dir, 'alias', 'proj')], dir);
    assert.match(r.out, new RegExp(`bad\\${gate.ext}:1`), r.out);
  });

  test(`${gate.name}: walks through the shared walker`, () => {
    const src = fs.readFileSync(path.join(root, 'bin', `${gate.name}-gate.mjs`), 'utf8');
    assert.match(src, /from '\.\/gate-walk\.mjs'/);
    assert.doesNotMatch(src, /readdirSync/, 'the gate keeps its own directory walk');
  });
}
