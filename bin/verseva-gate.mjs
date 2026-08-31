#!/usr/bin/env node
/**
 * verseva-gate: the full suite. Runs the hex, contrast, spacing, and
 * type gates with one shared argument set and reports per-gate results.
 * Ratified 2026-08-31 (enforcement ruling: full gate suite).
 *
 * Usage:
 *   verseva-gate --tokens <tokens.css> [--tokens <theme.css>]...
 *                [--allow <path-substring>]... <file-or-dir>...
 *
 * Exit 1 when any gate fails; exit 0 when all four are clean.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const tokens = [];
  const allow = [];
  const paths = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--') { paths.push(...argv.slice(i + 1)); break; }
    if (argv[i] === '--tokens') tokens.push(argv[++i]);
    else if (argv[i] === '--allow') allow.push(argv[++i]);
    else paths.push(argv[i]);
  }
  return { tokens, allow, paths };
}

const { tokens, allow, paths } = parseArgs(process.argv.slice(2));
if (tokens.length === 0 || paths.length === 0) {
  console.error('usage: verseva-gate --tokens <tokens.css> [--tokens ...] [--allow <substr>] <paths...>');
  process.exit(2);
}

const tokenArgs = tokens.flatMap((t) => ['--tokens', t]);
const allowArgs = allow.flatMap((a) => ['--allow', a]);
const GATES = [
  ['hex', 'hex-gate.mjs', [...tokenArgs, ...allowArgs, ...paths]],
  ['contrast', 'contrast-gate.mjs', tokenArgs],
  ['spacing', 'spacing-gate.mjs', [...allowArgs, ...paths]],
  ['type', 'type-gate.mjs', [...tokenArgs, ...allowArgs, ...paths]],
];

let failed = 0;
for (const [name, bin, args] of GATES) {
  try {
    const out = execFileSync(process.execPath, [path.join(here, bin), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(out);
  } catch (e) {
    failed++;
    process.stdout.write(`${e.stdout ?? ''}`);
    process.stderr.write(`${e.stderr ?? ''}`);
    console.error(e.status === 2 || e.status === undefined ? `gate errored: ${name} (usage or config, not a violation)\n` : `gate failed: ${name}\n`);
  }
}

if (failed) {
  console.error(`verseva-gate: ${failed} of ${GATES.length} gates failed`);
  process.exitCode = 1;
} else {
  console.log(`verseva-gate: all ${GATES.length} gates clean`);
}
