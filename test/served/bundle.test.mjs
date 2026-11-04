// Every visitor downloads the studio's entry chunk, so it must not carry the gallery
// examples' source (each /gallery/<slug>/code route loads its own as a separate chunk),
// and it stays under a gzip budget. Reads out/ (npm run studio:build && npm run assemble).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'out');
const examples = path.join(root, 'site/examples');

/* Main entry chunk gzip budget (zlib default level, as vite reports it). 1.6.0 shipped 176.3 kB. */
export const MAIN_GZIP_BUDGET = 150_000;

/* The entry module plus every chunk the shell preloads: what a cold visit pays before any route chunk. */
function mainChunks() {
  assert.ok(fs.existsSync(path.join(out, 'index.html')), 'out/ missing: run npm run studio:build && npm run assemble');
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  const entry = [...html.matchAll(/<script type="module"[^>]*\ssrc="(\/_s\/[^"]+\.js)"/g)].map((m) => m[1]);
  const preload = [...html.matchAll(/<link rel="modulepreload"[^>]*\shref="(\/_s\/[^"]+\.js)"/g)].map((m) => m[1]);
  assert.equal(entry.length, 1, 'out/index.html has one module entry');
  return { entry: entry[0], all: [...entry, ...preload] };
}

/* Lines of an example long and plain enough to be its fingerprint: no quote, backslash or
   template characters, so a JS string literal of the source holds them verbatim. */
function fingerprint(text) {
  return [...new Set(text.split('\n').map((l) => l.trim()).filter((l) => l.length >= 40 && !/["'`\\$]/.test(l)))];
}

test('the main entry chunk carries no gallery example source', () => {
  const { all } = mainChunks();
  const js = all.map((p) => fs.readFileSync(path.join(out, p), 'utf8')).join('\n');
  const files = fs.readdirSync(examples).filter((f) => f.endsWith('.html')).sort();
  assert.ok(files.length > 0, 'no site/examples/*.html');
  const found = [];
  for (const f of files) {
    const lines = fingerprint(fs.readFileSync(path.join(examples, f), 'utf8'));
    assert.ok(lines.length >= 5, `${f}: too few fingerprint lines to check`);
    const hits = lines.filter((l) => js.includes(l));
    if (hits.length) found.push(`${f}: ${hits.length}/${lines.length} lines in the main chunk, e.g. ${JSON.stringify(hits[0])}`);
  }
  assert.deepEqual(found, []);
});

test(`the main entry chunk is under ${MAIN_GZIP_BUDGET / 1000} kB gzip`, () => {
  const { entry } = mainChunks();
  const gz = zlib.gzipSync(fs.readFileSync(path.join(out, entry))).length;
  console.log(`main chunk ${entry}: ${(gz / 1000).toFixed(2)} kB gzip`);
  assert.ok(gz <= MAIN_GZIP_BUDGET, `${entry} is ${(gz / 1000).toFixed(2)} kB gzip, over the ${MAIN_GZIP_BUDGET / 1000} kB budget`);
});
