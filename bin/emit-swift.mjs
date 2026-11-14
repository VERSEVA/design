#!/usr/bin/env node
/**
 * emit-swift.mjs: writes the Swift token files, one per theme, from
 * tokens.css and the brand themes. The mapping from web to native is
 * bin/swift-emitter.mjs; the values come from bin/token-resolver.mjs.
 *
 * Usage:
 *   node bin/emit-swift.mjs [--tokens <tokens.css> [--tokens <theme.css>]...]
 *                           [--out <dir>] [--check]
 *   npm run tokens:swift    (the package's own files, into swift/)
 *
 * Not a published command.
 *
 * Rules:
 * - --tokens files are read in cascade (load) order: tokens.css first, then
 *   theme files. With no --tokens, the package's own tokens.css and every
 *   themes/*.css (sorted by name) are used.
 * - --out is the directory written to (default
 *   swift/Sources/VersevaDesign/Generated). Every *.swift in it is owned by
 *   this script: a file no theme produces is removed.
 * - --check writes nothing. It regenerates in memory and compares with the
 *   files in --out: exit 1, naming each stale, missing or stray file, when
 *   they differ; exit 0 when they match. npm test runs it.
 * - Exit 2 on usage errors. Exit 1 when the CSS cannot be resolved or a
 *   token is neither mapped nor excluded.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTokens } from './token-resolver.mjs';
import { emitSwift } from './swift-emitter.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: node bin/emit-swift.mjs [--tokens <tokens.css> [--tokens <theme.css>]...] [--out <dir>] [--check]';

let tokens = [];
let out;
let check = false;
const extras = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--tokens') tokens.push(argv[++i]);
  else if (argv[i] === '--out') out = argv[++i];
  else if (argv[i] === '--check') check = true;
  else extras.push(argv[i]);
}
if (tokens.includes(undefined) || (argv.includes('--out') && out === undefined)) {
  console.error('emit-swift: --tokens and --out need a value');
  process.exit(2);
}
if (extras.length > 0) {
  console.error(USAGE);
  process.exit(2);
}

if (tokens.length === 0) {
  const themes = fs.readdirSync(path.join(root, 'themes')).filter((f) => f.endsWith('.css')).sort();
  tokens = [path.join(root, 'tokens.css'), ...themes.map((f) => path.join(root, 'themes', f))];
}
for (const p of tokens) {
  if (!fs.existsSync(p)) { console.error(`emit-swift: no such file: ${p}`); process.exit(2); }
}
out = out ?? path.join(root, 'swift', 'Sources', 'VersevaDesign', 'Generated');

/* The header names inputs relative to the package, so the output is the same on every machine. */
const label = (p) => {
  const rel = path.relative(root, path.resolve(p));
  return (rel.startsWith('..') || path.isAbsolute(rel) ? path.basename(p) : rel).split(path.sep).join('/');
};

let files;
try {
  files = emitSwift(resolveTokens(tokens.map((p) => fs.readFileSync(p, 'utf8')), tokens), { inputs: tokens.map(label) });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const onDisk = fs.existsSync(out) ? fs.readdirSync(out).filter((f) => f.endsWith('.swift')).sort() : [];
const stray = onDisk.filter((f) => !(f in files));

if (check) {
  const problems = [];
  for (const [name, text] of Object.entries(files)) {
    if (!onDisk.includes(name)) problems.push(`${name}: missing`);
    else if (fs.readFileSync(path.join(out, name), 'utf8') !== text) problems.push(`${name}: stale, it no longer matches the token CSS`);
  }
  for (const name of stray) problems.push(`${name}: no theme produces this file`);
  if (problems.length) {
    console.error(`emit-swift: the Swift token files in ${label(out)} are out of date\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\nRegenerate and commit them: npm run tokens:swift');
    process.exit(1);
  }
  console.log(`emit-swift: ${Object.keys(files).length} Swift token files are up to date`);
} else {
  fs.mkdirSync(out, { recursive: true });
  for (const name of stray) fs.rmSync(path.join(out, name));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(out, name), text);
  console.log(`emit-swift: wrote ${Object.keys(files).length} Swift token files to ${label(out)}`);
}
