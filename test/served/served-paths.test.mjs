// The studio build must keep every URL design.verseva.com served before it.
// Runs after `npm run studio:build && npm run assemble` (npm run test:served).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'out');
const { paths } = JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/served-paths.json'), 'utf8'));
const stamp = path.join(outDir, '.assembled');

const toFile = (p) => path.join(outDir, p === '/' ? 'index.html' : p.slice(1));

test('out/ was assembled after the last studio build', () => {
  assert.ok(fs.existsSync(stamp), 'out/.assembled missing: run npm run studio:build && npm run assemble');
  const built = path.join(root, 'studio/dist/index.html');
  assert.ok(fs.existsSync(built), 'studio/dist/index.html missing');
  assert.ok(fs.statSync(stamp).mtimeMs >= fs.statSync(built).mtimeMs, 'out/ is older than studio/dist');
});

test('every previously served path still resolves', () => {
  const missing = paths.filter((p) => !fs.existsSync(toFile(p)));
  assert.deepEqual(missing, [], `${missing.length} of ${paths.length} served paths missing`);
});

test('/ is the studio', () => {
  const html = fs.readFileSync(toFile('/'), 'utf8');
  assert.match(html, /id="studio-root"/);
});
