#!/usr/bin/env node
// Captures every URL path design.verseva.com served at a ref, with the kind each must
// keep: "redirect" for the legacy chapter pages (site/*.html, served at /<page>.html and
// /site/<page>.html, now studio routes), "file" for everything else. The served-paths
// test checks each path against out/ and vercel.json (npm run test:served). The checked-in
// fixture was curated after capture (the public scrub dropped brand and board paths), so a
// recapture is a starting point to diff by hand, not a replacement.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ref = process.argv[2] || 'fe34767';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

const legacy = new Set(files.filter((f) => /^site\/[^/]+\.html$/.test(f)).flatMap((f) => [`/${f}`, `/${f.slice('site/'.length)}`]));
const paths = Object.fromEntries([...served].sort().map((p) => [p, legacy.has(p) ? 'redirect' : 'file']));

const out = path.join(root, 'test/fixtures/served-paths.json');
fs.writeFileSync(out, JSON.stringify({ ref, paths }, null, 2) + '\n');
console.log(`served paths: ${served.size} from ${ref} (${legacy.size} redirects) -> ${path.relative(root, out)}`);
