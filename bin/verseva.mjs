#!/usr/bin/env node
/**
 * verseva: the source-distribution CLI. Like the shadcn model, components land
 * in YOUR project as source you own; unlike anything else, the gate suite can
 * prove the result stayed on-signature.
 *
 * Commands: one module each, bin/cmd-<name>.mjs, discovered at startup. A module exports
 *   match   the command word, or an array of them
 *   run     (ctx) => void; it exits when done, or returns to fall through to the help
 *   usage   its help lines
 *   order   a number; the help lists commands in ascending order
 * Adding a command is adding one file. Nothing in this file changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const binDir = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(binDir, '..');
const registry = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'registry.json'), 'utf8'));

const args = process.argv.slice(2);
const flags = { force: args.includes('--force') };
const valueOf = (flag) => {
  const ix = args.indexOf(flag);
  return ix !== -1 ? args[ix + 1] : null;
};
const flagValueIxs = new Set(['--dir', '--output', '--client'].map((f) => {
  const ix = args.indexOf(f);
  return ix === -1 ? -1 : ix + 1;
}));
const dirFlag = valueOf('--dir');
const words = args.filter((a, i) => !a.startsWith('--') && !flagValueIxs.has(i));
const [cmd, ...rest] = words;

/** Parse a project JSON file, or exit 1 with one line naming it (never rewritten). */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    console.error(`verseva: ${file} is not valid JSON; fix or remove it`);
    process.exit(1);
  }
}

/* A symlinked verseva.json is refused before it is read: its target's content never reaches the output. */
if (fs.lstatSync('verseva.json', { throwIfNoEntry: false })?.isSymbolicLink()) {
  console.error('verseva: refused: verseva.json is a symlink; fix or remove it');
  process.exit(1);
}
const config = fs.existsSync('verseva.json') ? readJson('verseva.json') : {};

/** Containment: written filenames flatten to basenames, extensions are
    allowlisted, and an existing symlink destination is refused outright
    (a symlink would carry the write outside the target directory). */
const ALLOWED_EXT = new Set(['.tsx', '.ts', '.jsx', '.js', '.css', '.html']);

function writeFileInto(destDir, name, content) {
  const base = path.basename(name);
  if (!ALLOWED_EXT.has(path.extname(base))) {
    console.error(`refused: ${base} (${path.extname(base) || 'no extension'} is not an installable type; allowed: ${[...ALLOWED_EXT].join(' ')})`);
    process.exit(1);
  }
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, base);
  let existing = null;
  try { existing = fs.lstatSync(dest); } catch { /* new file */ }
  if (existing?.isSymbolicLink()) {
    console.error(`refused: ${dest} is a symlink; will not write through it`);
    process.exit(1);
  }
  if (existing && !flags.force) {
    console.log(`  kept    ${dest} (exists; --force overwrites)`);
    return dest;
  }
  fs.writeFileSync(dest, content);
  console.log(`  wrote   ${dest}`);
  return dest;
}

const rewriteBlockHrefs = (html) => html
  .replace(/href="(?:\.\.\/)+tokens\.css[^"]*"/g, 'href="node_modules/@verseva/design/tokens.css"')
  .replace(/href="(?:\.\.\/)+components\.css[^"]*"/g, 'href="node_modules/@verseva/design/components.css"');

function localItem(name) {
  const comp = registry.components.find((c) => c.name === name);
  if (!comp) return null;
  const src = path.resolve(pkgRoot, comp.file);
  if (!src.startsWith(path.resolve(pkgRoot) + path.sep)) {
    console.error(`refused: registry file ${comp.file} resolves outside the package`);
    process.exit(1);
  }
  return {
    name: comp.name,
    kind: comp.kind,
    description: comp.description,
    deps: comp.deps,
    files: [{ path: comp.file, content: fs.readFileSync(src, 'utf8') }],
  };
}

/* Discovery reads this file's own directory and nothing else: regular files named
   cmd-<name>.mjs. A symlink is not a regular file, so nothing outside bin/ is ever loaded,
   and no path from the arguments or the working directory is imported. */
const RESERVED = new Set(['help', '--help', '-h', '--version']);
const isLines = (v) => Array.isArray(v) && v.every((l) => typeof l === 'string');
const isWords = (v) => v.length > 0 && v.every((w) => typeof w === 'string' && w.length > 0);
const stop = (line) => {
  console.error(`verseva: ${line}`);
  process.exit(1);
};

/* A module that fails to load, lacks one of its four exports, or claims a word that is
   reserved or already taken stops every command with one line naming the file. */
const commands = [];
const claimed = new Map();
const found = fs.readdirSync(binDir, { withFileTypes: true })
  .filter((ent) => ent.isFile() && /^cmd-[a-z0-9-]+\.mjs$/.test(ent.name))
  .map((ent) => ent.name)
  .sort();
for (const name of found) {
  const file = `bin/${name}`;
  let mod;
  try {
    mod = await import(pathToFileURL(path.join(binDir, name)).href);
  } catch (e) {
    stop(`${file} failed to load (${String(e?.message ?? e).split('\n')[0]})`);
  }
  const claims = [mod.match].flat();
  const bad = [
    !isWords(claims) && 'match',
    typeof mod.run !== 'function' && 'run',
    !isLines(mod.usage) && 'usage',
    !Number.isFinite(mod.order) && 'order',
  ].filter(Boolean);
  if (bad.length) stop(`${file} is not a command module (missing or invalid export: ${bad.join(', ')})`);
  for (const word of claims) {
    if (RESERVED.has(word)) stop(`${file} claims the reserved word "${word}"`);
    if (claimed.has(word)) stop(`command "${word}" is claimed by both ${claimed.get(word)} and ${file}`);
    claimed.set(word, file);
  }
  commands.push({ file, claims, run: mod.run, usage: mod.usage, order: mod.order });
}
commands.sort((a, b) => a.order - b.order || a.file.localeCompare(b.file));

const ctx = { pkgRoot, registry, config, rest, dirFlag, valueOf, readJson, writeFileInto, rewriteBlockHrefs, localItem };
const command = commands.find((c) => c.claims.includes(cmd));
if (command) await command.run(ctx);

console.log(['verseva · the source-distribution CLI', '', ...commands.flatMap((c) => c.usage).map((l) => `  ${l}`)].join('\n'));
process.exit(cmd === undefined || cmd === 'help' ? 0 : 2);
