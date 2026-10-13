#!/usr/bin/env node
// Builds out/, the folder Vercel serves for design.verseva.com:
//   1. the repo tree as Vercel served it before (package files, docs, registry, site/...)
//   2. site/** again at the root (the old catch-all rewrite, now real files)
//   3. the studio build over the top (its index.html owns /)
// Every path in test/fixtures/served-paths.json must survive (npm run test:served).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'out');
const studio = path.join(root, 'studio/dist');

const SKIP_TOP = new Set(['node_modules', '.git', '.github', '.vercel', '.claude', 'out', 'studio', 'test', 'scripts']);
const SKIP_PATH = [/^board\/_themes(\/|$)/, /^board\/theme-manifest\.json$/];

function guard(rel, abs) {
  if (/Brand Assets/i.test(rel)) throw new Error(`assemble: refusing brand asset path ${rel}`);
  if (fs.lstatSync(abs).isSymbolicLink()) throw new Error(`assemble: refusing symlink ${rel}`);
}

function walk(dir, rel = '') {
  const files = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.name.startsWith('.')) continue;
    if (!rel && SKIP_TOP.has(ent.name)) continue;
    if (SKIP_PATH.some((re) => re.test(r))) continue;
    const abs = path.join(dir, ent.name);
    guard(r, abs);
    if (ent.isDirectory()) files.push(...walk(abs, r));
    else if (ent.isFile()) files.push(r);
  }
  return files;
}

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

if (!fs.existsSync(path.join(studio, 'index.html'))) {
  console.error('assemble: studio/dist/index.html missing, run npm run studio:build first');
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
const tree = walk(root);
for (const rel of tree) copy(path.join(root, rel), path.join(out, rel));
let flat = 0;
for (const rel of tree.filter((r) => r.startsWith('site/'))) {
  copy(path.join(root, rel), path.join(out, rel.slice('site/'.length)));
  flat++;
}
const built = walk(studio);
for (const rel of built) copy(path.join(studio, rel), path.join(out, rel));
fs.writeFileSync(path.join(out, '.assembled'), new Date().toISOString() + '\n');
console.log(`assemble: ${tree.length} repo files, ${flat} site files at root, ${built.length} studio files -> out/`);
