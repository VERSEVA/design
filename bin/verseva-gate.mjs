#!/usr/bin/env node
/**
 * verseva-gate: the full suite. Runs the hex, contrast, spacing, and
 * type gates with one shared argument set and reports per-gate results.
 * Ratified 2026-08-31 (enforcement ruling: full gate suite).
 *
 * Usage:
 *   verseva-gate --tokens <tokens.css> [--tokens <theme.css>]...
 *                [--allow <path-substring>]... [--exclude <dir>]...
 *                <file-or-dir>...
 *
 * Exit 1 when any gate finds violations; exit 2 when none does but one
 * errored (usage or config, e.g. a missing path); exit 0 when all four
 * are clean.
 *
 * After the four gates and their summary, the recipe gate runs as an
 * advisory gate (law 13, amended 2026-11-27): its findings print under an
 * "advisory" heading and never change the exit code, even when it errors.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const tokens = [];
  const allow = [];
  const exclude = [];
  const paths = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--') { paths.push(...argv.slice(i + 1)); break; }
    if (argv[i] === '--tokens') tokens.push(argv[++i]);
    else if (argv[i] === '--allow') allow.push(argv[++i]);
    else if (argv[i] === '--exclude') exclude.push(argv[++i]);
    else paths.push(argv[i]);
  }
  return { tokens, allow, exclude, paths };
}

const { tokens, allow, exclude, paths } = parseArgs(process.argv.slice(2));
for (const [flag, vals] of [['--tokens', tokens], ['--allow', allow], ['--exclude', exclude]]) {
  if (vals.includes(undefined)) { console.error(`verseva-gate: ${flag} needs a value`); process.exit(2); }
}
if (tokens.length === 0 || paths.length === 0) {
  console.error('usage: verseva-gate --tokens <tokens.css> [--tokens ...] [--allow <substr>] [--exclude <dir>] <paths...>');
  process.exit(2);
}

const tokenArgs = tokens.flatMap((t) => ['--tokens', t]);
const allowArgs = allow.flatMap((a) => ['--allow', a]);
const excludeArgs = exclude.flatMap((x) => ['--exclude', x]);
const GATES = [
  ['hex', 'hex-gate.mjs', [...tokenArgs, ...allowArgs, ...excludeArgs, ...paths]],
  ['contrast', 'contrast-gate.mjs', tokenArgs],
  ['spacing', 'spacing-gate.mjs', [...allowArgs, ...excludeArgs, ...paths]],
  ['type', 'type-gate.mjs', [...tokenArgs, ...allowArgs, ...excludeArgs, ...paths]],
];
/* Advisory gates: printed after the summary, never counted, never in the exit code. */
const ADVISORY = [
  ['recipe', 'recipe-gate.mjs', [...allowArgs, ...excludeArgs, '--', ...paths]],
];

let failed = 0;
let errored = 0;
for (const [name, bin, args] of GATES) {
  try {
    const out = execFileSync(process.execPath, [path.join(here, bin), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(out);
  } catch (e) {
    process.stdout.write(`${e.stdout ?? ''}`);
    process.stderr.write(`${e.stderr ?? ''}`);
    if (e.status === 2 || e.status === undefined) {
      errored++;
      console.error(`gate errored: ${name} (usage or config, not a violation)\n`);
    } else {
      failed++;
      console.error(`gate failed: ${name}\n`);
    }
  }
}

if (failed) {
  console.error(`verseva-gate: ${failed} of ${GATES.length} gates failed`);
  process.exitCode = 1;
} else if (errored) {
  console.error(`verseva-gate: ${errored} of ${GATES.length} gates errored`);
  process.exitCode = 2;
} else {
  console.log(`verseva-gate: all ${GATES.length} gates clean`);
}

for (const [name, bin, args] of ADVISORY) {
  console.log(`\nadvisory: ${name} gate (never changes the exit code)`);
  const r = spawnSync(process.execPath, [path.join(here, bin), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(r.stdout ?? '');
  process.stderr.write(r.stderr ?? '');
  if (r.status !== 0) console.error(`advisory gate errored: ${name} (exit code unchanged)`);
}
