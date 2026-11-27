/**
 * verseva doctor: how far this product's @verseva/design lags the latest release, and every
 * place its own CSS overrides a package class.
 *
 * Trust boundary. Of the consumer's files it reads only inside the working directory: the root
 * is resolved to its real path once, symlinks are never followed (a symlinked package.json or
 * package-lock.json is refused here, a symlinked verseva.json by bin/verseva.mjs), every file
 * read is re-checked by real path, node_modules, dot directories and the verseva.json "dir" are
 * not scanned, and a CSS file over 1 MB is skipped and named. The one package file it reads is
 * this package's own components.css, for the contract class set. The one network call is a
 * single HTTPS GET to the public npm registry for the latest version, with a short timeout, no
 * redirects and a 1 MB cap on the answer; offline it prints "latest unknown" and still reports
 * overrides. Nothing is sent and nothing is written. The CSS scan is linear in the file size.
 *
 * Exit 0 always; --strict exits 1 when any override exists; 2 on error. A reader that closes
 * the pipe early does not change the exit code.
 * --json prints one object (schema 1, documented in the README):
 *   { schema, package, declared, installed, installedFrom, latest, lag, state,
 *     overrides: [{ file, line, selector, classes }], skipped: [{ file, reason }] }
 */
import fs from 'node:fs';
import path from 'node:path';

export const match = 'doctor';
export const order = 65;
export const usage = ['npx verseva doctor [--json] [--strict]'];

const PKG = '@verseva/design';
const LATEST_URL = 'https://registry.npmjs.org/@verseva/design/latest';
const TIMEOUT_MS = 5000;
const MAX_BYTES = 1024 * 1024;
const SEMVER = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})(?:-([0-9A-Za-z.-]{1,64}))?$/;

class DoctorError extends Error {}

/* Text output never carries a control or bidirectional formatting character from a file name or a selector. */
const printable = (s) => String(s).replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, '?');

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

/** The latest published version, or null on any failure. One GET, no redirects, no headers, at most 1 MB read. */
async function latestVersion() {
  try {
    const res = await fetch(LATEST_URL, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok || !res.body) return null;
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > MAX_BYTES) return null;
      chunks.push(chunk);
    }
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8'))?.version;
    return typeof v === 'string' && SEMVER.test(v) ? v : null;
  } catch {
    return null;
  }
}

/* Semver precedence: numbers first, then a prerelease sorts before its release. */
function compare(a, b) {
  const [, ...pa] = a.match(SEMVER);
  const [, ...pb] = b.match(SEMVER);
  for (let i = 0; i < 3; i++) if (Number(pa[i]) !== Number(pb[i])) return Number(pa[i]) - Number(pb[i]);
  if (!pa[3] || !pb[3]) return (pa[3] ? -1 : 0) - (pb[3] ? -1 : 0);
  const x = pa[3].split('.');
  const y = pb[3].split('.');
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === undefined) return -1;
    if (y[i] === undefined) return 1;
    if (x[i] === y[i]) continue;
    const nx = /^\d+$/.test(x[i]);
    const ny = /^\d+$/.test(y[i]);
    if (nx && ny) return Number(x[i]) - Number(y[i]);
    if (nx !== ny) return nx ? -1 : 1;
    return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}

/* State behind | current | ahead. Lag counts the first numeric level that differs, the levels
   below it 0; a prerelease of the latest release is behind with no numeric lag. */
function lagOf(installed, latest) {
  if (!installed || !latest) return { lag: null, state: null };
  const c = compare(installed, latest);
  const lag = { major: 0, minor: 0, patch: 0 };
  if (c >= 0) return { lag, state: c === 0 ? 'current' : 'ahead' };
  const a = installed.match(SEMVER).slice(1, 4).map(Number);
  const b = latest.match(SEMVER).slice(1, 4).map(Number);
  const keys = ['major', 'minor', 'patch'];
  const i = [0, 1, 2].find((k) => a[k] !== b[k]);
  if (i !== undefined) lag[keys[i]] = b[i] - a[i];
  return { lag, state: 'behind' };
}

/** Every .css file under root, never through a symlink; files over 1 MB go to skipped. */
function cssFiles(root, excluded) {
  const files = [];
  const skipped = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.isSymbolicLink()) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name.startsWith('.') || full === excluded) continue;
        walk(full);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.css')) {
        if (!fs.realpathSync(full).startsWith(root + path.sep)) continue;
        const rel = path.relative(root, full).split(path.sep).join('/');
        if (fs.lstatSync(full).size > MAX_BYTES) skipped.push({ file: rel, reason: 'over 1 MB' });
        else files.push([full, rel]);
      }
    }
  };
  walk(root);
  return { files, skipped };
}

/* The verseva.json dir, when it names a directory strictly inside root; otherwise nothing is excluded. */
function excludedDir(root, dir) {
  if (typeof dir !== 'string' || !dir) return null;
  const abs = path.resolve(root, dir);
  const rel = path.relative(root, abs);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? abs : null;
}

/** One pass: comments blanked in the first copy; comments and string contents in the second.
    Newlines are kept, so offsets and line numbers stay true. Unclosed runs to the end. */
function mask(css) {
  const a = [];
  const b = [];
  let i = 0;
  const n = css.length;
  const run = (from, to, keepEnds, strings) => {
    for (let k = from; k < to; k++) {
      const c = css[k];
      const keep = c === '\n' || (keepEnds && (k === from || k === to - 1));
      a.push(strings || keep ? c : ' ');
      b.push(keep ? c : ' ');
    }
  };
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const to = end === -1 ? n : end + 2;
      run(i, to, false, false);
      i = to;
    } else if (c === '"' || c === "'") {
      let k = i + 1;
      while (k < n && css[k] !== c && css[k] !== '\n') k += css[k] === '\\' ? 2 : 1;
      const to = Math.min(n, css[k] === c ? k + 1 : k);
      run(i, to, true, true);
      i = to;
    } else {
      a.push(c);
      b.push(c);
      i++;
    }
  }
  return [a.join(''), b.join('')];
}

/* Deeper parenthesis nesting than this makes a selector unreadable: its file is skipped. */
const MAX_DEPTH = 32;
class NestingError extends Error {}

/** The selector with :not(), :has() and every other filtering functional pseudo-class removed
    (their contents too, however nested); :is() and :where() keep their contents. One linear
    pass with a stack, no recursion; nesting over MAX_DEPTH throws NestingError. */
function stylingPart(sel) {
  let out = '';
  const stack = [];
  let dropping = 0;
  let i = 0;
  while (i < sel.length) {
    const c = sel[i];
    const m = c === ':' ? /^::?([\w-]+)\(/.exec(sel.slice(i, i + 64)) : null;
    if (m || c === '(') {
      const drop = m ? !(m[1] === 'is' || m[1] === 'where') : false;
      stack.push(drop);
      if (stack.length > MAX_DEPTH) throw new NestingError(`nesting over ${MAX_DEPTH}`);
      if (drop) dropping++;
      out += ' ';
      i += m ? m[0].length : 1;
    } else if (c === ')') {
      if (stack.length && stack.pop()) dropping--;
      out += ' ';
      i++;
    } else {
      out += dropping ? ' ' : c;
      i++;
    }
  }
  return out;
}

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
  const [noComments, clean] = mask(css);
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
  /* A linear scan for braces: each prelude runs from the last brace to the next "{". */
  let segment = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '}') { segment = i + 1; continue; }
    if (ch !== '{') continue;
    const raw = clean.slice(segment, i);
    segment = i + 1;
    const cut = raw.lastIndexOf(';') + 1;
    const prelude = raw.slice(cut);
    const lead = prelude.length - prelude.trimStart().length;
    const body = prelude.trim();
    if (!body || body.startsWith('@') || /^(?:from|to|[\d.]+%)(?![\w-])/.test(body)) continue;
    const base = i - raw.length + cut + lead;
    for (const [at, part] of splitList(clean.slice(base, base + body.length))) {
      const sel = stylingPart(part.replace(/\[[^\]]*\]/g, ' '));
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
  if (!r.state) return 'unknown';
  if (r.state === 'current') return 'up to date';
  if (r.state === 'ahead') return 'ahead of latest';
  const { major, minor, patch } = r.lag;
  if (major) return `${major} major behind`;
  if (minor) return `${minor} minor behind`;
  if (patch) return `${patch} patch behind`;
  return 'behind (prerelease)';
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
    ...r.skipped.map((s) => `  skipped    ${s.file} (${s.reason})`),
  ];
  return lines.map(printable).join('\n');
}

export async function run({ rest, config }) {
  if (rest.length) return;
  const json = process.argv.includes('--json');
  const strict = process.argv.includes('--strict');
  try {
    const root = fs.realpathSync(process.cwd());
    const v = versions(root);
    /* Loaded on use: contract-classes reads package files at import, and discovery must load every cmd- module without them. */
    const { contractClasses } = await import('./contract-classes.mjs');
    const classes = contractClasses();
    const overrides = [];
    const { files, skipped } = cssFiles(root, excludedDir(root, config?.dir));
    /* One unreadable file is listed under skipped; it never stops the report. */
    for (const [abs, rel] of files) {
      try {
        for (const row of overridesIn(fs.readFileSync(abs, 'utf8'), classes)) overrides.push({ file: rel, ...row });
      } catch (e) {
        skipped.push({ file: rel, reason: e instanceof NestingError ? e.message : 'unreadable' });
      }
    }
    const byFileLine = (a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : (a.line ?? 0) - (b.line ?? 0));
    overrides.sort(byFileLine);
    skipped.sort(byFileLine);
    const latest = await latestVersion();
    const report = { schema: 1, package: PKG, ...v, latest, ...lagOf(v.installed, latest), overrides, skipped };
    const code = strict && overrides.length ? 1 : 0;
    /* A reader that closes the pipe (| head) is not an error: exit with the report's own code. */
    process.stdout.on('error', (e) => process.exit(e?.code === 'EPIPE' ? code : 2));
    const out = `${json ? JSON.stringify(report, null, 2) : text(report)}\n`;
    /* A pipe can take stdout asynchronously: wait for the write before exiting, or a long report is cut. */
    await new Promise((resolve) => process.stdout.write(out, resolve));
    process.exit(code);
  } catch (e) {
    console.error(`verseva doctor: ${e instanceof DoctorError ? e.message : printable(String(e?.message ?? e).split('\n')[0])}`);
    process.exit(2);
  }
}
