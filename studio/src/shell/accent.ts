// Custom accent: from any picked color, the four accent roles a theme file sets
// (--accent, --accent-hover, --accent-ink, --focus) for dark AND light, gated against the
// floors bin/contrast-pairs.mjs holds. A pick that fails moves in OKLCH lightness, hue and
// chroma held (chroma clamped to the sRGB gamut), to the nearest value that passes.
// Every value is computed at runtime from the pick and the canvas tokens: no literals.
import tokens from '../data/tokens.json';
import { parseColor, ratio, composite, type RGB } from '../contrast';
import { declsOf, type Roles } from './accent-store';

export { CUSTOM_KEY, styleText, readCustom, type Roles } from './accent-store';

export type Mode = 'dark' | 'light';
export interface Check { id: string; label: string; ratio: number; floor: number; pass: boolean }
export interface ModeResult extends Roles { focus: string; adjusted: boolean; checks: Check[]; pickChecks: Check[] }
export interface Derived { pick: string; dark: ModeResult; light: ModeResult }

/* ---- sRGB <-> OKLCH (Ottosson) ---- */
const toLin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const fromLin = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklch([r8, g8, b8]: RGB): [number, number, number] {
  const [r, g, b] = [toLin(r8), toLin(g8), toLin(b8)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.hypot(A, B);
  const H = C < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

/** Linear sRGB for an OKLCH triple (may fall outside [0, 1] when out of gamut). */
function oklchToLinear(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}
const inGamut = (v: number[]) => v.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
const rgbHex = ([r, g, b]: RGB) => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase();

/** Three or six hex digits, with or without the hash, as six uppercase digits with the hash; anything else is null. */
export function normalizeHex(v: string): string | null {
  const m = String(v ?? '').trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${h.toUpperCase()}`;
}

const rgbOf = (hex: string): RGB => { const c = parseColor(hex)!; return [c[0], c[1], c[2]]; };
export const toOklch = (hex: string) => rgbToOklch(rgbOf(hex));

/** The OKLCH color as hex, chroma reduced until it sits in sRGB (lightness and hue kept). */
export function fromOklch(L: number, C: number, H: number): string {
  const l = Math.min(1, Math.max(0, L));
  let c = Math.max(0, C);
  if (!inGamut(oklchToLinear(l, c, H))) {
    let lo = 0, hi = c;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (inGamut(oklchToLinear(l, mid, H))) lo = mid; else hi = mid; }
    c = lo;
  }
  const lin = oklchToLinear(l, c, H);
  return rgbHex(lin.map((x) => fromLin(Math.min(1, Math.max(0, x)))) as RGB);
}

/** The pick moved to another hue, its lightness kept and its chroma lifted off grey. */
export function hueHex(pick: string, hue: number): string {
  const [L, C] = toOklch(pick);
  return fromOklch(L, Math.max(C, 0.12), hue);
}

/** The hue control's source of truth: the user's pick and its own L, C and H. The slider only
    ever changes H; every output is computed from this base (gamut-clipped for output only), so
    steps never compound and the slider never sticks. */
export interface HueBase { hex: string; L: number; C: number; H: number; slider: number }
export function hueBase(pick: string): HueBase {
  const [L, C, H] = toOklch(pick);
  return { hex: pick, L, C, H, slider: Math.round(H) % 360 };
}
/** The color at slider position v: the original pick at its own position, else the base L and C at hue v. */
export function pickAtHue(base: HueBase, v: number): string {
  if (v === base.slider) return base.hex;
  return fromOklch(base.L, base.C < 0.02 ? 0.12 : base.C, v);
}

/* ---- the canvas each mode is gated against, read from the tokens model ---- */
type Canvas = { bg: RGB; surface: RGB; surface2: RGB; text1: RGB };
const tok = (name: string, mode: Mode): RGB => {
  const row = (tokens as ReadonlyArray<{ name: string; dark: string; light: string }>).find((t) => t.name === name);
  if (!row) throw new Error(`accent: no ${name} in the tokens model`);
  return rgbOf(row[mode]);
};
const CANVAS: Record<Mode, Canvas> = {
  dark: { bg: tok('--bg', 'dark'), surface: tok('--surface', 'dark'), surface2: tok('--surface-2', 'dark'), text1: tok('--text-1', 'dark') },
  light: { bg: tok('--bg', 'light'), surface: tok('--surface', 'light'), surface2: tok('--surface-2', 'light'), text1: tok('--text-1', 'light') },
};

/* Ink candidates: a deep shade of the accent's own hue, or near white. */
const darkInk = (H: number) => fromOklch(0.16, 0.03, H);
const lightInk = () => fromOklch(1, 0, 0);
/* Hover steps away from the page, as the presets do: lighter on the dark canvas, darker on the light one. */
const HOVER_STEP = 0.06;

function checksFor(mode: Mode, r: Roles): Check[] {
  const cv = CANVAS[mode];
  const [a, h, k] = [rgbOf(r.accent), rgbOf(r.hover), rgbOf(r.ink)];
  /* text-1 over the 14% accent tint on surface and on bg: the weaker of the two */
  const tint = Math.min(ratio(cv.text1, composite(a, cv.surface, 0.14)), ratio(cv.text1, composite(a, cv.bg, 0.14)));
  const rows: Array<[string, string, number, number]> = [
    ['ink-accent', 'Ink on accent', ratio(k, a), 4.5],
    ['ink-hover', 'Ink on hover', ratio(k, h), 4.5],
    ['accent-bg', 'Accent on bg', ratio(a, cv.bg), 3],
    ['hover-bg', 'Hover on bg', ratio(h, cv.bg), 3],
    ['accent-surface', 'Accent on surface', ratio(a, cv.surface), 3],
    ['accent-surface-2', 'Accent on surface 2', ratio(a, cv.surface2), 3],
    ['text-tint', 'Text on tint', tint, 4.5],
  ];
  return rows.map(([id, label, v, floor]) => ({ id, label, ratio: v, floor, pass: v >= floor }));
}

/** Hover and ink for an accent: the ink that clears both fills best. */
function rolesFor(accent: string, mode: Mode): Roles {
  const [L, C, H] = toOklch(accent);
  const a = rgbOf(accent);
  const hover = fromOklch(L + (mode === 'dark' ? HOVER_STEP : -HOVER_STEP), C, H);
  const hv = rgbOf(hover);
  const ink = [darkInk(H), lightInk()]
    .map((k) => ({ k, score: Math.min(ratio(rgbOf(k), a), ratio(rgbOf(k), hv)) }))
    .sort((x, y) => y.score - x.score)[0].k;
  return { accent, hover, ink };
}

const passes = (cs: Check[]) => cs.every((c) => c.pass);

function deriveMode(pick: string, mode: Mode): ModeResult {
  const first = rolesFor(pick, mode);
  const pickChecks = checksFor(mode, first);
  if (passes(pickChecks)) return { ...first, focus: first.accent, adjusted: false, checks: pickChecks, pickChecks };
  const [L0, C, H] = toOklch(pick);
  /* Outward from the pick's lightness in 1/400 steps: the first pass is the nearest. */
  let best: { roles: Roles; checks: Check[] } | null = null;
  for (let i = 1; i <= 400 && !best; i++) {
    for (const L of [L0 - i / 400, L0 + i / 400]) {
      if (L < 0 || L > 1) continue;
      const roles = rolesFor(fromOklch(L, C, H), mode);
      const checks = checksFor(mode, roles);
      if (passes(checks)) { best = { roles, checks }; break; }
    }
  }
  if (!best) return { ...first, focus: first.accent, adjusted: false, checks: pickChecks, pickChecks };
  return { ...best.roles, focus: best.roles.accent, adjusted: best.roles.accent !== pick, checks: best.checks, pickChecks };
}

export function deriveAccent(input: string): Derived {
  const pick = normalizeHex(input);
  if (!pick) throw new Error(`accent: not a hex color: ${input}`);
  return { pick, dark: deriveMode(pick, 'dark'), light: deriveMode(pick, 'light') };
}

/* ---- output: the runtime style (what the head script writes) and the copied theme file ---- */

/** A ready themes/<slug>.css for the pick, in the presets' shape. */
export function themeCss(d: Derived): string {
  const blk = (sel: string, r: Roles) => `${sel} {\n${declsOf(r).map(([k, x]) => `  ${k}: ${x};`).join('\n')}\n}`;
  return [
    `/* @verseva/design theme: custom, derived from ${d.pick}. One accent, matte (law 3).`,
    '   Every pair below is contrast-gate proven:',
    '   verseva-contrast-gate --tokens tokens.css --tokens themes/custom.css */',
    blk('[data-brand="custom"]', d.dark),
    blk('[data-brand="custom"][data-theme="light"]', d.light),
    '',
  ].join('\n');
}

