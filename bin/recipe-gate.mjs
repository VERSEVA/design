#!/usr/bin/env node
/**
 * verseva-recipe-gate: reports contract-owned elements built by hand. The
 * four gates prove values; this one asks whether a button, table, field,
 * select or dialog was built with the contract's classes at all (signal 1),
 * and whether the project consumes the signature material at all (signal 2,
 * the material census). Advisory: findings exit 0 unless --strict is set.
 *
 * Usage:
 *   verseva-recipe-gate [--allow <path-substring>]... [--exclude <dir>]...
 *                       [--strict] [--] <file-or-dir>...
 *
 * Rules:
 * - Scans .html .jsx .tsx for elements; .ts and .js are read for the
 *   census only. node_modules, .git, .next, dist, build, out are skipped.
 * - Owned elements: button, table, input, textarea, select, dialog, and
 *   any element with role="button" or role="dialog".
 * - An element passes when it carries a root part class for its own kind
 *   (the floor in contract-classes.mjs, or a class components.css styles
 *   on that element, "button.notif"; a .card on a button does not count),
 *   or sits anywhere inside a parent part for that element: the floor in
 *   contract-classes.mjs, or a part the contract styles it under
 *   (".searchbox input").
 * - In .jsx and .tsx, comments and the contents of string literals are
 *   not scanned for tags. Quotes and comment openers count only in code
 *   and inside a tag, never in JSX text: "Don't" or "https://" there
 *   hides nothing.
 * - Each file is judged on its own. Capitalised components are never
 *   followed. A className with no string literal is unknown, not a
 *   finding, and so is an element whose only class source is a spread
 *   ({...props} with no className); one literal holding a contract class
 *   passes. A spread beside a className is judged on that className.
 * - "recipe-ok: <reason>" waives one element: inside its tag, or on the
 *   line above it. The reason is required.
 * - Material census: over every scanned file (.css too), a var() reference
 *   to a --glass-*, --nav-* or --accent-bloom token that tokens.css
 *   defines, or an element carrying the classes of a components.css rule
 *   that consumes those tokens (".tab.on" needs both; read at run time),
 *   is a use. --e-* is not material. A stylesheet that itself defines the
 *   material (a vendored components.css) counts nothing. Zero uses across
 *   the whole scan is one project-level finding. Comments are not read; in
 *   HTML, script and style bodies are. In .ts and .js, each string literal
 *   is read as one element's class list ('tab on' is a .tab.on).
 * - verseva.json in the working directory: files under "dir" are
 *   known-good; "recipeAllow" lists path substrings to skip; "material" is
 *   "full" (the default) or "none", which skips the census.
 * - --allow skips any file whose path contains the given substring.
 * - --exclude skips the directory of that name directly under a scan path.
 * - A file reached through overlapping scan paths is read once.
 * - After "--" every argument is a path. Before it, an unknown argument
 *   with a leading dash is refused.
 * - Exit 0 clean, or findings without --strict; exit 1 findings with
 *   --strict; exit 2 errored (missing path, bad config, usage).
 */
import fs from 'node:fs';
import path from 'node:path';
import { contractClasses, contractParts, contractRoots, definesMaterial, materialClasses, materialSelectors, MATERIAL_RE, OWNED } from './contract-classes.mjs';

const NAME = 'verseva-recipe-gate';
const SCAN_EXT = new Set(['.html', '.jsx', '.tsx']);
const JSX_EXT = new Set(['.jsx', '.tsx']);
const CODE_EXT = new Set(['.ts', '.js']);
const CENSUS_EXT = new Set([...SCAN_EXT, ...CODE_EXT, '.css']);
const MATERIAL_USE_RE = new RegExp(MATERIAL_RE.source, 'g');
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
    } else if (CENSUS_EXT.has(path.extname(entry.name))) {
      yield path.join(p, entry.name);
    }
  }
}

function readConfig() {
  if (!fs.existsSync('verseva.json')) return { dir: null, recipeAllow: [], material: 'full' };
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync('verseva.json', 'utf8'));
  } catch {
    fail(`${NAME}: verseva.json is not valid JSON`);
  }
  if (cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)) fail(`${NAME}: verseva.json must hold an object`);
  const { dir = null, recipeAllow = [], material = 'full' } = cfg;
  if (dir !== null && (typeof dir !== 'string' || dir === '')) fail(`${NAME}: verseva.json "dir" must be a path`);
  if (!Array.isArray(recipeAllow) || recipeAllow.some((a) => typeof a !== 'string' || a === '')) {
    fail(`${NAME}: verseva.json "recipeAllow" must be a list of strings`);
  }
  if (material !== 'full' && material !== 'none') fail(`${NAME}: verseva.json "material" must be "full" or "none"`);
  return { dir: dir === null ? null : path.resolve(dir), recipeAllow, material };
}

/* Blank a region but keep its newlines, so line numbers hold. */
const blank = (s) => s.replace(/[^\n]/g, ' ');

/* Words after which a "<" starts an expression, so it can open a JSX element. */
const EXPR_WORDS = new Set(['return', 'yield', 'await', 'default', 'case', 'else', 'do', 'in', 'of']);

/* Whether a "<" at i, in code, can open a JSX element: it sits where an expression starts (after
   an operator, an opening bracket, "=>" or a word such as return), never after a value. */
function opensElement(text, i) {
  if (!/[A-Za-z>]/.test(text[i + 1] ?? '')) return false;
  if (/^<[\w$]+\s+extends\b/.test(text.slice(i, i + 80))) return false; // a generic: <T extends X>(...)
  let j = i - 1;
  while (j >= 0 && /\s/.test(text[j])) j--;
  if (j < 0) return true;
  if (/[([{,;:?=&|!>+\-*%~^]/.test(text[j])) return true;
  if (!/[\w$]/.test(text[j])) return false;
  let k = j;
  while (k > 0 && /[\w$]/.test(text[k - 1])) k--;
  return EXPR_WORDS.has(text.slice(k, j + 1));
}

/* Comments blanked from i, or -1 when no comment starts there. */
function commentEnd(text, i) {
  if (text[i] !== '/') return -1;
  if (text[i + 1] === '/') { const end = text.indexOf('\n', i); return end === -1 ? text.length : end; }
  if (text[i + 1] === '*') { const close = text.indexOf('*/', i + 2); return close === -1 ? text.length : close + 2; }
  return -1;
}

/* Index just past a quote that closes on its own line, or -1: a quote with no partner on its
   line is an apostrophe, not a string. */
function lineQuoteEnd(text, i) {
  const q = text[i];
  let j = i + 1;
  while (j < text.length && text[j] !== q && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
  return text[j] === q ? j + 1 : -1;
}

/* A JSX file as the tag reader sees it: comments blanked, and every tag opener inside a string
   or template literal blanked, so neither is scanned for tags. One pass over three contexts:
   code (the module, and every {} expression), a tag (from "<name" to its ">"), and JSX text
   (between an element's open and close). Quotes and comment openers count in code and in a tag,
   never in JSX text, so "Don't" or "https://" there hides nothing. An unclosed comment is
   blanked to the end of the file once. Class names inside strings are untouched. */
function readableJsx(text) {
  const out = text.split('');
  const n = text.length;
  const wipe = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  const hideTags = (a, b) => { for (let k = a; k < b; k++) if (out[k] === '<') out[k] = ' '; };
  /* Frames: code { depth }, tpl, tag { closing }, text { open }. The bottom code frame never pops. */
  const stack = [{ mode: 'code', depth: 0 }];
  let i = 0;
  while (i < n) {
    const top = stack.at(-1);
    const ch = text[i];
    if (top.mode === 'tpl') {
      if (ch === '\\') i += 2;
      else if (ch === '`') { stack.pop(); i++; }
      else if (ch === '$' && text[i + 1] === '{') { stack.push({ mode: 'code', depth: 0 }); i += 2; }
      else { if (ch === '<') out[i] = ' '; i++; }
    } else if (top.mode === 'text') {
      if (ch === '{') { stack.push({ mode: 'code', depth: 0 }); i++; }
      else if (ch === '<' && text[i + 1] === '/') { stack.push({ mode: 'tag', closing: true }); i += 2; }
      else if (ch === '<' && /[A-Za-z>]/.test(text[i + 1] ?? '')) { stack.push({ mode: 'tag', closing: false }); i++; }
      else i++;
    } else if (top.mode === 'tag') {
      const end = commentEnd(text, i);
      if (ch === '"' || ch === "'") {
        const close = skipQuote(text, i);
        const stop = close === -1 ? n : close;
        hideTags(i + 1, stop);
        i = stop;
      } else if (end !== -1) { wipe(i, end); i = end; }
      else if (ch === '{') { stack.push({ mode: 'code', depth: 0 }); i++; }
      else if (ch === '>' || (ch === '/' && text[i + 1] === '>')) {
        stack.pop();
        const parent = stack.at(-1);
        if (top.closing) {
          if (parent.mode === 'text' && --parent.open === 0) stack.pop();
        } else if (ch === '>') {
          if (parent.mode === 'text') parent.open++;
          else stack.push({ mode: 'text', open: 1 });
        }
        i += ch === '>' ? 1 : 2;
      } else if (/[<;(),]/.test(ch)) stack.pop(); // never a tag (a comparison or a generic): reread ch where it opened
      else i++;
    } else {
      const end = commentEnd(text, i);
      if (end !== -1) { wipe(i, end); i = end; }
      else if (ch === '"' || ch === "'") {
        const close = lineQuoteEnd(text, i);
        if (close === -1) i++;
        else { hideTags(i + 1, close - 1); i = close; }
      } else if (ch === '`') { stack.push({ mode: 'tpl' }); i++; }
      else if (ch === '{') { top.depth++; i++; }
      else if (ch === '}') {
        if (top.depth === 0 && stack.length > 1) stack.pop();
        else if (top.depth > 0) top.depth--;
        i++;
      } else if (ch === '<' && opensElement(text, i)) { stack.push({ mode: 'tag', closing: false }); i++; }
      else i++;
    }
  }
  return out.join('');
}

/* The string literals of a .ts or .js file, comments skipped: the census reads only these there. */
function codeLiterals(text) {
  const found = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const end = commentEnd(text, i);
    if (end !== -1) { i = end; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      const close = ch === '`' ? skipQuote(text, i) : lineQuoteEnd(text, i);
      if (close === -1) { i++; continue; }
      found.push(...(literalsIn(text.slice(i, close)) ?? []));
      i = close;
    } else i++;
  }
  return found;
}

/* The text the tag reader sees. In HTML: comments, script bodies and style bodies blanked. */
function readable(text, jsx) {
  if (jsx) return readableJsx(text);
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
    } else if (jsx && ch === '{') depth++;
    else if (jsx && ch === '}') depth--;
    else if (ch === '>' && depth <= 0) return j + 1;
    else if (ch === '<' && depth <= 0) return -1; // a new tag began: this was never one
  }
  return -1;
}

/* Attributes of one tag: name -> { literal: [strings] } or { literal: null } for an expression
   holding no string literal. A bare attribute maps to an empty literal. In JSX, attrs.spread is
   set when the tag spreads props ({...rest}); a blanked comment ({    }) is not a spread. */
function attributes(body, jsx) {
  const attrs = new Map();
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (jsx && ch === '{') {
      if (/^\{\s*\.\.\./.test(body.slice(i, i + 64))) attrs.spread = true;
      i = braceEnd(body, i);
      continue;
    }
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

function scan(text, jsx, roots, parts) {
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
  const used = []; // each element's class list, components included, for the census
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
    used.push(component ? classList(attributes(body, jsx).get('className')) : own);

    if (!jsx && IMPLIED_CLOSE[name]) {
      const [siblings, containers] = IMPLIED_CLOSE[name];
      for (let i = stack.length - 1; i >= 0 && !containers.includes(stack[i].name); i--) {
        if (siblings.includes(stack[i].name)) { stack.length = i; break; }
      }
    }

    const owned = component ? null : ownedKind(name, attrs);
    if (owned) {
      checked++;
      /* No literal to read: an expression with no string, or only a spread with no className. */
      const unknown = (classAttr !== undefined && classAttr.literal === null) || (classAttr === undefined && attrs.spread === true);
      const passes = unknown
        || own.some((c) => roots[owned.kind].has(c))
        || stack.some((e) => e.classes.some((c) => parts[owned.tag].has(c)));
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
  return { found, checked, used };
}

/* Material uses in one file: var() references outside comments, plus each material selector some
   element satisfies (every compound's classes on one element). A stylesheet that defines the
   material (a vendored components.css) is a definition and counts nothing. */
function materialUses(text, ext, elements, selectors) {
  let src;
  if (CODE_EXT.has(ext)) {
    /* A .ts or .js file: its string literals only, each read as one element's class list. */
    const literals = codeLiterals(text);
    src = literals.join('\n');
    elements = literals.map((s) => s.split(/\s+/).filter(Boolean));
  } else if (ext === '.css') {
    if (definesMaterial(text, material)) return 0;
    src = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  } else if (JSX_EXT.has(ext)) src = readableJsx(text);
  else src = text.replace(/<!--[\s\S]*?-->/g, blank).replace(/\/\*[\s\S]*?\*\//g, blank);
  const on = (need) => elements.some((cls) => need.every((c) => cls.includes(c)));
  return (src.match(MATERIAL_USE_RE)?.length ?? 0) + selectors.filter((sel) => sel.every(on)).length;
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
const roots = contractRoots();
const parts = contractParts();
const material = materialClasses();
const selectors = materialSelectors();
const findings = [];
let checked = 0;
let files = 0;
let uses = 0;
const seen = new Set(); // absolute paths already read: overlapping scan paths count a file once
for (const root of paths) {
  for (const file of walk(root, exclude)) {
    const abs = path.resolve(file);
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (skip.some((a) => abs.includes(a))) continue;
    if (config.dir && abs.startsWith(config.dir + path.sep)) continue;
    const ext = path.extname(file);
    const text = fs.readFileSync(file, 'utf8');
    files++;
    let used = [];
    if (ext !== '.css' && !CODE_EXT.has(ext)) {
      const res = scan(text, JSX_EXT.has(ext), roots, parts);
      checked += res.checked;
      used = res.used;
      for (const f of res.found) findings.push(`${file}:${f.line}  ${f.label}  ${f.section}`);
    }
    if (config.material === 'full') uses += materialUses(text, ext, used, selectors);
  }
}

const s = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const bare = config.material === 'full' && files > 0 && uses === 0;
const log = strict && (findings.length || bare) ? console.error : console.log;
const advisory = strict ? '' : ' (advisory)';
if (findings.length) {
  log(`${NAME}: ${findings.length} hand-built element${findings.length === 1 ? '' : 's'}${advisory}\n`);
  for (const f of findings) log(`  ${f}`);
  log('\nBuild each from its section of docs/component-contract.md, or mark a ratified exception with "recipe-ok: <reason>".');
} else {
  log(`${NAME}: ${bare ? 'no hand-built elements' : 'clean'} (${s(checked, 'contract-owned element')}, ${classes.size} root part classes)`);
}
if (config.material === 'none') {
  log(`${NAME}: material census skipped (material: none)`);
} else if (bare) {
  log(`${NAME}: material census: no material consumed${advisory}\n`);
  log(`  project  no material consumed in ${s(files, 'file')}  Glass panel: .glass`);
  log(`\nConsume --glass-*, --nav-* or --accent-bloom, or a material class (${[...material].sort().join(', ')}), or declare "material": "none" in verseva.json.`);
} else {
  log(`${NAME}: material census: ${s(uses, 'use')} in ${s(files, 'file')}`);
}
process.exit(strict && (findings.length || bare) ? 1 : 0);
