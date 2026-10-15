// Public-repo guard: no partner-private names and no em dashes in any tracked text file.
// Names are stored encoded so this file does not itself carry them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANNED = ['dWZpdHJh', 'Y2FuZHljZXV0aWNhbHM=', 'YWNi'].map((b) => Buffer.from(b, 'base64').toString());
const NAME = new RegExp(`(^|[^a-z0-9])(${BANNED.join('|')})([^a-z0-9]|$)`, 'i');
const TEXT = /\.(m?js|ts|tsx|css|html|json|md|txt|yml|yaml|svg)$/i;

test('no partner names or em dashes in tracked text files', () => {
  const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter((f) => TEXT.test(f));
  const hits = [];
  for (const f of files) {
    const abs = path.join(root, f);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    if (text.includes('\u2014')) hits.push(`${f}: em dash`);
    if (NAME.test(text)) hits.push(`${f}: partner name`);
    if (NAME.test(f)) hits.push(`${f}: partner name in path`);
  }
  assert.deepEqual(hits, []);
});
