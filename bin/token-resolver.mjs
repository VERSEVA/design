/**
 * Token resolver: turns tokens.css plus brand theme files into plain values,
 * the way a browser would compute them on <html>, for every theme (the
 * signature and each [data-brand]) in both modes. Shared by the CLI
 * (bin/resolve-tokens.mjs), the Swift emitter and the Node gates.
 * Browser-safe: no node: imports; it takes CSS text.
 *
 * What it emulates:
 * - The cascade. Every block whose selector matches the context
 *   (brand, mode) applies, ordered by specificity and then source order
 *   across the files as given. `:root`, `[data-theme="light"]` and
 *   `[data-brand="x"]` all weigh (0,1,0), so source order decides between
 *   them; `[data-brand="x"][data-theme="light"]` weighs (0,2,0) and wins.
 *   Both attributes are taken to sit on the root element (docs/theming.md).
 *   Dark is the ABSENCE of data-theme; light is data-theme="light". A
 *   [data-theme] selector with any other value (including "dark") throws.
 * - var(), after the cascade (late binding): a token redefined by a later
 *   layer moves every token that references it. Fallbacks apply when the
 *   reference is missing or invalid; a missing reference with no fallback
 *   is UNRESOLVED. A token that references itself, directly or through a
 *   loop (fallback references count), is invalid even when it carries a
 *   fallback, as in CSS: UNRESOLVED itself, and a referrer takes its own
 *   fallback.
 * - color-mix(in srgb, ...) per CSS Color 5: percentage normalisation
 *   (omitted, summing over or under 100, the under-100 alpha multiplier) and
 *   premultiplied-alpha interpolation.
 *
 * Output: { themes: { <signature|slug>: { dark: {...}, light: {...} } },
 * unresolved: [...] }. Each token (keyed without the leading --) is one of
 *   { type: 'color', r, g, b, a }      8-bit channels, alpha 0..1 (4 places)
 *   { type: 'string', value }          var() substituted, otherwise verbatim
 *   { type: 'unresolved', value, reason }
 * Nothing is guessed: a color syntax this file does not implement (hsl, lab,
 * oklch, color-mix in another space), a malformed hex and `currentcolor` are
 * 'unresolved', and a selector or at-rule it cannot place in the cascade
 * throws. So does a stylesheet that ends inside a quote, a url(, a comment
 * or a block: malformed input fails loudly, it never resolves partially.
 *
 * KNOWN LIMITATION: only `transparent` and the 16 basic named colors are
 * recognised. Any other CSS named color (rebeccapurple, tomato, ...) and the
 * system colors cannot be told apart from an ordinary keyword (none, normal,
 * a font name) without the full table, which this file does not carry; such
 * a value is emitted as { type: 'string' }, NOT as a color and NOT flagged.
 */

export const SIGNATURE = 'signature';
export const MODES = ['dark', 'light'];

// CSS named colors: `transparent` plus the 16 basic keywords. Any other named
// color stays a string (the full table is not carried; see KNOWN LIMITATION).
const NAMED = {
  transparent: [0, 0, 0, 0],
  black: [0, 0, 0], silver: [192, 192, 192], gray: [128, 128, 128], white: [255, 255, 255],
  maroon: [128, 0, 0], red: [255, 0, 0], purple: [128, 0, 128], fuchsia: [255, 0, 255],
  green: [0, 128, 0], lime: [0, 255, 0], olive: [128, 128, 0], yellow: [255, 255, 0],
  navy: [0, 0, 128], blue: [0, 0, 255], teal: [0, 128, 128], aqua: [0, 255, 255],
};
// Color keywords with no fixed value: never a plain string, always unresolved.
const UNRESOLVABLE_KEYWORDS = new Set(['currentcolor']);
const VAR_REF = /(?<![\w-])var\(\s*--([\w-]+)/gi;
const COLOR_FN = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i;
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)%?$/;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Opaque runs are text no scanner may look inside: a quoted string (a
 * backslash escapes the next character) and the body of an unquoted url().
 * Returns the index of the last character of the run starting at `i`, or `i`
 * itself when none starts there. Throws when the run never closes.
 */
function skipOpaque(text, i) {
  const ch = text[i];
  if (ch === '"' || ch === "'") {
    for (let j = i + 1; j < text.length; j++) {
      if (text[j] === '\\') j++;
      else if (text[j] === ch) return j;
    }
    throw new Error('unclosed quote');
  }
  if ((ch === 'u' || ch === 'U') && /^url\($/i.test(text.slice(i, i + 4)) && !/[\w-]/.test(text[i - 1] ?? '')) {
    let j = i + 4;
    while (/\s/.test(text[j] ?? '')) j++;
    if (text[j] === '"' || text[j] === "'") return i; // url("..."): the string rule covers it
    for (; j < text.length; j++) {
      if (text[j] === '\\') j++;
      else if (text[j] === ')') return j;
    }
    throw new Error('unclosed url(');
  }
  return i;
}

/** Splits on `sep` outside parentheses and opaque runs. A whitespace `sep` drops empty parts. */
function splitTop(text, sep) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const end = skipOpaque(text, i);
    if (end !== i) { i = end; continue; }
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && (sep === ' ' ? /\s/.test(ch) : ch === sep)) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return sep === ' ' ? parts.filter(Boolean) : parts;
}

/** Index of the parenthesis closing the one at `open`, or -1. */
function closing(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    i = skipOpaque(text, i);
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

// ---- cascade ---------------------------------------------------------------

/**
 * Rule blocks in source order, comments removed. One pass that knows whether
 * it is inside an opaque run, a comment or a block, so a brace or a comment
 * opener inside a string is text. Throws, naming `label`, when the input ends
 * with a quote, a url(, a comment or a block still open: a malformed
 * stylesheet fails loudly, it never resolves partially.
 */
function collectBlocks(raw, label) {
  const fail = (what) => { throw new Error(`token-resolver: ${label}: ${what}; refusing to resolve a malformed stylesheet`); };
  const blocks = [];
  let css = ''; // the comment-free text so far; selStart and open index into it
  let selStart = 0;
  let open = -1;
  let depth = 0;
  let nested = false;
  for (let i = 0; i < raw.length; i++) {
    let end;
    try { end = skipOpaque(raw, i); } catch (e) { fail(e.message); }
    if (end !== i) { css += raw.slice(i, end + 1); i = end; continue; }
    if (raw.startsWith('/*', i)) {
      const close = raw.indexOf('*/', i + 2);
      if (close === -1) fail('unclosed comment');
      i = close + 1;
      continue;
    }
    const ch = raw[i];
    if (ch === '{') {
      if (depth++ === 0) { open = css.length; nested = false; } else nested = true;
    } else if (ch === '}') {
      if (depth > 0 && --depth === 0) blocks.push({ selector: css.slice(selStart, open).trim(), body: css.slice(open + 1), nested });
      if (depth === 0) selStart = css.length + 1;
    }
    css += ch;
  }
  if (depth > 0) fail('unclosed {');
  return blocks;
}

/** Custom-property declarations of a block body, in order. */
function declarationsOf(body) {
  const decls = [];
  for (const decl of splitTop(body, ';')) {
    const m = decl.match(/^\s*--([\w-]+)\s*:([\s\S]*)$/);
    if (m) decls.push([m[1], m[2].trim()]);
  }
  return decls;
}

/**
 * One selector to the contexts it matches: a list (comma alternatives) of
 * { brand, theme, specificity }, or null when any alternative is not built
 * only from :root, html, [data-theme="light"] and [data-brand="..."]. Throws
 * on any other data-theme value: dark is the absence of the attribute, so a
 * [data-theme="dark"] block would not apply where this resolver calls it dark.
 */
function parseSelector(selector) {
  const alternatives = [];
  for (const alt of splitTop(selector, ',')) {
    const attrs = {};
    let ids = 0;
    let rest = alt.trim().replace(/\[data-(theme|brand)=(["']?)([^"'\]]+)\2\]/g, (_, key, _q, value) => {
      if (key === 'theme' && value !== 'light') {
        throw new Error(`token-resolver: unsupported selector "${selector}": [data-theme="${value}"] is not modelled. Dark means no data-theme attribute (:root) and light means [data-theme="light"]; a block for any other value cannot be placed in either mode`);
      }
      if (key in attrs && attrs[key] !== value) attrs.never = true;
      attrs[key] = value;
      ids++;
      return '';
    });
    rest = rest.replace(/:root/g, () => { ids++; return ''; });
    const type = rest === 'html' ? 1 : 0;
    if (rest !== '' && rest !== 'html') return null;
    if (ids + type === 0) return null;
    alternatives.push({ brand: attrs.brand, theme: attrs.theme, never: attrs.never, specificity: ids * 10 + type });
  }
  return alternatives;
}

/** The rules of every file, flattened in source order, plus the brand slugs seen. */
function collectRules(cssTexts, labels) {
  const rules = [];
  const brands = [];
  for (const [index, css] of cssTexts.entries()) {
    for (const { selector, body, nested } of collectBlocks(css, labels[index] ?? `input ${index}`)) {
      const decls = declarationsOf(body);
      if (nested ? !/(^|[\s;{])--[\w-]+\s*:/.test(body) : decls.length === 0) continue;
      if (selector.startsWith('@')) {
        throw new Error(`token-resolver: unsupported at-rule "${selector.split(/[;{]/)[0].trim()}" precedes or wraps custom properties; the cascade cannot place it`);
      }
      const alternatives = parseSelector(selector);
      if (!alternatives || nested) {
        throw new Error(`token-resolver: unsupported selector "${selector}" declares custom properties; the cascade cannot place it`);
      }
      for (const [name, value] of decls) {
        if (/!\s*important\s*$/i.test(value)) throw new Error(`token-resolver: --${name} uses !important, which is not supported`);
      }
      for (const alt of alternatives) {
        if (alt.never) continue;
        if (alt.brand && !brands.includes(alt.brand)) brands.push(alt.brand);
        rules.push({ ...alt, decls, order: rules.length });
      }
    }
  }
  return { rules, brands };
}

/** Declared (pre-var) values for one context, cascade applied. dark = no data-theme attribute. */
function cascade(rules, brand, mode) {
  const matching = rules.filter((r) => (r.brand === undefined || r.brand === brand) && (r.theme === undefined || r.theme === mode));
  matching.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
  const declared = new Map();
  for (const { decls } of matching) for (const [name, value] of decls) declared.set(name, value);
  return declared;
}

// ---- var() -----------------------------------------------------------------

/**
 * The tokens that are invalid because they reference themselves, directly or
 * through a loop. Every var() in a value counts, fallbacks included.
 */
function cyclic(declared) {
  const deps = new Map();
  for (const [name, value] of declared) deps.set(name, [...value.matchAll(VAR_REF)].map((m) => m[1]));
  const invalid = new Set();
  for (const name of declared.keys()) {
    const seen = new Set();
    const todo = [...deps.get(name)];
    while (todo.length) {
      const dep = todo.pop();
      if (dep === name) { invalid.add(name); break; }
      if (seen.has(dep) || !deps.has(dep)) continue;
      seen.add(dep);
      todo.push(...deps.get(dep));
    }
  }
  return invalid;
}

/**
 * The substituted value of token `name` in one context, or null when it is
 * undeclared or invalid. Cached per context ({ declared, invalid, cache }), so
 * each token is substituted once however many tokens reference it.
 */
function lookup(name, ctx) {
  if (!ctx.declared.has(name) || ctx.invalid.has(name)) return null;
  if (!ctx.cache.has(name)) ctx.cache.set(name, substitute(ctx.declared.get(name), ctx));
  return ctx.cache.get(name);
}

/** `value` with every var() substituted, or null when invalid (a missing or cyclic reference with no fallback). */
function substitute(value, ctx) {
  let out = '';
  let i = 0;
  for (;;) {
    const at = value.slice(i).search(/(?<![\w-])var\(/i);
    if (at === -1) return out + value.slice(i);
    const open = i + at + 3;
    const close = closing(value, open);
    if (close === -1) return null;
    const inner = value.slice(open + 1, close);
    const comma = splitTop(inner, ',')[0].length;
    const name = inner.slice(0, comma).trim().replace(/^--/, '');
    let resolved = lookup(name, ctx);
    if (resolved === null && comma < inner.length) resolved = substitute(inner.slice(comma + 1).trim(), ctx);
    if (resolved === null) return null;
    out += value.slice(i, i + at) + resolved;
    i = close + 1;
  }
}

// ---- color -----------------------------------------------------------------

/**
 * A CSS color to { r, g, b, a } with unrounded 0..255 channels and 0..1
 * alpha, or null when `text` is not a color this file can evaluate.
 */
export function parseColor(text) {
  const v = text.trim();
  const lower = v.toLowerCase();
  if (Object.hasOwn(NAMED, lower)) {
    const [r, g, b, a = 1] = NAMED[lower];
    return { r, g, b, a };
  }
  const hex = v.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    const h = hex[1].length <= 4 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    const n = (o) => parseInt(h.slice(o, o + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = lower.match(/^(rgba?|color-mix)\(/);
  if (!fn || closing(v, fn[0].length - 1) !== v.length - 1) return null;
  const inner = v.slice(fn[0].length, -1);
  if (fn[1] === 'color-mix') return colorMix(inner);
  const parts = inner.trim().split(/\s*[,/]\s*|\s+/);
  if ((parts.length !== 3 && parts.length !== 4) || !parts.every((p) => NUMBER.test(p))) return null;
  const num = (s, scale) => (s.endsWith('%') ? (parseFloat(s) / 100) * scale : parseFloat(s));
  const [r, g, b] = parts.slice(0, 3).map((p) => clamp(num(p, 255), 0, 255));
  return { r, g, b, a: parts[3] === undefined ? 1 : clamp(num(parts[3], 1), 0, 1) };
}

/** The arguments of color-mix(), evaluated per CSS Color 5 section 3 (srgb only). */
function colorMix(inner) {
  const args = splitTop(inner, ',').map((a) => a.trim());
  if (args.length !== 3 || !/^in\s+srgb$/i.test(args[0])) return null;
  const sides = [];
  for (const arg of args.slice(1)) {
    const words = splitTop(arg, ' ');
    const at = words.findIndex((w) => /^(\d+\.?\d*|\.\d+)%$/.test(w));
    const pct = at === -1 ? null : parseFloat(words[at]);
    if (at !== -1) words.splice(at, 1);
    const color = words.length === 1 ? parseColor(words[0]) : null;
    if (!color || (pct !== null && pct > 100)) return null;
    sides.push({ color, pct });
  }
  let [p1, p2] = sides.map((s) => s.pct);
  if (p1 === null && p2 === null) p1 = p2 = 50;
  else if (p1 === null) p1 = 100 - p2;
  else if (p2 === null) p2 = 100 - p1;
  const sum = p1 + p2;
  if (sum === 0) return null;
  const w1 = p1 / sum;
  const w2 = p2 / sum;
  const [c1, c2] = sides.map((s) => s.color);
  const alpha = c1.a * w1 + c2.a * w2;
  const channel = (k) => (alpha === 0 ? 0 : (c1[k] * c1.a * w1 + c2[k] * c2.a * w2) / alpha);
  return { r: channel('r'), g: channel('g'), b: channel('b'), a: alpha * Math.min(1, sum / 100) };
}

/** One declared value to its emitted form. */
function emit(raw, ctx, name) {
  if (ctx.invalid.has(name)) return { type: 'unresolved', value: raw, reason: 'var() cycle: the token references itself, directly or through other tokens' };
  const value = lookup(name, ctx);
  if (value === null) return { type: 'unresolved', value: raw, reason: 'var() reference is missing or invalid, with no usable fallback' };
  const color = parseColor(value);
  if (color) {
    const [r, g, b] = [color.r, color.g, color.b].map((c) => Math.round(c));
    return { type: 'color', r, g, b, a: Number(color.a.toFixed(4)) };
  }
  if (COLOR_FN.test(value) && closing(value, value.indexOf('(')) === value.length - 1) {
    return { type: 'unresolved', value, reason: 'color syntax not implemented by the resolver' };
  }
  if (/^#\S*$/.test(value)) return { type: 'unresolved', value, reason: 'malformed hex color (not 3, 4, 6 or 8 hex digits)' };
  if (UNRESOLVABLE_KEYWORDS.has(value.toLowerCase())) return { type: 'unresolved', value, reason: 'color keyword with no fixed value' };
  return { type: 'string', value };
}

/**
 * Resolves token CSS to plain values.
 * @param {string[]} cssTexts CSS source texts in cascade (load) order: tokens.css first, then theme files.
 * @param {string[]} [labels] A name per text (a file path) for error messages; defaults to "input <index>".
 * @returns {{ themes: Record<string, Record<'dark'|'light', Record<string, object>>>, unresolved: object[] }}
 */
export function resolveTokens(cssTexts, labels = []) {
  const { rules, brands } = collectRules(cssTexts, labels);
  if (brands.includes(SIGNATURE)) throw new Error(`token-resolver: "${SIGNATURE}" is reserved for the unbranded theme`);
  const themes = {};
  const unresolved = [];
  for (const theme of [SIGNATURE, ...brands]) {
    themes[theme] = {};
    for (const mode of MODES) {
      const declared = cascade(rules, theme === SIGNATURE ? undefined : theme, mode);
      const ctx = { declared, invalid: cyclic(declared), cache: new Map() };
      const tokens = {};
      for (const [name, raw] of declared) {
        tokens[name] = emit(raw, ctx, name);
        if (tokens[name].type === 'unresolved') unresolved.push({ theme, mode, token: name, ...tokens[name] });
      }
      themes[theme][mode] = tokens;
    }
  }
  return { themes, unresolved };
}
