// Public-repo guard: no partner-private names, no parent-company name and no em dashes in
// any tracked text file. Names are stored encoded so this file does not itself carry them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANNED = ['dWZpdHJh', 'Y2FuZHljZXV0aWNhbHM=', 'YWNi'].map((b) => Buffer.from(b, 'base64').toString());
const NAME = new RegExp(`(^|[^a-z0-9])(${BANNED.join('|')})([^a-z0-9]|$)`, 'i');
const PARENT = Buffer.from('bmVtaXhv', 'base64').toString();
const PARENT_RE = new RegExp(PARENT, 'i');
/* The one exemption: a legacy asset path the served-path fixture pins (the file cannot move). */
const PINNED = { file: 'test/fixtures/served-paths.json', path: `/docs/media/button-${PARENT}.png` };
const TEXT = /\.(m?js|ts|tsx|css|html|json|md|txt|yml|yaml|svg)$/i;

/* Read every tracked text file once (the drive is slow); deleted-but-tracked files are skipped. */
const FILES = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((f) => TEXT.test(f) && fs.existsSync(path.join(root, f)))
  .map((f) => [f, fs.readFileSync(path.join(root, f), 'utf8')]);

test('no partner names or em dashes in tracked text files', () => {
  const hits = [];
  for (const [f, text] of FILES) {
    if (text.includes('\u2014')) hits.push(`${f}: em dash`);
    if (NAME.test(text)) hits.push(`${f}: partner name`);
    if (NAME.test(f)) hits.push(`${f}: partner name in path`);
  }
  assert.deepEqual(hits, []);
});

test('no parent-company name in tracked text files beyond the pinned asset path', () => {
  const hits = [];
  for (const [f, raw] of FILES) {
    const text = f === PINNED.file ? raw.split(PINNED.path).join('') : raw;
    if (PARENT_RE.test(text)) hits.push(`${f}: parent-company name`);
    if (PARENT_RE.test(f)) hits.push(`${f}: parent-company name in path`);
  }
  assert.deepEqual(hits, []);
});
