// The served-paths contract: every URL design.verseva.com served before the studio declares
// its kind, "file" or "redirect" (test/fixtures/served-paths.json), and resolves as that kind
// against the built out/ plus vercel.json. A redirect lands on a page out/ serves and leaves
// no file behind at its source. /r/* and /site/r/* are files, always.
// Runs after `npm run studio:build && npm run assemble` (npm run test:served).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root, resolve, fileFor } from './vercel-routing.mjs';

const out = path.join(root, 'out');
const { paths } = JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/served-paths.json'), 'utf8'));
const stamp = path.join(out, '.assembled');
const KINDS = new Set(['file', 'redirect']);

/* Paths that are files by rule, whatever the fixture says: the registry JSON consumers fetch,
   the gallery iframe targets, and the two site assets assemble copies to the root. */
const siteR = fs.readdirSync(path.join(root, 'site/r'));
const siteExamples = fs.readdirSync(path.join(root, 'site/examples'), { recursive: true })
  .filter((f) => fs.statSync(path.join(root, 'site/examples', f)).isFile());
const MUST_BE_FILES = [
  ...siteR.flatMap((f) => [`/r/${f}`, `/site/r/${f}`]),
  ...siteExamples.flatMap((f) => [`/examples/${f}`, `/site/examples/${f}`]),
  '/site.css', '/theme.js',
];

test('out/ was assembled after the last studio build', () => {
  assert.ok(fs.existsSync(stamp), 'out/.assembled missing: run npm run studio:build && npm run assemble');
  const built = path.join(root, 'studio/dist/index.html');
  assert.ok(fs.existsSync(built), 'studio/dist/index.html missing');
  assert.ok(fs.statSync(stamp).mtimeMs >= fs.statSync(built).mtimeMs, 'out/ is older than studio/dist');
});

test('every served path declares a kind, and /r/* and /site/r/* declare "file"', () => {
  const bad = Object.entries(paths).filter(([p, k]) => !KINDS.has(k) || (/^\/(site\/)?r\//.test(p) && k !== 'file'));
  assert.deepEqual(bad, []);
  assert.ok(Object.keys(paths).length > 200, 'the fixture lost paths');
});

test('every served path resolves as its declared kind', () => {
  const bad = [];
  for (const [p, kind] of Object.entries(paths)) {
    const r = resolve(out, p);
    if (r.kind !== kind) { bad.push(`${p}: declared ${kind}, resolves as ${r.kind}${r.location ? ` -> ${r.location}` : ''}`); continue; }
    if (kind === 'redirect') {
      const to = resolve(out, r.location);
      if (to.kind !== 'file') bad.push(`${p} -> ${r.location}: lands on ${to.kind}`);
      /* /index.html is the exception: it is the file that serves /, the place it redirects to. */
      const selfIndex = p.endsWith('/index.html') && to.kind === 'file' && to.file === fileFor(out, p);
      if (fileFor(out, p) && !selfIndex) bad.push(`${p}: a redirect, yet out/ still holds a file there`);
    }
  }
  assert.deepEqual(bad, []);
});

/* Every file the package ships (its `files` list, as npm pack reads it) is served, so each must be declared. */
test('every file the package ships is declared in the fixture', () => {
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  const shipped = pack.files.map((f) => `/${f.path}`);
  assert.ok(shipped.length > 50, `npm pack listed only ${shipped.length} files`);
  const undeclared = shipped.filter((p) => !paths[p]);
  assert.deepEqual(undeclared, [], 'add these to test/fixtures/served-paths.json as "file"');
});

test('the registry JSON, the examples, site.css and theme.js are files', () => {
  const bad = MUST_BE_FILES.filter((p) => resolve(out, p).kind !== 'file');
  assert.deepEqual(bad, []);
  const json = fs.readFileSync(resolve(out, '/r/button.json').file, 'utf8');
  assert.doesNotThrow(() => JSON.parse(json), '/r/button.json is not JSON');
});

test('/ is the studio', () => {
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(html, /id="studio-root"/);
});
