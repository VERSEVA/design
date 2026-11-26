#!/usr/bin/env node
/**
 * verseva-recipe-gate: reports contract-owned elements built by hand. The
 * four gates prove values; this one asks whether a button, table, field,
 * select or dialog was built with the contract's classes at all. Signal 1
 * of the recipe gate. Advisory: findings exit 0 unless --strict is set.
 *
 * Usage:
 *   verseva-recipe-gate [--allow <path-substring>]... [--exclude <dir>]...
 *                       [--strict] [--] <file-or-dir>...
 *
 * Rules:
 * - Scans .html .jsx .tsx; node_modules, .git, .next, dist, build, out
 *   are skipped.
 * - Owned elements: button, table, input, textarea, select, dialog, and
 *   any element with role="button" or role="dialog".
 * - An element passes when it carries a class from the contract class set
 *   (components.css, read at run time), or sits anywhere inside a parent
 *   part: the fixed floor in contract-classes.mjs, or a part the contract
 *   styles that element under (".searchbox input", ".tabbar button").
 * - Each file is judged on its own. Capitalised components are never
 *   followed. A className with no string literal is unknown, not a
 *   finding; one literal holding a contract class passes.
 * - "recipe-ok: <reason>" waives one element: inside its tag, or on the
 *   line above it. The reason is required.
 * - verseva.json in the working directory: files under "dir" are
 *   known-good; "recipeAllow" lists path substrings to skip.
 * - --allow skips any file whose path contains the given substring.
 * - --exclude skips the directory of that name directly under a scan path.
 * - After "--" every argument is a path. Before it, an unknown argument
 *   with a leading dash is refused.
 * - Exit 0 clean, or findings without --strict; exit 1 findings with
 *   --strict; exit 2 errored (missing path, bad config, usage).
 */
import fs from 'node:fs';
import path from 'node:path';
import { contractClasses, contractParts, OWNED } from './contract-classes.mjs';

const NAME = 'verseva-recipe-gate';
const SCAN_EXT = new Set(['.html', '.jsx', '.tsx']);
const JSX_EXT = new Set(['.jsx', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.turbo', '.vercel']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const MARKER_RE = /recipe-ok:[ \t]*[^\s>*/-]/;

/* Sections of docs/component-contract.md, by the kind of element found. */
const SECTION = {
  button: 'Button: .btn',
  table: 'Table: .table',
  field: 'Input / field: .field',
  choice: 'Selection controls: .sel, .switch',
  dialog: 'Modal: .modal',
};

/* HTML end tags are optional on these: opening one closes the open sibling, up to its container. */
const IMPLIED_CLOSE = {
  li: [['li'], ['ul', 'ol']],
  td: [['td', 'th'], ['table']],
  th: [['td', 'th'], ['table']],
  tr: [['tr', 'td', 'th'], ['table']],
  option: [['option'], ['select']],
  dt: [['dt', 'dd'], ['dl']],
  dd: [['dt', 'dd'], ['dl']],
};

function fail(msg) {
  console.error(msg);
  process.exit(2);
}

function parseArgs(argv) {
  const tokens = []; // accepted for runner symmetry, unused
  const allow = [];
  const exclude = [];
  const paths = [];
  let strict = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--') { paths.push(...argv.slice(i + 1)); break; }
    if (argv[i] === '--allow') allow.push(argv[++i]);
    else if (argv[i] === '--tokens') tokens.push(argv[++i]);
    else if (argv[i] === '--exclude') exclude.push(argv[++i]);
    else if (argv[i] === '--strict') strict = true;
    else if (argv[i].startsWith('-')) fail(`${NAME}: unknown option: ${argv[i]}`);
    else paths.push(argv[i]);
  }
  return { tokens, allow, exclude, paths, strict };
}

function* walk(p, exclude = []) {
  const st = fs.statSync(p);
  if (st.isFile()) {
    yield p;
    return;
  }
  const entries = fs.readdirSync(p, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !exclude.includes(entry.name)) yield* walk(path.join(p, entry.name));
    } else if (SCAN_EXT.has(path.extname(entry.name))) {
      yield path.join(p, entry.name);
    }
  }
}

function readConfig() {
  if (!fs.existsSync('verseva.json')) return { dir: null, recipeAllow: [] };
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync('verseva.json', 'utf8'));
  } catch {
    fail(`${NAME}: verseva.json is not valid JSON`);
  }
  if (cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)) fail(`${NAME}: verseva.json must hold an object`);
  const { dir = null, recipeAllow = [] } = cfg;
  if (dir !== null && (typeof dir !== 'string' || dir === '')) fail(`${NAME}: verseva.json "dir" must be a path`);
  if (!Array.isArray(recipeAllow) || recipeAllow.some((a) => typeof a !== 'string' || a === '')) {
    fail(`${NAME}: verseva.json "recipeAllow" must be a list of strings`);
  }
  return { dir: dir === null ? null : path.resolve(dir), recipeAllow };
}

/* Blank a region but keep its newlines, so line numbers hold. */
const blank = (s) => s.replace(/[^\n]/g, ' ');

// The text the tag reader sees: comments between elements gone (in JSX only the brace-wrapped
// form, so a comment opener inside a string blanks nothing), and in HTML the script and style
// bodies too.
function readable(text, jsx) {
  if (jsx) return text.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, blank);
  return text
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (_, open, _tag, body, close) => open + blank(body) + close);
}

/* Index just past a quoted run starting at i, or -1 when it never closes. */
function skipQuote(text, i) {
  const q = text[i];
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') j++;
    else if (text[j] === q) return j + 1;
  }
  return -1;
}

/* Index just past the bracket that closes the tag whose attributes start at i: quote aware,
   and in JSX brace-depth aware, so an arrow or a comparison inside an expression does not end it. */
function tagEnd(text, i, jsx) {
  let depth = 0;
  for (let j = i; j < text.length; j++) {
    const ch = text[j];
    if (ch === '"' || ch === "'" || (jsx && ch === '`')) {
      const next = skipQuote(text, j);
      if (next === -1) return -1;
      j = next - 1;
    } else if (jsx && ch === '/' && text[j + 1] === '/' && depth === 0) {
      const nl = text.indexOf('\n', j);
      if (nl === -1) return -1;
      j = nl;
    } else if (jsx && ch === '/' && text[j + 1] === '*') {
      const close = text.indexOf('*/', j + 2);
      if (close === -1) return -1;
      j = close + 1;
    } else if (jsx && ch === '{') depth++;
    else if (jsx && ch === '}') depth--;
    else if (ch === '>' && depth <= 0) return j + 1;
    else if (ch === '<' && depth <= 0) return -1; // a new tag began: this was never one
  }
  return -1;
}

/* Attributes of one tag: name -> { literal: [strings] } or { literal: null } for an expression
   holding no string literal. A bare attribute maps to an empty literal. */
function attributes(body, jsx) {
  const attrs = new Map();
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (jsx && ch === '/' && body[i + 1] === '/') { const nl = body.indexOf('\n', i); i = nl === -1 ? body.length : nl; continue; }
    if (jsx && ch === '/' && body[i + 1] === '*') { const close = body.indexOf('*/', i + 2); i = close === -1 ? body.length : close + 2; continue; }
    if (jsx && ch === '{') { i = braceEnd(body, i); continue; } // spread
    const name = body.slice(i).match(/^[A-Za-z_:@][\w:.-]*/)?.[0];
    if (!name) { i++; continue; }
    i += name.length;
    const eq = body.slice(i).match(/^\s*=\s*/)?.[0];
    if (!eq) { attrs.set(name, { literal: [''] }); continue; }
    i += eq.length;
    if (body[i] === '"' || body[i] === "'") {
      const end = skipQuote(body, i);
      const stop = end === -1 ? body.length : end;
      attrs.set(name, { literal: [body.slice(i + 1, stop - 1)] });
      i = stop;
    } else if (jsx && body[i] === '{') {
      const end = braceEnd(body, i);
      attrs.set(name, { literal: literalsIn(body.slice(i + 1, end - 1)) });
      i = end;
    } else {
      const bare = body.slice(i).match(/^[^\s>]+/)?.[0] ?? '';
      attrs.set(name, { literal: [bare] });
      i += bare.length || 1;
    }
  }
  return attrs;
}

function braceEnd(text, i) {
  let depth = 0;
  for (let j = i; j < text.length; j++) {
    const ch = text[j];
    if (ch === '"' || ch === "'" || ch === '`') {
      const next = skipQuote(text, j);
      if (next === -1) return text.length;
      j = next - 1;
    } else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return j + 1;
  }
  return text.length;
}

/* String literals inside an expression; null when there is none. */
function literalsIn(expr) {
  const found = [];
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch !== '"' && ch !== "'" && ch !== '`') continue;
    const end = skipQuote(expr, i);
    if (end === -1) break;
    const raw = expr.slice(i + 1, end - 1);
    if (ch === '`') {
      /* The template's own text, plus any literal a placeholder chooses between. */
      found.push(raw.replace(/\$\{([^}]*)\}/g, (_, inner) => { found.push(...(literalsIn(inner) ?? [])); return ' '; }));
    } else found.push(raw);
    i = end - 1;
  }
  return found.length ? found : null;
}

const classList = (attr) => (attr?.literal ?? []).flatMap((s) => s.split(/\s+/)).filter(Boolean);

/* Which contract section owns this element, or null when it is not an owned one. */
function ownedKind(tag, attrs) {
  const role = attrs.get('role')?.literal?.[0];
  if (role === 'button' || role === 'dialog') return { tag: role, kind: role, label: `<${tag} role="${role}">` };
  if (!OWNED.includes(tag)) return null;
  if (tag === 'input') {
    const type = (attrs.get('type')?.literal?.[0] ?? '').toLowerCase();
    if (type === 'hidden') return null;
    if (type === 'checkbox' || type === 'radio') return { tag, kind: 'choice', label: `<input type="${type}">` };
    if (type === 'submit' || type === 'button' || type === 'reset') return { tag, kind: 'button', label: `<input type="${type}">` };
  }
  const kind = tag === 'button' || tag === 'table' || tag === 'dialog' ? tag : 'field';
  return { tag, kind, label: `<${tag}>` };
}

function scan(text, jsx, classes, parts) {
  const src = readable(text, jsx);
  const rawLines = text.split('\n');
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
  const lineOf = (ix) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= ix) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };

  const stack = []; // open elements: { name, classes }
  const spent = new Set(); // marker lines that already waived an element
  const found = [];
  let checked = 0;
  const TAG_RE = /<(\/?)([A-Za-z][\w.:-]*)/g;
  let m;
  while ((m = TAG_RE.exec(src))) {
    /* In JSX a tag never follows an identifier, a call or an index: that is a comparison or a generic. */
    if (jsx && m.index > 0 && /[\w)\]]/.test(src[m.index - 1])) continue;
    const name = jsx ? m[2] : m[2].toLowerCase();
    if (m[1]) {
      const at = stack.findLastIndex((e) => e.name === name);
      if (at !== -1) stack.length = at;
      continue;
    }
    const bodyStart = m.index + m[0].length;
    const end = tagEnd(src, bodyStart, jsx);
    if (end === -1) continue;
    TAG_RE.lastIndex = end;
    const selfClosed = src[end - 2] === '/';
    const body = src.slice(bodyStart, selfClosed ? end - 2 : end - 1);
    const component = jsx && !/^[a-z]/.test(name);
    const attrs = component ? new Map() : attributes(body, jsx);
    const classAttr = attrs.get(jsx ? 'className' : 'class') ?? attrs.get('class');
    const own = classList(classAttr);

    if (!jsx && IMPLIED_CLOSE[name]) {
      const [siblings, containers] = IMPLIED_CLOSE[name];
      for (let i = stack.length - 1; i >= 0 && !containers.includes(stack[i].name); i--) {
        if (siblings.includes(stack[i].name)) { stack.length = i; break; }
      }
    }

    const owned = component ? null : ownedKind(name, attrs);
    if (owned) {
      checked++;
      const unknown = classAttr !== undefined && classAttr.literal === null;
      const passes = unknown
        || own.some((c) => classes.has(c))
        || stack.some((e) => e.classes.some((c) => parts.any.has(c) || parts[owned.tag].has(c)));
      if (!passes) {
        const line = lineOf(m.index);
        const above = line - 2;
        if (MARKER_RE.test(text.slice(m.index, end))) {
          /* Waived inside the tag: its lines are spent, so the marker does not also cover the next line. */
          for (let l = line - 1; l < lineOf(end - 1); l++) spent.add(l);
        } else if (above >= 0 && !spent.has(above) && MARKER_RE.test(rawLines[above])) {
          spent.add(above);
        } else {
          found.push({ line, label: owned.label, section: SECTION[owned.kind] });
        }
      }
    }

    if (!selfClosed && !VOID.has(name)) stack.push({ name, classes: own });
  }
  return { found, checked };
}

const { tokens, allow, exclude, paths, strict } = parseArgs(process.argv.slice(2));
for (const [flag, vals] of [['--tokens', tokens], ['--allow', allow], ['--exclude', exclude]]) {
  if (vals.includes(undefined)) fail(`${NAME}: ${flag} needs a value`);
}
if (paths.length === 0) fail(`usage: ${NAME} [--allow <substr>] [--exclude <dir>] [--strict] [--] <paths...>`);
for (const p of paths) {
  if (!fs.existsSync(p)) fail(`${NAME}: no such file: ${p}`);
}
const config = readConfig();
const skip = [...allow, ...config.recipeAllow];

const classes = contractClasses();
const parts = contractParts();
const findings = [];
let checked = 0;
for (const root of paths) {
  for (const file of walk(root, exclude)) {
    const abs = path.resolve(file);
    if (skip.some((a) => abs.includes(a))) continue;
    if (config.dir && abs.startsWith(config.dir + path.sep)) continue;
    const res = scan(fs.readFileSync(file, 'utf8'), JSX_EXT.has(path.extname(file)), classes, parts);
    checked += res.checked;
    for (const f of res.found) findings.push(`${file}:${f.line}  ${f.label}  ${f.section}`);
  }
}

if (findings.length) {
  const log = strict ? console.error : console.log;
  log(`${NAME}: ${findings.length} hand-built element${findings.length === 1 ? '' : 's'}${strict ? '' : ' (advisory)'}\n`);
  for (const f of findings) log(`  ${f}`);
  log('\nBuild each from its section of docs/component-contract.md, or mark a ratified exception with "recipe-ok: <reason>".');
  process.exit(strict ? 1 : 0);
}
console.log(`${NAME}: clean (${checked} contract-owned element${checked === 1 ? '' : 's'}, ${classes.size} contract classes)`);
