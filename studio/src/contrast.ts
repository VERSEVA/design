// Live contrast: the gate's pairs, measured against the theme on the page.
// Same math as bin/contrast-gate.mjs: alpha composites over the real backdrop.
import { PAIRS } from '../../bin/contrast-pairs.mjs';

export type RGB = [number, number, number];
export interface PairResult { fg: string; bg: string; ratio: number; floor: number; pass: boolean }

type RGBA = [number, number, number, number];

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function ratio(fg: RGB, bg: RGB): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

export function composite(fg: RGB, bg: RGB, alpha: number): RGB {
  return [0, 1, 2].map((i) => alpha * fg[i] + (1 - alpha) * bg[i]) as RGB;
}

function hslToRgb(h: number, s: number, l: number): RGB {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
  return [f(0), f(8), f(4)];
}

export function parseColor(value: string): RGBA | null {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    let h = hex[1].toLowerCase();
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (o: number) => parseInt(h.slice(o, o + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const num = (s: string, scale = 1) => (s.endsWith('%') ? (parseFloat(s) / 100) * scale : parseFloat(s));
  const rgb = v.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
  if (rgb) return [num(rgb[1], 255), num(rgb[2], 255), num(rgb[3], 255), rgb[4] === undefined ? 1 : num(rgb[4])];
  const hsl = v.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
  if (hsl) return [...hslToRgb(parseFloat(hsl[1]), parseFloat(hsl[2]), parseFloat(hsl[3])), hsl[4] === undefined ? 1 : num(hsl[4])];
  return null;
}

function reader(root: HTMLElement) {
  const style = getComputedStyle(root);
  return (name: string): RGBA | null => {
    let value = style.getPropertyValue(`--${name}`).trim();
    for (let hops = 0; hops < 4; hops++) {
      const ref = value.match(/^var\(--([\w-]+)\)$/);
      if (!ref) break;
      value = style.getPropertyValue(`--${ref[1]}`).trim();
    }
    return value ? parseColor(value) : null;
  };
}

const over = (top: RGBA, under: RGB): RGB => composite([top[0], top[1], top[2]], under, top[3]);

/** Measures every PAIRS entry on the element's live theme; an unresolvable pair fails at ratio 0. */
export function evaluatePairs(root: HTMLElement = document.documentElement): PairResult[] {
  const read = reader(root);
  const canvas = read('bg');
  return PAIRS.map(([fgName, chain, floor]) => {
    const bg = chain.join('+');
    const fg = read(fgName);
    let backdrop: RGB | null = canvas ? [canvas[0], canvas[1], canvas[2]] : null;
    for (const layerName of [...chain].reverse()) {
      if (!backdrop) break;
      const [token, factor] = layerName.split('*');
      const layer = read(token);
      if (!layer) { backdrop = null; break; }
      backdrop = over(factor ? [layer[0], layer[1], layer[2], layer[3] * parseFloat(factor)] : layer, backdrop);
    }
    if (!fg || !backdrop) return { fg: fgName, bg, ratio: 0, floor, pass: false };
    const r = ratio(fg[3] < 1 ? over(fg, backdrop) : [fg[0], fg[1], fg[2]], backdrop);
    return { fg: fgName, bg, ratio: r, floor, pass: r >= floor };
  });
}
