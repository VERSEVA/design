#!/usr/bin/env node
/**
 * emit-swift.mjs: writes the Swift token files, one per theme, from
 * tokens.css and the brand themes. The mapping from web to native is
 * bin/swift-emitter.mjs; the values come from bin/token-resolver.mjs.
 *
 * Usage:
 *   node bin/emit-swift.mjs [--tokens <tokens.css> [--tokens <theme.css>]...]
 *                           [--brand <name>] [--out <dir>] [--check]
 *   npm run tokens:swift    (the package's own files, into swift/)
 *
 * Not registered as a package command: it ships in bin/ with the package, but
 * package.json gives it no bin entry and its flags are not a public contract.
 *
 * Rules:
 * - --tokens files are read in cascade (load) order: tokens.css first, then
 *   theme files. With no --tokens, the package's own tokens.css and every
 *   themes/*.css (sorted by name) are used.
 * - --out is the directory written to (default
 *   swift/Sources/VersevaDesign/Generated). It must hold no hand-written
 *   Swift: if any *.swift in it does not start with the GENERATED header,
 *   nothing is written or removed and the file is named (exit 1). The only
 *   files ever removed are ones this script wrote that no theme produces any
 *   more: named *Tokens.swift and starting with the GENERATED header.
 * - --brand limits the run to one theme's file: a brand slug from the
 *   inputs, or "signature". A brand that keeps its theme.css outside the
 *   package generates its own file with
 *     --tokens tokens.css --tokens <path>/theme.css --brand <slug> --out <dir>
 *   and nothing else is written. Other themes' files already in --out are
 *   left as they are; --check then reads that one file only. A name the
 *   inputs do not hold is a usage error.
 * - --check writes nothing. It regenerates in memory and compares with the
 *   files in --out: exit 1, naming each stale, missing, stray or
 *   hand-written file, when they differ; exit 0 when they match. npm test
 *   runs it.
 * - Exit 2 on usage errors. Exit 1 when the CSS cannot be resolved or a
 *   token is neither mapped nor excluded.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTokens } from './token-resolver.mjs';
import { emitSwift, GENERATED_HEADER } from './swift-emitter.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: node bin/emit-swift.mjs [--tokens <tokens.css> [--tokens <theme.css>]...] [--brand <name>] [--out <dir>] [--check]';

let tokens = [];
let out;
let brand;
let check = false;
const extras = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--tokens') tokens.push(argv[++i]);
  else if (argv[i] === '--out') out = argv[++i];
  else if (argv[i] === '--brand') brand = argv[++i];
  else if (argv[i] === '--check') check = true;
  else extras.push(argv[i]);
}
if (tokens.includes(undefined) || (argv.includes('--out') && out === undefined) || (argv.includes('--brand') && brand === undefined)) {
  console.error('emit-swift: --tokens, --out and --brand need a value');
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

let resolved;
let produced;
try {
  resolved = resolveTokens(tokens.map((p) => fs.readFileSync(p, 'utf8')), tokens);
  produced = emitSwift(resolved, { inputs: tokens.map(label) });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
/* --brand: write and check that theme's file only. `produced` stays the whole set, so the
   other themes' files in --out are not taken for strays. */
let files = produced;
if (brand !== undefined) {
  const names = Object.keys(resolved.themes).sort();
  if (!names.includes(brand)) {
    console.error(`emit-swift: no theme named ${JSON.stringify(brand)} in the inputs (found: ${names.join(', ')})`);
    process.exit(2);
  }
  files = emitSwift({ themes: { [brand]: resolved.themes[brand] }, unresolved: [] }, { inputs: tokens.map(label) });
}

const onDisk = fs.existsSync(out) ? fs.readdirSync(out).filter((f) => f.endsWith('.swift')).sort() : [];
/* Hand-written Swift: anything that does not open with the GENERATED header. Never touched. */
const foreign = onDisk.filter((f) => !fs.readFileSync(path.join(out, f), 'utf8').startsWith(`${GENERATED_HEADER}\n`));
/* Ours to remove: generated (the header), named like a theme file, and no longer produced. */
const stray = onDisk.filter((f) => !(f in produced) && !foreign.includes(f) && f.endsWith('Tokens.swift'));

if (check) {
  const problems = [];
  for (const [name, text] of Object.entries(files)) {
    if (!onDisk.includes(name)) problems.push(`${name}: missing`);
    else if (foreign.includes(name)) continue;
    else if (fs.readFileSync(path.join(out, name), 'utf8') !== text) problems.push(`${name}: stale, it no longer matches the token CSS`);
  }
  for (const name of stray) problems.push(`${name}: no theme produces this file`);
  for (const name of foreign) problems.push(`${name}: not a generated file (no GENERATED header); hand-written Swift does not belong in this folder`);
  if (problems.length) {
    console.error(`emit-swift: the Swift token files in ${label(out)} are out of date\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\nRegenerate and commit them: npm run tokens:swift');
    process.exit(1);
  }
  console.log(`emit-swift: ${Object.keys(files).length} Swift token files are up to date`);
} else {
  if (foreign.length) {
    console.error(`emit-swift: refusing to write into ${label(out)}: it holds Swift this script did not generate\n`);
    for (const name of foreign) console.error(`  ${name}: not a generated file (no GENERATED header)`);
    console.error('\nNothing was written or removed. Point --out at a folder that holds only generated files.');
    process.exit(1);
  }
  fs.mkdirSync(out, { recursive: true });
  for (const name of stray) fs.rmSync(path.join(out, name));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(out, name), text);
  console.log(`emit-swift: wrote ${Object.keys(files).length} Swift token files to ${label(out)}`);
}
