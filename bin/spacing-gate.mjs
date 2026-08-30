#!/usr/bin/env node
/**
 * verseva-spacing-gate: enforces the SEAM LAW's mechanical half, "rhythm
 * at class level, never per-screen inline margins" (docs/laws.md, law 6).
 * Fails on inline spacing: margin/padding/gap set in a style attribute
 * (HTML) or a style object (JSX). Stylesheet values are class-level and
 * are the contract's business, not this gate's.
 *
 * Usage:
 *   verseva-spacing-gate [--allow <path-substring>]... <file-or-dir>...
 *
 * Rules:
 * - Scans .css .scss .ts .tsx .js .jsx .mjs .cjs .html; node_modules,
 *   .git, .next, dist, build, out are skipped.
 * - A line containing "sp-ok" is exempt (ratified exception, reason in
 *   the adjacent comment).
 * - --allow skips any file whose path contains the given substring.
 * - Exit 1 with file:line listings on violations; exit 0 clean.
 */
import fs from 'node:fs';
import path from 'node:path';

const SCAN_EXT = new Set(['.css', '.scss', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.turbo', '.vercel']);
const ATTR_RE = /(?<![\w-])style\s*=\s*(["'])[^"']*(?:margin|padding|gap)\s*[-:][^"']*\1/i;
const OPEN_RE = /(?<![\w-])style=\{\{/;
const KEY_RE = /\b(?:margin|padding)(?:-[a-z]+|[A-Z][A-Za-z]*)?\s*:|(?<![\w-])(?:gap|rowGap|columnGap)\s*:/;

function parseArgs(argv) {
  const allow = [];
  const paths = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--allow') allow.push(argv[++i]);
    else if (argv[i] === '--tokens') i++; // accepted for runner symmetry, unused
    else paths.push(argv[i]);
  }
  return { allow, paths };
}

function* walk(p) {
  const st = fs.statSync(p);
  if (st.isFile()) {
    yield p;
    return;
  }
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(p, entry.name));
    } else if (SCAN_EXT.has(path.extname(entry.name))) {
      yield path.join(p, entry.name);
    }
  }
}

const { allow, paths } = parseArgs(process.argv.slice(2));
if (paths.length === 0) {
  console.error('usage: verseva-spacing-gate [--allow <substr>] <paths...>');
  process.exit(2);
}

const violations = [];
for (const root of paths) {
  for (const file of walk(root)) {
    const abs = path.resolve(file);
    if (allow.some((a) => abs.includes(a))) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    let styleDepth = 0;
    lines.forEach((line, i) => {
      const exempt = line.includes('sp-ok');
      let scanFrom = null;
      if (styleDepth > 0) {
        scanFrom = line;
      } else {
        const open = line.match(OPEN_RE);
        if (open) scanFrom = line.slice(open.index);
      }
      if (scanFrom !== null) {
        if (!exempt && KEY_RE.test(scanFrom)) violations.push(`${file}:${i + 1}  inline spacing`);
        const opens = (scanFrom.match(/\{/g) ?? []).length;
        const closes = (scanFrom.match(/\}/g) ?? []).length;
        styleDepth = Math.max(0, styleDepth + opens - closes);
      } else if (!exempt && ATTR_RE.test(line)) {
        violations.push(`${file}:${i + 1}  inline spacing`);
      }
    });
  }
}

if (violations.length) {
  console.error(`verseva-spacing-gate: ${violations.length} inline-spacing violation${violations.length === 1 ? '' : 's'}\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error('\nSEAM LAW: rhythm lives at class level. Move the spacing into a class on the scale, or mark a ratified exception with "sp-ok".');
  process.exit(1);
}
console.log('verseva-spacing-gate: clean (no inline spacing)');
