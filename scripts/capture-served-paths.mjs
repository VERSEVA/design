#!/usr/bin/env node
// Captures every URL path design.verseva.com serves today, so the studio
// build can prove none of them stopped resolving. Vercel serves the repo
// root from the filesystem first, then rewrites /(.*) into /site/$1.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ref = process.argv[2] || 'fe34767';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', ref], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !f.startsWith('.github/') && !f.startsWith('test/') && !path.basename(f).startsWith('.'));

const served = new Set();
for (const f of files) {
  served.add('/' + f);
  if (f.startsWith('site/')) served.add('/' + f.slice('site/'.length));
}
served.add('/');

const out = path.join(root, 'test/fixtures/served-paths.json');
fs.writeFileSync(out, JSON.stringify({ ref, paths: [...served].sort() }, null, 2) + '\n');
console.log(`served paths: ${served.size} from ${ref} -> ${path.relative(root, out)}`);
