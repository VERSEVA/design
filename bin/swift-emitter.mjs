/**
 * Swift emitter: turns the resolved token values (bin/token-resolver.mjs)
 * into Swift source, one file per theme, each holding a dark and a light
 * TokenSet. The CLI is bin/emit-swift.mjs (npm run tokens:swift).
 * Browser-safe: no node: imports; it takes the resolver's output.
 *
 * The output is plain data: no imports, no UI types. The value types it
 * uses (TokenColor, TokenShadow, TimingCurve, TokenSet) are hand-written in
 * swift/Sources/VersevaDesign/Tokens/TokenValues.swift, and TokenSet must
 * declare exactly the fields listed here, in this order (a test holds the
 * two together).
 *
 * Every token must be decided. A token is either MAPPED (named below, one
 * by one, with the native shape it takes) or EXCLUDED (named below, one by
 * one, with the reason for its family); nothing matches by prefix. A token that is neither makes emitSwift throw, so a new token in
 * tokens.css forces a decision here. So does a mapped token that is missing,
 * unresolved, or not in the shape its kind expects.
 *
 * Web to native:
 *   color     RGBA components, Double 0 to 1, alpha kept
 *   length    px to points, 1 px = 1 pt
 *   duration  ms or s to seconds
 *   curve     the four cubic-bezier() control values
 *   shadow    one box-shadow layer, approximated: x and y offset and color
 *             kept, spread dropped, radius = blur / 2
 *   weight    the font weight number
 */

const GROUPS = [
  {
    title: 'Color roles',
    kind: 'color',
    tokens: ['bg', 'surface', 'surface-2', 'hairline-soft', 'hairline', 'hairline-strong', 'text-1', 'text-2', 'text-3',
      'accent', 'accent-hover', 'accent-ink', 'accent-on', 'focus', 'accent-2', 'highlight'],
  },
  {
    title: 'Status colors and their tinted backgrounds',
    kind: 'color',
    tokens: ['success', 'success-bg', 'warn', 'warn-bg', 'danger', 'danger-bg'],
  },
  {
    title: 'Data ladder and chart colors',
    kind: 'color',
    tokens: ['data-0', 'data-1', 'data-2', 'data-3', 'data-alt', 'chart-grid', 'chart-label'],
  },
  {
    title: 'Font weights',
    kind: 'weight',
    tokens: ['display-weight', 'heading-weight', 'btn-weight'],
  },
  {
    title: 'Spacing, in points (1 px = 1 pt)',
    kind: 'length',
    tokens: ['s-1', 's-2', 's-3', 's-4', 's-5', 's-6', 's-7', 's-8', 's-9', 's-10'],
  },
  {
    title: 'Corner radius, in points (1 px = 1 pt)',
    kind: 'length',
    tokens: ['r-sm', 'r-md', 'r-lg', 'r-btn'],
  },
  {
    title: 'Elevation shadows, approximated: the x and y offset and the color are kept,\n'
      + 'the CSS spread is dropped, and radius is the CSS blur divided by 2',
    kind: 'shadow',
    tokens: ['e-1', 'e-2', 'e-3'],
  },
  {
    title: 'Durations, in seconds',
    kind: 'duration',
    tokens: ['dur-1', 'dur-2', 'dur-3', 'dur-4'],
  },
  {
    title: 'Easing: the four cubic-bezier control values',
    kind: 'curve',
    tokens: ['ease-standard', 'ease-emph', 'ease-spring', 'ease-entrance', 'ease-exit', 'ease-back'],
  },
];

/* Not generated. Every excluded token is named, one by one, beside the reason for its
   family: a new --glass-* or --nav-* token is not excluded until it is added here. */
export const EXCLUDED = [
  {
    family: '--glass-*',
    tokens: ['glass-fill-3', 'glass-border', 'glass-blur', 'glass-sat', 'glass-shadow', 'glass-glow', 'glass-inset'],
    reason: 'web glass recipe (backdrop blur, stacked and inset box-shadows); native uses the system glass material, set by hand',
  },
  {
    family: '--nav-*',
    tokens: ['nav-gap', 'nav-frame', 'nav-main', 'nav-pill-inset'],
    reason: 'web navshell layout and its inset shadow stack; native uses the system navigation containers',
  },
  { family: '--accent-bloom', tokens: ['accent-bloom'], reason: 'a CSS radial-gradient string, with no plain-data native form' },
  { family: '--accent-active-glow', tokens: ['accent-active-glow'], reason: 'a CSS box-shadow slot that is "none" unless a brand opts in; a web-only effect' },
  { family: '--surface-body', tokens: ['surface-body'], reason: 'a CSS linear-gradient string, with no plain-data native form' },
  {
    family: '--container-*',
    tokens: ['container-prose', 'container-content', 'container-wide'],
    reason: 'page widths in ch and rem for browser layout; native layout is driven by size classes',
  },
  {
    family: '--font-*',
    tokens: ['font-sans', 'font-display', 'font-mono'],
    reason: 'CSS font-family fallback stacks; native fonts are registered and named by hand',
  },
  { family: '--r-pill', tokens: ['r-pill'], reason: 'the 999px pill trick; native uses a capsule shape' },
];
const EXCLUDED_NAMES = new Set(EXCLUDED.flatMap((e) => e.tokens));

const SWIFT_TYPE = { color: 'TokenColor', weight: 'Int', length: 'Double', duration: 'Double', shadow: 'TokenShadow', curve: 'TimingCurve' };

/* Swift's reserved words that start lower-case (The Swift Programming Language, Lexical
   Structure: declarations, statements, expressions and types). Each was checked against
   swiftc 6.4 as a stored property name and fails without backticks; the contextual keywords
   (open, final, some, left, set and the like) compile as names and stay usable. */
const RESERVED = new Set([
  'associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate', 'func', 'import', 'init', 'inout', 'internal', 'let',
  'operator', 'precedencegroup', 'private', 'protocol', 'public', 'rethrows', 'static', 'struct', 'subscript', 'typealias', 'var',
  'break', 'case', 'catch', 'continue', 'default', 'defer', 'do', 'else', 'fallthrough', 'for', 'guard', 'if', 'in', 'repeat',
  'return', 'switch', 'throw', 'where', 'while',
  'as', 'await', 'false', 'is', 'nil', 'self', 'super', 'throws', 'true', 'try',
]);

/** `text-1` becomes `text1`, `accent-hover` becomes `accentHover`, `s-4` becomes `s4`. */
export function swiftIdentifier(token) {
  const id = token.replace(/-+([a-z0-9])/gi, (_, c) => c.toUpperCase());
  if (!/^[a-z][A-Za-z0-9]*$/.test(id) || RESERVED.has(id)) throw new Error(`swift-emitter: --${token} does not make a usable Swift identifier ("${id}")`);
  return id;
}

/** The first line of every generated file. The CLI only overwrites or deletes files that start with it. */
export const GENERATED_HEADER = '// GENERATED FILE. DO NOT EDIT BY HAND.';

/** Groups to fields, in output order: [{ token, name, kind, type, group }]. */
export function mapFields(groups) {
  const fields = groups.flatMap((g) => g.tokens.map((token) => ({ token, name: swiftIdentifier(token), kind: g.kind, type: SWIFT_TYPE[g.kind], group: g.title })));
  const seen = new Map();
  for (const { token, name } of fields) {
    if (seen.has(name)) throw new Error(`swift-emitter: --${seen.get(name)} and --${token} both become the Swift identifier "${name}"`);
    seen.set(name, token);
  }
  return fields;
}

/** Every mapped token, in output order. */
export const MAPPED = mapFields(GROUPS);
const MAPPED_NAMES = new Set(MAPPED.map((m) => m.token));

/** The fields TokenSet must declare, in order: [{ name, type }]. */
export const swiftFields = () => MAPPED.map(({ name, type }) => ({ name, type }));

/* Fixed number formatting: six decimals at most, trailing zeros trimmed, always one decimal. */
const num = (n) => {
  const s = n.toFixed(6).replace(/0+$/, '');
  const out = s.endsWith('.') ? `${s}0` : s;
  return out === '-0.0' ? '0.0' : out;
};

const NUMBER = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)';
const fail = (token, value, expected) => { throw new Error(`swift-emitter: --${token}: expected ${expected}, got "${value}"`); };
/* A value that is not zero must not print as zero. */
const vanishes = (n) => n !== 0 && num(n) === '0.0';

const swiftColor = (r, g, b, a) => `TokenColor(r: ${num(r / 255)}, g: ${num(g / 255)}, b: ${num(b / 255)}, a: ${num(a)})`;

/* A CSS length in px, or a bare 0. */
function px(text) {
  const m = new RegExp(`^(${NUMBER})px$`).exec(text);
  if (m) return Number(m[1]);
  return /^[-+]?0+(?:\.0+)?$/.test(text) ? 0 : null;
}

const CONVERT = {
  color(token, v) {
    if (v.type !== 'color') fail(token, v.value, 'a color');
    return swiftColor(v.r, v.g, v.b, v.a);
  },
  length(token, v) {
    const n = v.type === 'string' ? px(v.value.trim()) : null;
    if (n === null) fail(token, v.value, 'a length in px');
    if (n < 0) fail(token, v.value, 'a length of zero or more');
    if (vanishes(n)) fail(token, v.value, 'a length that survives six decimals, or a plain 0');
    return num(n);
  },
  duration(token, v) {
    const m = v.type === 'string' && new RegExp(`^(${NUMBER})(ms|s)$`).exec(v.value.trim());
    if (!m) fail(token, v.value, 'a duration in ms or s');
    const seconds = m[2] === 'ms' ? Number(m[1]) / 1000 : Number(m[1]);
    if (seconds < 0) fail(token, v.value, 'a duration of zero or more');
    if (vanishes(seconds)) fail(token, v.value, 'a duration that survives six decimals of a second, or a plain 0');
    return num(seconds);
  },
  weight(token, v) {
    if (v.type !== 'string' || !/^\d+$/.test(v.value.trim())) fail(token, v.value, 'a whole font weight number');
    const weight = Number(v.value.trim());
    if (weight < 1 || weight > 1000) fail(token, v.value, 'a font weight from 1 to 1000');
    return String(weight);
  },
  curve(token, v) {
    const m = v.type === 'string' && new RegExp(`^cubic-bezier\\(\\s*(${NUMBER})\\s*,\\s*(${NUMBER})\\s*,\\s*(${NUMBER})\\s*,\\s*(${NUMBER})\\s*\\)$`).exec(v.value.trim());
    if (!m) fail(token, v.value, 'a cubic-bezier() with four numbers');
    const [x1, y1, x2, y2] = m.slice(1).map(Number);
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) fail(token, v.value, 'cubic-bezier() x control values from 0 to 1');
    return `TimingCurve(x1: ${num(x1)}, y1: ${num(y1)}, x2: ${num(x2)}, y2: ${num(y2)})`;
  },
  /* One outer layer: <x> <y> <blur> [<spread>] rgb()/rgba(). Anything else is a decision to make by hand. */
  shadow(token, v) {
    const expected = 'one box-shadow layer "<x> <y> <blur> [<spread>] rgba(r, g, b, a)"';
    const m = v.type === 'string' && new RegExp(`^(.+?)\\s+rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*(?:,\\s*(${NUMBER})\\s*)?\\)$`).exec(v.value.trim());
    if (!m) fail(token, v.value, expected);
    const lengths = m[1].split(/\s+/).map(px);
    const [r, g, b] = [m[2], m[3], m[4]].map(Number);
    const a = m[5] === undefined ? 1 : Number(m[5]);
    if (lengths.length < 3 || lengths.length > 4 || lengths.includes(null) || lengths[2] < 0 || [r, g, b].some((c) => c > 255) || a < 0 || a > 1) fail(token, v.value, expected);
    const [x, y, blur] = lengths;
    if ([x, y, blur / 2].some(vanishes)) fail(token, v.value, 'shadow lengths that survive six decimals, or a plain 0');
    return `TokenShadow(x: ${num(x)}, y: ${num(y)}, radius: ${num(blur / 2)}, color: ${swiftColor(r, g, b, a)})`;
  },
};

/* A brand name is printed into the file (type name, header comment), so it must be a plain
   slug: anything else, a line break above all, could put live Swift after the comment. */
const themeTypeName = (slug) => {
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) throw new Error(`swift-emitter: brand name ${JSON.stringify(slug)} is not a plain slug (expected /^[a-z][a-z0-9-]*$/)`);
  return `${slug.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('')}Tokens`;
};

function tokenSet(modeName, tokens, where) {
  for (const token of Object.keys(tokens)) {
    if (MAPPED_NAMES.has(token) || EXCLUDED_NAMES.has(token)) continue;
    throw new Error(`swift-emitter: --${token} (${where}) is neither mapped nor excluded. Decide in bin/swift-emitter.mjs: add it to a GROUPS family `
      + '(and to TokenSet in swift/Sources/VersevaDesign/Tokens/TokenValues.swift) or to EXCLUDED with a reason.');
  }
  const lines = [`    public static let ${modeName} = TokenSet(`];
  let group;
  MAPPED.forEach((m, i) => {
    const v = tokens[m.token];
    if (v === undefined) throw new Error(`swift-emitter: mapped token --${m.token} is missing (${where})`);
    if (v.type === 'unresolved') throw new Error(`swift-emitter: mapped token --${m.token} is unresolved (${where}): ${v.reason}`);
    if (m.group !== group) {
      group = m.group;
      for (const line of group.split('\n')) lines.push(`        // ${line}`);
    }
    lines.push(`        ${m.name}: ${CONVERT[m.kind](m.token, v)}${i === MAPPED.length - 1 ? '' : ','}`);
  });
  lines.push('    )');
  return lines;
}

/**
 * resolved: the output of resolveTokens. inputs: the CSS files it was given,
 * as the header should name them. Returns { '<Theme>Tokens.swift': text }.
 */
export function emitSwift(resolved, { inputs = [] } = {}) {
  if (resolved.unresolved.length) {
    const list = resolved.unresolved.map((u) => `[${u.theme}·${u.mode}] --${u.token}`).join(', ');
    throw new Error(`swift-emitter: ${resolved.unresolved.length} unresolved value${resolved.unresolved.length === 1 ? '' : 's'}: ${list}`);
  }
  /* Input names are printed in the header comment too: one line, plain path characters only. */
  for (const input of inputs) {
    if (!/^[\w .\/@+-]+$/.test(input)) throw new Error(`swift-emitter: input name ${JSON.stringify(input)} cannot be printed in the header (letters, digits, space and . / _ @ + - only)`);
  }
  const files = {};
  for (const slug of Object.keys(resolved.themes).sort()) {
    const theme = resolved.themes[slug];
    const type = themeTypeName(slug);
    const file = `${type}.swift`;
    if (files[file]) throw new Error(`swift-emitter: two themes map to ${file}`);
    const selector = slug === 'signature' ? 'the signature (no data-brand)' : `[data-brand="${slug}"]`;
    files[file] = [
      GENERATED_HEADER,
      '// Generated by: bin/emit-swift.mjs (npm run tokens:swift)',
      `// Inputs: ${inputs.join(', ')}`,
      `// Theme: ${slug}, ${selector}, dark and light.`,
      '// To change a value, edit the inputs and regenerate. npm test fails while this file is stale.',
      '// Plain data only: the value types live in ../Tokens/TokenValues.swift.',
      '// Shadows (e1 to e3) approximate the CSS box-shadow: spread is dropped, radius is the blur divided by 2.',
      '',
      `public enum ${type} {`,
      ...tokenSet('dark', theme.dark, `${slug}·dark`),
      '',
      ...tokenSet('light', theme.light, `${slug}·light`),
      '}',
      '',
    ].join('\n');
  }
  return files;
}
