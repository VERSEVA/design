#!/usr/bin/env node
/**
 * verseva: the source-distribution CLI. Like the shadcn model, components land
 * in YOUR project as source you own; unlike anything else, the gate suite can
 * prove the result stayed on-signature.
 *
 * Commands:
 *   verseva list                       what the registry holds
 *   verseva init                       verseva.json + a "gate" script + import hints
 *   verseva add <name...> [--dir d] [--force]
 *       name forms: bare (this package's registry), @ns/name (a namespace from
 *       verseva.json "registries"), a full https URL, or a local .json item file
 *   verseva block add <name> [--dir d] [--force]
 *   verseva theme add <name> [--dir d] [--force]   gate-proven accent presets
 *   verseva build [--output d]         flatten the registry into hostable
 *                                      per-item JSON (default site/r)
 *   verseva mcp init [--client claude|cursor|vscode]
 *                                      wire the verseva MCP server for agents
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { list } from './cmd-list.mjs';
import { init } from './cmd-init.mjs';
import { add } from './cmd-add.mjs';
import { block } from './cmd-block.mjs';
import { theme } from './cmd-theme.mjs';
import { build } from './cmd-build.mjs';
import { mcp } from './cmd-mcp.mjs';

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  } catch (e) {
    console.error(`verseva: ${file} is not valid JSON (${e.message}); fix or remove it`);
    process.exit(1);
  }
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

/* One file per subcommand (bin/cmd-<name>.mjs), one dispatch line each. Every command exits. */
const ctx = { pkgRoot, registry, config, rest, dirFlag, valueOf, readJson, writeFileInto, rewriteBlockHrefs, localItem };

if (cmd === 'list') list(ctx);
if (cmd === 'init') init(ctx);
if (cmd === 'add' && rest[0] !== undefined) await add(ctx);
if (cmd === 'block' && rest[0] === 'add' && rest[1]) block(ctx);
if (cmd === 'theme' && rest[0] === 'add' && rest[1]) theme(ctx);
if (cmd === 'build') build(ctx);
if (cmd === 'mcp' && rest[0] === 'init') mcp(ctx);

console.log(`verseva · the source-distribution CLI

  npx verseva list
  npx verseva init
  npx verseva add <name | @ns/name | url | file.json ...> [--dir d] [--force]
  npx verseva block add <name> [--dir d] [--force]
  npx verseva theme add <name> [--dir d] [--force]
  npx verseva build [--output d]
  npx verseva mcp init [--client claude|cursor|vscode]`);
process.exit(cmd === undefined || cmd === 'help' ? 0 : 2);
