#!/usr/bin/env node
/**
 * resolve-tokens.mjs: prints the resolved token values as JSON, for the
 * signature and every [data-brand] theme, in dark and light. The resolver
 * itself (cascade, var(), color-mix()) is bin/token-resolver.mjs.
 *
 * Usage:
 *   node bin/resolve-tokens.mjs [--tokens <tokens.css> [--tokens <theme.css>]...]
 *                               [--out <file.json>]
 *   npm run tokens:resolve      (the package's own files)
 *
 * Not a published command: the JSON shape is not yet a public contract.
 *
 * Rules:
 * - --tokens files are read in cascade (load) order: tokens.css first, then
 *   theme files. With no --tokens, the package's own tokens.css and every
 *   themes/*.css (sorted by name) are resolved.
 * - JSON goes to stdout, or to --out when given.
 * - Exit 2 on usage errors (missing value, missing file, positional
 *   arguments). Exit 1, with the JSON still written and the offenders listed
 *   on stderr, when any token is unresolved or the CSS cannot be placed in the
 *   cascade. Exit 0 when every token resolved.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTokens } from './token-resolver.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let tokens = [];
let out;
const extras = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--tokens') tokens.push(argv[++i]);
  else if (argv[i] === '--out') out = argv[++i];
  else extras.push(argv[i]);
}
if (tokens.includes(undefined) || (argv.includes('--out') && out === undefined)) {
  console.error('resolve-tokens: --tokens and --out need a value');
  process.exit(2);
}
if (extras.length > 0) {
  console.error('usage: node bin/resolve-tokens.mjs [--tokens <tokens.css> [--tokens <theme.css>]...] [--out <file.json>]');
  process.exit(2);
}
if (tokens.length === 0) {
  const themes = fs.readdirSync(path.join(root, 'themes')).filter((f) => f.endsWith('.css')).sort();
  tokens = [path.join(root, 'tokens.css'), ...themes.map((f) => path.join(root, 'themes', f))];
}
for (const p of tokens) {
  if (!fs.existsSync(p)) { console.error(`resolve-tokens: no such file: ${p}`); process.exit(2); }
}

let resolved;
try {
  resolved = resolveTokens(tokens.map((p) => fs.readFileSync(p, 'utf8')), tokens);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const json = `${JSON.stringify(resolved, null, 2)}\n`;
if (out) fs.writeFileSync(out, json);
else process.stdout.write(json);

if (resolved.unresolved.length) {
  console.error(`resolve-tokens: ${resolved.unresolved.length} unresolved value${resolved.unresolved.length === 1 ? '' : 's'}\n`);
  for (const u of resolved.unresolved) console.error(`  [${u.theme}·${u.mode}] --${u.token}: ${u.value}  (${u.reason})`);
  process.exitCode = 1;
}
