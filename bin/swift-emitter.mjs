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
 * by one, with the native shape it takes) or EXCLUDED (named below, with the
 * reason). A token that is neither makes emitSwift throw, so a new token in
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

/* Not generated. Each family carries the reason; `match` decides membership. */
const family = (prefix) => (token) => token.startsWith(prefix);
const exactly = (...names) => (token) => names.includes(token);
export const EXCLUDED = [
  { family: '--glass-*', match: family('glass-'), reason: 'web glass recipe (backdrop blur, stacked and inset box-shadows); native uses the system glass material, set by hand' },
  { family: '--nav-*', match: family('nav-'), reason: 'web navshell layout and its inset shadow stack; native uses the system navigation containers' },
  { family: '--accent-bloom', match: exactly('accent-bloom'), reason: 'a CSS radial-gradient string, with no plain-data native form' },
  { family: '--accent-active-glow', match: exactly('accent-active-glow'), reason: 'a CSS box-shadow slot that is "none" unless a brand opts in; a web-only effect' },
  { family: '--surface-body', match: exactly('surface-body'), reason: 'a CSS linear-gradient string, with no plain-data native form' },
  { family: '--container-*', match: family('container-'), reason: 'page widths in ch and rem for browser layout; native layout is driven by size classes' },
  { family: '--font-sans, --font-display, --font-mono', match: exactly('font-sans', 'font-display', 'font-mono'), reason: 'CSS font-family fallback stacks; native fonts are registered and named by hand' },
  { family: '--r-pill', match: exactly('r-pill'), reason: 'the 999px pill trick; native uses a capsule shape' },
];

const SWIFT_TYPE = { color: 'TokenColor', weight: 'Int', length: 'Double', duration: 'Double', shadow: 'TokenShadow', curve: 'TimingCurve' };

/* Swift keywords a token name could collide with once camel-cased. */
const RESERVED = new Set(['as', 'break', 'case', 'catch', 'class', 'continue', 'default', 'defer', 'do', 'else', 'enum', 'extension',
  'fallthrough', 'false', 'for', 'func', 'guard', 'if', 'import', 'in', 'init', 'internal', 'is', 'let', 'nil', 'operator', 'private',
  'protocol', 'public', 'repeat', 'return', 'self', 'static', 'struct', 'subscript', 'super', 'switch', 'throw', 'throws', 'true', 'try',
  'var', 'where', 'while']);

/** `text-1` becomes `text1`, `accent-hover` becomes `accentHover`, `s-4` becomes `s4`. */
export function swiftIdentifier(token) {
  const id = token.replace(/-+([a-z0-9])/gi, (_, c) => c.toUpperCase());
  if (!/^[a-z][A-Za-z0-9]*$/.test(id) || RESERVED.has(id)) throw new Error(`swift-emitter: --${token} does not make a usable Swift identifier ("${id}")`);
  return id;
}

/** Every mapped token, in output order: { token, name, kind, type, group }. */
export const MAPPED = GROUPS.flatMap((g) => g.tokens.map((token) => ({ token, name: swiftIdentifier(token), kind: g.kind, type: SWIFT_TYPE[g.kind], group: g.title })));

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
    return num(n);
  },
  duration(token, v) {
    const m = v.type === 'string' && new RegExp(`^(${NUMBER})(ms|s)$`).exec(v.value.trim());
    if (!m) fail(token, v.value, 'a duration in ms or s');
    return num(m[2] === 'ms' ? Number(m[1]) / 1000 : Number(m[1]));
  },
  weight(token, v) {
    if (v.type !== 'string' || !/^\d+$/.test(v.value.trim())) fail(token, v.value, 'a whole font weight number');
    return String(Number(v.value.trim()));
  },
  curve(token, v) {
    const m = v.type === 'string' && new RegExp(`^cubic-bezier\\(\\s*(${NUMBER})\\s*,\\s*(${NUMBER})\\s*,\\s*(${NUMBER})\\s*,\\s*(${NUMBER})\\s*\\)$`).exec(v.value.trim());
    if (!m) fail(token, v.value, 'a cubic-bezier() with four numbers');
    const [x1, y1, x2, y2] = m.slice(1).map(Number);
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
    return `TokenShadow(x: ${num(x)}, y: ${num(y)}, radius: ${num(blur / 2)}, color: ${swiftColor(r, g, b, a)})`;
  },
};

const themeTypeName = (slug) => {
  const name = slug.split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  if (!/^[A-Z]/.test(name)) throw new Error(`swift-emitter: theme "${slug}" does not make a usable Swift type name`);
  return `${name}Tokens`;
};

function tokenSet(modeName, tokens, where) {
  for (const token of Object.keys(tokens)) {
    if (MAPPED.some((m) => m.token === token) || EXCLUDED.some((e) => e.match(token))) continue;
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
  const files = {};
  for (const slug of Object.keys(resolved.themes).sort()) {
    const theme = resolved.themes[slug];
    const type = themeTypeName(slug);
    const file = `${type}.swift`;
    if (files[file]) throw new Error(`swift-emitter: two themes map to ${file}`);
    const selector = slug === 'signature' ? 'the signature (no data-brand)' : `[data-brand="${slug}"]`;
    files[file] = [
      '// GENERATED FILE. DO NOT EDIT BY HAND.',
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
