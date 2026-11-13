/**
 * Token resolver: turns tokens.css plus brand theme files into plain values,
 * the way a browser would compute them on <html>, for every theme (the
 * signature and each [data-brand]) in both modes. Shared by the
 * verseva-resolve-tokens CLI (bin/resolve-tokens.mjs), the Swift emitter and
 * the Node gates. Browser-safe: no node: imports; it takes CSS text.
 *
 * What it emulates:
 * - The cascade. Every block whose selector matches the context
 *   (brand, mode) applies, ordered by specificity and then source order
 *   across the files as given. `:root`, `[data-theme="light"]` and
 *   `[data-brand="x"]` all weigh (0,1,0), so source order decides between
 *   them; `[data-brand="x"][data-theme="light"]` weighs (0,2,0) and wins.
 *   Both attributes are taken to sit on the root element (docs/theming.md).
 * - var(), after the cascade (late binding): a token redefined by a later
 *   layer moves every token that references it. Fallbacks apply when the
 *   reference is missing or invalid; a missing reference with no fallback,
 *   or a cycle, is UNRESOLVED.
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
 * oklch, color-mix in another space) is 'unresolved', and a selector it cannot
 * place in the cascade throws.
 */

export const SIGNATURE = 'signature';
export const MODES = ['dark', 'light'];

// CSS named colors: `transparent` plus the 16 basic keywords. Any other named
// color stays a string (the full table is not carried).
const NAMED = {
  transparent: [0, 0, 0, 0],
  black: [0, 0, 0], silver: [192, 192, 192], gray: [128, 128, 128], white: [255, 255, 255],
  maroon: [128, 0, 0], red: [255, 0, 0], purple: [128, 0, 128], fuchsia: [255, 0, 255],
  green: [0, 128, 0], lime: [0, 255, 0], olive: [128, 128, 0], yellow: [255, 255, 0],
  navy: [0, 0, 128], blue: [0, 0, 255], teal: [0, 128, 128], aqua: [0, 255, 255],
};
const COLOR_FN = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i;
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)%?$/;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Splits on `sep` outside parentheses and quotes. A whitespace `sep` drops empty parts. */
function splitTop(text, sep) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
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
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

// ---- cascade ---------------------------------------------------------------

/** Rule blocks in source order (brace-depth scanner, as in contrast-gate). */
function collectBlocks(cssRaw) {
  const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  let i = 0;
  let selStart = 0;
  while (i < css.length) {
    if (css[i] === '{') {
      let depth = 1;
      let j = i + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      blocks.push({ selector: css.slice(selStart, i).trim(), body: css.slice(i + 1, j - 1) });
      i = j;
      selStart = j;
    } else {
      if (css[i] === '}') selStart = i + 1;
      i++;
    }
  }
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
 * only from :root, html, [data-theme="..."] and [data-brand="..."].
 */
function parseSelector(selector) {
  const alternatives = [];
  for (const alt of splitTop(selector, ',')) {
    const attrs = {};
    let ids = 0;
    let rest = alt.trim().replace(/\[data-(theme|brand)=(["']?)([^"'\]]+)\2\]/g, (_, key, _q, value) => {
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
function collectRules(cssTexts) {
  const rules = [];
  const brands = [];
  for (const css of cssTexts) {
    for (const { selector, body } of collectBlocks(css)) {
      const nested = body.includes('{');
      const decls = declarationsOf(body);
      if (nested ? !/(^|[\s;{])--[\w-]+\s*:/.test(body) : decls.length === 0) continue;
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

/** Declared (pre-var) values for one context, cascade applied. dark = no data-theme, or "dark". */
function cascade(rules, brand, mode) {
  const matching = rules.filter((r) => (r.brand === undefined || r.brand === brand) && (r.theme === undefined || r.theme === mode));
  matching.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
  const declared = new Map();
  for (const { decls } of matching) for (const [name, value] of decls) declared.set(name, value);
  return declared;
}

// ---- var() -----------------------------------------------------------------

/** `value` with every var() substituted, or null when invalid (missing reference, cycle). */
function substitute(value, declared, stack) {
  let out = '';
  let i = 0;
  for (;;) {
    const at = value.slice(i).search(/(?<![\w-])var\(/);
    if (at === -1) return out + value.slice(i);
    const open = i + at + 3;
    const close = closing(value, open);
    if (close === -1) return null;
    const inner = value.slice(open + 1, close);
    const comma = splitTop(inner, ',')[0].length;
    const name = inner.slice(0, comma).trim().replace(/^--/, '');
    let resolved = null;
    if (declared.has(name) && !stack.includes(name)) resolved = substitute(declared.get(name), declared, [...stack, name]);
    if (resolved === null && comma < inner.length) resolved = substitute(inner.slice(comma + 1).trim(), declared, stack);
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
function emit(raw, declared, name) {
  const value = substitute(raw, declared, [name]);
  if (value === null) return { type: 'unresolved', value: raw, reason: 'var() reference is missing or cyclic, with no usable fallback' };
  const color = parseColor(value);
  if (color) {
    const [r, g, b] = [color.r, color.g, color.b].map((c) => Math.round(c));
    return { type: 'color', r, g, b, a: Number(color.a.toFixed(4)) };
  }
  if (COLOR_FN.test(value) && closing(value, value.indexOf('(')) === value.length - 1) {
    return { type: 'unresolved', value, reason: 'color syntax not implemented by the resolver' };
  }
  return { type: 'string', value };
}

/**
 * Resolves token CSS to plain values.
 * @param {string[]} cssTexts CSS source texts in cascade (load) order: tokens.css first, then theme files.
 * @returns {{ themes: Record<string, Record<'dark'|'light', Record<string, object>>>, unresolved: object[] }}
 */
export function resolveTokens(cssTexts) {
  const { rules, brands } = collectRules(cssTexts);
  if (brands.includes(SIGNATURE)) throw new Error(`token-resolver: "${SIGNATURE}" is reserved for the unbranded theme`);
  const themes = {};
  const unresolved = [];
  for (const theme of [SIGNATURE, ...brands]) {
    themes[theme] = {};
    for (const mode of MODES) {
      const declared = cascade(rules, theme === SIGNATURE ? undefined : theme, mode);
      const tokens = {};
      for (const [name, raw] of declared) {
        tokens[name] = emit(raw, declared, name);
        if (tokens[name].type === 'unresolved') unresolved.push({ theme, mode, token: name, ...tokens[name] });
      }
      themes[theme][mode] = tokens;
    }
  }
  return { themes, unresolved };
}
