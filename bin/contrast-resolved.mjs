#!/usr/bin/env node
/**
 * contrast-resolved.mjs: holds the resolved token values to the contract's
 * contrast floors, for the signature and every [data-brand] theme, in dark
 * and light. These are the values the Swift token files are generated from
 * (bin/emit-swift.mjs), so the native edition answers to the same floors as
 * the web.
 *
 * Usage:
 *   node bin/contrast-resolved.mjs [--tokens <tokens.css> [--tokens <theme.css>]...]
 *
 * Not registered as a package command: it ships in bin/ with the package, but
 * package.json gives it no bin entry and its flags are not a public contract.
 *
 * Rules:
 * - --tokens files are read in cascade (load) order: tokens.css first, then
 *   theme files. With no --tokens, the package's own tokens.css and every
 *   themes/*.css (sorted by name) are measured. A brand theme kept outside
 *   the package is measured the same way: --tokens tokens.css --tokens
 *   <path>/theme.css.
 * - The values come from bin/token-resolver.mjs. The pair list
 *   (bin/contrast-pairs.mjs), the compositing and the formula
 *   (bin/contrast-measure.mjs) are the ones verseva-contrast-gate uses.
 * - A pair whose tokens did not resolve to a color is a FAILURE, never a
 *   skip.
 * - Any token the resolver could not resolve fails the run, in the pair list
 *   or not, as it does in emit-swift and resolve-tokens: each is listed with
 *   its theme, mode and reason.
 * - Exit 1 with the failing pairs and ratios, with the unresolved tokens, or
 *   when the CSS cannot be placed in the cascade; exit 0 clean, stating the
 *   measured-pair count.
 *   Exit 2 on usage errors. VERSEVA_GATE_VERBOSE=1 prints every passing pair.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTokens } from './token-resolver.mjs';
import { measureResolved } from './contrast-measure.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let tokens = [];
const extras = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--tokens') tokens.push(argv[++i]);
  else extras.push(argv[i]);
}
if (tokens.includes(undefined)) { console.error('contrast-resolved: --tokens needs a value'); process.exit(2); }
if (extras.length > 0) {
  console.error('usage: node bin/contrast-resolved.mjs [--tokens <tokens.css> [--tokens <theme.css>]...]');
  process.exit(2);
}
if (tokens.length === 0) {
  const themes = fs.readdirSync(path.join(root, 'themes')).filter((f) => f.endsWith('.css')).sort();
  tokens = [path.join(root, 'tokens.css'), ...themes.map((f) => path.join(root, 'themes', f))];
}
for (const p of tokens) {
  if (!fs.existsSync(p)) { console.error(`contrast-resolved: no such file: ${p}`); process.exit(2); }
}

let resolved;
let m;
try {
  resolved = resolveTokens(tokens.map((p) => fs.readFileSync(p, 'utf8')), tokens);
  m = measureResolved(resolved);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

if (process.env.VERSEVA_GATE_VERBOSE) for (const line of m.passes) console.log(`  ok ${line}`);
if (m.failures.length) {
  console.error(`contrast-resolved: ${m.failures.length} failure${m.failures.length === 1 ? '' : 's'} (${m.measured} pairs measured)\n`);
  for (const f of m.failures) console.error(`  ${f}`);
  console.error('\nContrast floors are craft law: lift the token value; never ship the pair.');
}
const { unresolved } = resolved;
if (unresolved.length) {
  console.error(`${m.failures.length ? '\n' : ''}contrast-resolved: ${unresolved.length} unresolved value${unresolved.length === 1 ? '' : 's'}\n`);
  for (const u of unresolved) console.error(`  [${u.theme}·${u.mode}] --${u.token}: ${u.value}  (${u.reason})`);
}
if (m.failures.length || unresolved.length) process.exit(1);
console.log(`contrast-resolved: clean (${m.measured} pairs measured across ${m.contexts.length} themes, 0 skipped)`);
