#!/usr/bin/env node
/**
 * verseva-type-gate: enforces the TYPE LAW's mechanical half
 * (docs/laws.md, laws 4-5). Fails on (a) a font-family declaration that
 * does not draw from the type trio tokens, (b) a font-size below the
 * shipped contract's floor of 9.5px (the navshell tab label, the
 * smallest type in canon).
 *
 * Usage:
 *   verseva-type-gate --tokens <tokens.css> [--tokens <theme.css>]...
 *                     [--allow <path-substring>]... <file-or-dir>...
 *
 * Rules:
 * - Token files themselves are exempt (they define the stacks).
 * - A font-family declaration OR a `font:` shorthand passes when it
 *   references var(--font-...) or inherit; anything naming faces
 *   directly fails.
 * - The size floor reads every px/rem/em/pt literal inside font-size
 *   and font shorthand values (so a clamp() lower bound counts).
 *   rem/em convert at a 16px root; a 62.5%-root project should pass
 *   --allow for its scale files and rely on px audits instead.
 * - Scans .css .scss .ts .tsx .js .jsx .mjs .cjs .html; node_modules,
 *   .git, .next, dist, build, out are skipped.
 * - A line containing "type-ok" is exempt (ratified exception, reason in
 *   the adjacent comment).
 * - --allow skips any file whose path contains the given substring.
 * - Exit 1 with file:line listings on violations; exit 0 clean.
 */
import fs from 'node:fs';
import path from 'node:path';

const SCAN_EXT = new Set(['.css', '.scss', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.turbo', '.vercel']);
const FLOOR_PX = 9.5;

function parseArgs(argv) {
  const tokens = [];
  const allow = [];
  const paths = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--tokens') tokens.push(argv[++i]);
    else if (argv[i] === '--allow') allow.push(argv[++i]);
    else paths.push(argv[i]);
  }
  return { tokens, allow, paths };
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

const { tokens, allow, paths } = parseArgs(process.argv.slice(2));
if (paths.length === 0) {
  console.error('usage: verseva-type-gate [--tokens <tokens.css>] [--allow <substr>] <paths...>');
  process.exit(2);
}
const tokenFiles = new Set(tokens.map((t) => path.resolve(t)));

const violations = [];
for (const root of paths) {
  for (const file of walk(root)) {
    const abs = path.resolve(file);
    if (tokenFiles.has(abs)) continue;
    if (allow.some((a) => abs.includes(a))) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes('type-ok')) return;
      if (/font-family\s*:/.test(line) && !/var\(--font-|inherit/.test(line)) {
        violations.push(`${file}:${i + 1}  off-token font-family`);
      }
      for (const m of line.matchAll(/(?:^|[;{])\s*font\s*:\s*([^;{}]+)/g)) {
        if (!/var\(--font-|inherit/.test(m[1])) {
          violations.push(`${file}:${i + 1}  off-token font shorthand`);
        }
      }
      for (const m of line.matchAll(/\bfont(?:-size)?\s*:\s*([^;{}]+)/g)) {
        for (const u of m[1].matchAll(/([\d.]+)(px|rem|em|pt)\b/g)) {
          const n = parseFloat(u[1]);
          const px = u[2] === 'px' ? n : u[2] === 'pt' ? n * (96 / 72) : n * 16;
          if (px < FLOOR_PX) violations.push(`${file}:${i + 1}  ${u[1]}${u[2]} below ${FLOOR_PX}px floor`);
        }
      }
    });
  }
}

if (violations.length) {
  console.error(`verseva-type-gate: ${violations.length} type violation${violations.length === 1 ? '' : 's'}\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error('\nTYPE LAW: faces come from the trio tokens; nothing renders below the contract floor. Mark a ratified exception with "type-ok".');
  process.exit(1);
}
console.log('verseva-type-gate: clean (trio faces, sizes on floor)');
