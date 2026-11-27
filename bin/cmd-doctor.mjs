/**
 * verseva doctor: how far this product's @verseva/design lags the latest release, and every
 * place its own CSS overrides a package class.
 *
 * Trust boundary. Of the consumer's files it reads only inside the working directory: the root
 * is resolved to its real path once, symlinks are never followed (a symlinked package.json,
 * package-lock.json or verseva.json is refused), every file read is re-checked by real path, and
 * node_modules, dot directories and the verseva.json "dir" are not scanned. The one package file
 * it reads is this package's own components.css, for the contract class set. The one network call is a single HTTPS GET to the
 * public npm registry for the latest version, with a short timeout and no redirects; offline it
 * prints "latest unknown" and still reports overrides. Nothing is sent and nothing is written.
 *
 * Exit 0 always; --strict exits 1 when any override exists; 2 on error.
 * --json prints one object (schema 1, documented in the README):
 *   { schema, package, declared, installed, installedFrom, latest, lag, overrides: [{ file, line, selector, classes }] }
 */
import fs from 'node:fs';
import path from 'node:path';
import { contractClasses } from './contract-classes.mjs';

export const match = 'doctor';
export const order = 65;
export const usage = ['npx verseva doctor [--json] [--strict]'];

const PKG = '@verseva/design';
const LATEST_URL = 'https://registry.npmjs.org/@verseva/design/latest';
const TIMEOUT_MS = 5000;
const SEMVER = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})(?:-[0-9A-Za-z.-]{1,64})?$/;

class DoctorError extends Error {}

/* Text output never carries a control character from a file name or a selector. */
const printable = (s) => String(s).replace(/[\u0000-\u001f\u007f-\u009f]/g, '?');

/** A regular file directly in root, read as JSON; null when absent. Symlinks are refused. */
function readLocalJson(root, name) {
  const file = path.join(root, name);
  let st;
  try { st = fs.lstatSync(file); } catch { return null; }
  if (st.isSymbolicLink()) throw new DoctorError(`refused: ${name} is a symlink; doctor reads only inside the working directory`);
  if (!st.isFile()) throw new DoctorError(`${name} is not a regular file`);
  if (!fs.realpathSync(file).startsWith(root + path.sep)) throw new DoctorError(`refused: ${name} resolves outside the working directory`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new DoctorError(`${name} is not valid JSON (${printable(e.message)})`);
  }
}

function versions(root) {
  const pkg = readLocalJson(root, 'package.json');
  if (!pkg) throw new DoctorError('no package.json in the working directory');
  const declared = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .map((k) => pkg?.[k]?.[PKG])
    .find((v) => typeof v === 'string') ?? null;
  const lock = readLocalJson(root, 'package-lock.json');
  const locked = lock?.packages?.[`node_modules/${PKG}`]?.version ?? lock?.dependencies?.[PKG]?.version;
  if (typeof locked === 'string' && SEMVER.test(locked)) return { declared, installed: locked, installedFrom: 'package-lock.json' };
  if (declared && SEMVER.test(declared)) return { declared, installed: declared, installedFrom: 'package.json' };
  return { declared, installed: null, installedFrom: null };
}

/** The latest published version, or null on any failure. One GET, no redirects, no headers. */
async function latestVersion() {
  try {
    const res = await fetch(LATEST_URL, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const v = JSON.parse(await res.text())?.version;
    return typeof v === 'string' && SEMVER.test(v) ? v : null;
  } catch {
    return null;
  }
}

/* Lag at the first level that differs; the levels below it are 0. Ahead of latest is no lag. */
function lagOf(installed, latest) {
  if (!installed || !latest) return null;
  const a = installed.split(/[.-]/).slice(0, 3).map(Number);
  const b = latest.split(/[.-]/).slice(0, 3).map(Number);
  const lag = { major: 0, minor: 0, patch: 0 };
  const keys = ['major', 'minor', 'patch'];
  for (let i = 0; i < 3; i++) {
    if (a[i] === b[i]) continue;
    if (a[i] < b[i]) lag[keys[i]] = b[i] - a[i];
    break;
  }
  return lag;
}

/** Every .css file under root, as [absolute, relative posix], never through a symlink. */
function cssFiles(root, excluded) {
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.isSymbolicLink()) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name.startsWith('.') || full === excluded) continue;
        walk(full);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.css')) {
        if (!fs.realpathSync(full).startsWith(root + path.sep)) continue;
        out.push([full, path.relative(root, full).split(path.sep).join('/')]);
      }
    }
  };
  walk(root);
  return out;
}

/* The verseva.json dir, when it names a directory strictly inside root; otherwise nothing is excluded. */
function excludedDir(root, dir) {
  if (typeof dir !== 'string' || !dir) return null;
  const abs = path.resolve(root, dir);
  const rel = path.relative(root, abs);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? abs : null;
}

const blank = (m) => m.replace(/[^\n]/g, ' ');
const FILTER_PSEUDO = /:(?!is\(|where\()[\w-]+\((?:[^()]|\([^()]*\))*\)/g;

/** Split a selector list at top-level commas, keeping each part's offset. */
function splitList(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if ((c === ',' && depth === 0) || i === text.length) {
      parts.push([start, text.slice(start, i)]);
      start = i + 1;
    }
  }
  return parts;
}

/** One row per selector (a list gives one row per member) that styles a contract class. */
export function overridesIn(css, classes) {
  /* Comments and string contents blanked to spaces, so offsets and lines stay true. */
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, blank);
  const clean = noComments.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => m[0] + ' '.repeat(m.length - 2) + m[0]);
  const lineStarts = [0];
  for (let i = 0; i < clean.length; i++) if (clean[i] === '\n') lineStarts.push(i + 1);
  const lineAt = (offset) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
  const rows = [];
  for (const m of clean.matchAll(/[^{}]+\{/g)) {
    const raw = m[0].slice(0, -1);
    const cut = raw.lastIndexOf(';') + 1;
    const prelude = raw.slice(cut);
    const lead = prelude.length - prelude.trimStart().length;
    const body = prelude.trim();
    if (!body || body.startsWith('@') || /^(?:from|to|[\d.]+%)(?![\w-])/.test(body)) continue;
    const base = m.index + cut + lead;
    for (const [at, part] of splitList(clean.slice(base, base + body.length))) {
      const sel = part.replace(/\[[^\]]*\]/g, ' ').replace(FILTER_PSEUDO, ' ');
      const hit = [...new Set([...sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((x) => x[1]).filter((c) => classes.has(c)))];
      if (!hit.length) continue;
      const trimmedAt = base + at + (part.length - part.trimStart().length);
      const original = noComments.slice(trimmedAt, trimmedAt + part.trim().length).replace(/\s+/g, ' ');
      rows.push({ line: lineAt(trimmedAt), selector: original, classes: hit });
    }
  }
  return rows;
}

function lagText(r) {
  if (!r.installed || !r.latest) return 'unknown';
  const { major, minor, patch } = r.lag;
  if (major) return `${major} major behind`;
  if (minor) return `${minor} minor behind`;
  if (patch) return `${patch} patch behind`;
  return 'up to date';
}

function text(r) {
  const sources = [r.installedFrom === 'package-lock.json' && 'package-lock.json', r.declared && `package.json ${r.declared}`].filter(Boolean);
  const installed = r.installed ?? (r.declared ? 'unknown' : 'not a dependency');
  const lines = [
    'verseva doctor',
    `  package    ${PKG}`,
    `  installed  ${installed}${sources.length ? ` (${sources.join('; ')})` : ''}`,
    `  latest     ${r.latest ?? 'unknown'}`,
    `  lag        ${lagText(r)}`,
    `  overrides  ${r.overrides.length}`,
    ...r.overrides.map((o) => `  ${o.file}:${o.line}  ${o.selector}  (${o.classes.join(', ')})`),
  ];
  return lines.map(printable).join('\n');
}

export async function run({ rest, config }) {
  if (rest.length) return;
  const json = process.argv.includes('--json');
  const strict = process.argv.includes('--strict');
  try {
    const root = fs.realpathSync(process.cwd());
    let cfg = null;
    try { cfg = fs.lstatSync(path.join(root, 'verseva.json')); } catch { /* none */ }
    if (cfg?.isSymbolicLink()) throw new DoctorError('refused: verseva.json is a symlink; doctor reads only inside the working directory');
    const v = versions(root);
    const classes = contractClasses();
    const overrides = [];
    for (const [abs, rel] of cssFiles(root, excludedDir(root, config?.dir))) {
      for (const row of overridesIn(fs.readFileSync(abs, 'utf8'), classes)) overrides.push({ file: rel, ...row });
    }
    overrides.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
    const latest = await latestVersion();
    const report = { schema: 1, package: PKG, ...v, latest, lag: lagOf(v.installed, latest), overrides };
    const out = `${json ? JSON.stringify(report, null, 2) : text(report)}\n`;
    /* A pipe can take stdout asynchronously: wait for the write before exiting, or a long report is cut. */
    await new Promise((resolve) => process.stdout.write(out, resolve));
    process.exit(strict && overrides.length ? 1 : 0);
  } catch (e) {
    console.error(`verseva doctor: ${e instanceof DoctorError ? e.message : printable(String(e?.message ?? e).split('\n')[0])}`);
    process.exit(2);
  }
}
