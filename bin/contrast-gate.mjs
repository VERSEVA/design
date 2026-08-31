#!/usr/bin/env node
/**
 * verseva-contrast-gate: fails when a token pair breaks the contract's
 * contrast floors (4.5:1 body text, 3:1 large text and UI parts). Craft
 * law, not deviable (docs/laws.md); a failing pair is a defect, never a
 * calibration target.
 *
 * Usage:
 *   verseva-contrast-gate --tokens <tokens.css> [--tokens <theme.css>]...
 *
 * Rules:
 * - Parses every --tokens file with a brace-depth scanner (values
 *   containing braces cannot truncate a block) and merges, in order:
 *   :root (dark base), [data-theme="light"], and every
 *   [data-brand="slug"] / [data-brand="slug"][data-theme="light"] block.
 *   Each brand contributes two more themes on top of the base.
 * - Checks the role pairs the contract names: the text ladder on canvas
 *   and surfaces, accent label on accent (and on accent-hover), accent
 *   and focus on canvas, accent on surface, status text on its tint
 *   composited over --surface. Alpha composites over the real backdrop
 *   before measuring; un-composited probes lie.
 * - Color syntaxes: hex, rgb()/rgba() (comma or space, / and % alpha),
 *   hsl()/hsla(). var() references resolve up to 4 hops inside the same
 *   theme. A REQUIRED pair that cannot be resolved is a FAILURE, not a
 *   skip: a gate that measures nothing must not report clean.
 * - A --tokens file contributing zero custom properties is a usage
 *   error (exit 2), as are positional arguments: this gate takes no
 *   scan paths.
 * - Exit 1 with the failing pairs and ratios; exit 0 clean, stating the
 *   measured-pair count.
 */
import fs from 'node:fs';

const PAIRS = [
  ['text-1', ['bg'], 4.5], ['text-1', ['surface'], 4.5], ['text-1', ['surface-2'], 4.5],
  ['text-2', ['bg'], 4.5], ['text-2', ['surface'], 4.5], ['text-2', ['surface-2'], 4.5],
  ['text-3', ['bg'], 3], ['text-3', ['surface'], 3],
  ['accent-ink', ['accent'], 4.5],
  ['accent-ink', ['accent-hover'], 4.5],
  ['accent', ['bg'], 3],
  ['accent', ['surface'], 3],
  ['focus', ['bg'], 3],
  ['success', ['success-bg', 'surface'], 4.5],
  ['warn', ['warn-bg', 'surface'], 4.5],
  ['danger', ['danger-bg', 'surface'], 4.5],
  ['text-1', ['accent*0.14', 'surface'], 4.5],
  ['text-1', ['accent*0.14', 'bg'], 4.5],
  ['data-alt', ['bg'], 3],
  ['data-alt', ['surface'], 3],
];

function parseArgs(argv) {
  const tokens = [];
  const extras = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--tokens') tokens.push(argv[++i]);
    else extras.push(argv[i]);
  }
  return { tokens, extras };
}

function collectBlocks(cssRaw) {
  const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  let i = 0;
  let selStart = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '{') {
      const selector = css.slice(selStart, i).trim();
      let depth = 1;
      let j = i + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      blocks.push({ selector, body: css.slice(i + 1, j - 1) });
      i = j;
      selStart = j;
    } else {
      if (ch === '}') selStart = i + 1;
      i++;
    }
  }
  return blocks;
}

function propsOf(body) {
  const props = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) props[m[1]] = m[2].trim();
  return props;
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: 255 * f(0), g: 255 * f(8), b: 255 * f(4) };
}

function parseColor(value) {
  if (!value) return null;
  const v = value.trim();
  const hex = v.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    let h = hex[1].toLowerCase();
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (o) => parseInt(h.slice(o, o + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const num = (s, scale = 1) => (s.endsWith('%') ? (parseFloat(s) / 100) * scale : parseFloat(s));
  const rgb = v.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
  if (rgb) {
    return {
      r: num(rgb[1], 255), g: num(rgb[2], 255), b: num(rgb[3], 255),
      a: rgb[4] === undefined ? 1 : num(rgb[4]),
    };
  }
  const hsl = v.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
  if (hsl) {
    const { r, g, b } = hslToRgb(parseFloat(hsl[1]), parseFloat(hsl[2]), parseFloat(hsl[3]));
    return { r, g, b, a: hsl[4] === undefined ? 1 : num(hsl[4]) };
  }
  return null;
}

function resolve(name, theme) {
  let value = theme[name];
  for (let hops = 0; hops < 4 && value; hops++) {
    const ref = value.match(/^var\(--([\w-]+)\)$/);
    if (!ref) break;
    value = theme[ref[1]];
  }
  return parseColor(value);
}

const compose = (fg, bg) => ({
  r: fg.a * fg.r + (1 - fg.a) * bg.r,
  g: fg.a * fg.g + (1 - fg.a) * bg.g,
  b: fg.a * fg.b + (1 - fg.a) * bg.b,
  a: 1,
});

function luminance({ r, g, b }) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const { tokens, extras } = parseArgs(process.argv.slice(2));
if (tokens.length === 0 || extras.length > 0) {
  console.error('usage: verseva-contrast-gate --tokens <tokens.css> [--tokens ...]  (no scan paths: this gate measures token files only)');
  process.exit(2);
}

const base = {};
const light = {};
const brands = {};
for (const t of tokens) {
  const css = fs.readFileSync(t, 'utf8');
  let contributed = 0;
  for (const { selector, body } of collectBlocks(css)) {
    const props = propsOf(body);
    if (Object.keys(props).length === 0) continue;
    const brand = selector.match(/\[data-brand="([^"]+)"\]/);
    const isLight = /\[data-theme="light"\]/.test(selector);
    if (brand) {
      const slug = brand[1];
      brands[slug] ??= { dark: {}, light: {} };
      Object.assign(brands[slug][isLight ? 'light' : 'dark'], props);
    } else if (isLight) Object.assign(light, props);
    else if (selector.includes(':root')) Object.assign(base, props);
    else continue;
    contributed += Object.keys(props).length;
  }
  if (contributed === 0) {
    console.error(`verseva-contrast-gate: ${t} contributed zero custom properties; wrong file?`);
    process.exit(2);
  }
}

const themes = { dark: base, light: { ...base, ...light } };
for (const [slug, b] of Object.entries(brands)) {
  themes[`${slug}·dark`] = { ...base, ...b.dark };
  themes[`${slug}·light`] = { ...base, ...light, ...b.dark, ...b.light };
}

const failures = [];
let measured = 0;
for (const [themeName, theme] of Object.entries(themes)) {
  const canvas = resolve('bg', theme);
  if (!canvas) {
    failures.push(`[${themeName}] --bg is unresolvable; nothing can be measured`);
    continue;
  }
  for (const [fgName, bgChain, floor] of PAIRS) {
    const fg = resolve(fgName, theme);
    let backdrop = canvas;
    let resolvable = true;
    for (const layerName of [...bgChain].reverse()) {
      const [tokenName, alphaFactor] = layerName.split('*');
      const layer = resolve(tokenName, theme);
      if (!layer) { resolvable = false; break; }
      const scaled = alphaFactor ? { ...layer, a: layer.a * parseFloat(alphaFactor) } : layer;
      backdrop = compose(scaled, backdrop);
    }
    if (!fg || !resolvable) {
      failures.push(`[${themeName}] ${fgName} on ${bgChain.join('+')}  UNRESOLVABLE (required pair; the gate must measure it)`);
      continue;
    }
    measured++;
    const solidFg = fg.a < 1 ? compose(fg, backdrop) : fg;
    const r = ratio(solidFg, backdrop);
    const line = `[${themeName}] ${fgName} on ${bgChain.join('+')}  ${r.toFixed(2)}:1  (floor ${floor})`;
    if (r < floor) failures.push(line);
    else if (process.env.VERSEVA_GATE_VERBOSE) console.log(`  ok ${line}`);
  }
}

if (failures.length) {
  console.error(`verseva-contrast-gate: ${failures.length} failure${failures.length === 1 ? '' : 's'} (${measured} pairs measured)\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error('\nContrast floors are craft law: lift the token value; never ship the pair.');
  process.exit(1);
}
console.log(`verseva-contrast-gate: clean (${measured} pairs measured across ${Object.keys(themes).length} themes, 0 skipped)`);
