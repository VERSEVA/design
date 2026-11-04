// Custom accent: from any picked color, --accent, --accent-hover, --accent-ink and --focus
// for dark AND light, each gated live against the same floors the contrast gate holds
// (bin/contrast-pairs.mjs). A failing pick moves in OKLCH lightness to the nearest pass.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { deriveAccent, themeCss, styleText, fromOklch, toOklch, hueHex, normalizeHex, hueBase, pickAtHue } from '../src/shell/accent';
import { ratio, parseColor, type RGB } from '../src/contrast';
import tokens from '../src/data/tokens.json';

const repo = path.resolve(__dirname, '../..');
const MODES = ['dark', 'light'] as const;

/* 72 hues at three lightness/chroma pairs, plus the classic traps: yellows, near white, near black, greys. */
const HUES = Array.from({ length: 72 }, (_, i) => i * 5);
const SPREAD = HUES.flatMap((h) => [[0.62, 0.2], [0.85, 0.17], [0.3, 0.12]].map(([l, c]) => fromOklch(l, c, h)));
const TRAPS = ['#ffff00', '#ffd60a', '#f5e050', '#fff8b0', '#ffffff', '#fefefe', '#000000', '#010203', '#808080', '#7f7f00', '#00ff00', '#0000ff', '#ff00ff'];

describe('deriveAccent', () => {
  it('passes every check in both modes for every hue, yellow, near white and near black', () => {
    const bad: string[] = [];
    for (const pick of [...SPREAD, ...TRAPS]) {
      const d = deriveAccent(pick);
      for (const m of MODES) for (const c of d[m].checks) if (!c.pass) bad.push(`${pick} ${m} ${c.id} ${c.ratio.toFixed(2)} < ${c.floor}`);
    }
    expect(bad).toEqual([]);
  });

  it('checks ink on accent and hover at 4.5, the accent on bg and both surfaces at 3, and text on the tint at 4.5', () => {
    const d = deriveAccent('#4d9fff');
    expect(d.dark.checks.map((c) => [c.id, c.floor])).toEqual([
      ['ink-accent', 4.5], ['ink-hover', 4.5], ['accent-bg', 3], ['hover-bg', 3], ['accent-surface', 3], ['accent-surface-2', 3], ['text-tint', 4.5],
    ]);
  });

  it('keeps a pick that already passes, exactly', () => {
    const d = deriveAccent('#4D9FFF');
    expect(d.dark.adjusted).toBe(false);
    expect(d.dark.accent).toBe('#4D9FFF');
    expect(d.dark.focus).toBe(d.dark.accent);
  });

  it('moves a failing pick in lightness only, to the nearest passing value, and says so', () => {
    const d = deriveAccent('#ffff00');
    /* yellow on the light canvas fails at 3:1; it darkens, hue held */
    expect(d.light.pickChecks.some((c) => !c.pass)).toBe(true);
    expect(d.light.adjusted).toBe(true);
    const [l0, , h0] = toOklch('#ffff00');
    const [l1, , h1] = toOklch(d.light.accent);
    expect(l1).toBeLessThan(l0);
    expect(Math.abs(h1 - h0)).toBeLessThan(6);
    /* nearest: one step lighter fails */
    const lighter = deriveAccent(fromOklch(l1 + 0.02, toOklch(d.light.accent)[1], h1));
    expect(lighter.light.pickChecks.every((c) => c.pass)).toBe(false);
  });

  it('a near-black pick lightens for dark mode and a near-white pick darkens for light mode', () => {
    expect(toOklch(deriveAccent('#010203').dark.accent)[0]).toBeGreaterThan(toOklch('#010203')[0]);
    expect(toOklch(deriveAccent('#fefefe').light.accent)[0]).toBeLessThan(toOklch('#fefefe')[0]);
  });

  it('round-trips OKLCH and normalizes hex input', () => {
    for (const hex of ['#4D9FFF', '#C42B21', '#0E7A46']) expect(fromOklch(...toOklch(hex))).toBe(hex);
    expect(normalizeHex('4d9fff')).toBe('#4D9FFF');
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('#12345g')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
    expect(hueHex('#4D9FFF', 140)).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('hover', () => {
  const rgb = (h: string): RGB => { const c = parseColor(h)!; return [c[0], c[1], c[2]]; };
  const bg = (m: 'dark' | 'light') => rgb((tokens as ReadonlyArray<{ name: string; dark: string; light: string }>).find((t) => t.name === '--bg')![m]);

  it('steps away from the page, as the presets do: lighter in dark mode, darker in light mode', () => {
    const d = deriveAccent('#0000FF');
    expect(toOklch(d.dark.hover)[0]).toBeGreaterThan(toOklch(d.dark.accent)[0]);
    expect(toOklch(d.light.hover)[0]).toBeLessThan(toOklch(d.light.accent)[0]);
    expect(ratio(rgb(d.dark.hover), bg('dark'))).toBeGreaterThanOrEqual(3);
  });

  it('every 3-digit pick (all 4,096) clears every check, hover on bg included, in both modes', () => {
    const bad: string[] = [];
    const hex = '0123456789ABCDEF';
    for (const r of hex) for (const g of hex) for (const b of hex) {
      const d = deriveAccent(`#${r}${g}${b}`);
      for (const m of MODES) {
        for (const c of d[m].checks) if (!c.pass) bad.push(`#${r}${g}${b} ${m} ${c.id}`);
        if (ratio(rgb(d[m].hover), bg(m)) < 3) bad.push(`#${r}${g}${b} ${m} hover/bg`);
      }
    }
    expect(bad.slice(0, 20)).toEqual([]);
  }, 120_000);
});

describe('hue control', () => {
  const PICKS = ['#FFFF00', '#4D9FFF', '#E8352E', '#0E7A46', '#7C3AED', '#808080', '#FFD60A', '#00FFFF', '#112233', ...Array.from({ length: 24 }, (_, i) => fromOklch(0.4 + (i % 5) * 0.12, 0.05 + (i % 4) * 0.05, i * 15))];

  it('N steps right then N left returns the original pick, for any N', () => {
    const bad: string[] = [];
    for (const pick of PICKS) {
      const base = hueBase(pick);
      for (const n of [1, 5, 20, 36, 90, 180, 359]) {
        let v = base.slider;
        for (let i = 0; i < n; i++) v = (v + 1) % 360;
        for (let i = 0; i < n; i++) v = (v + 359) % 360;
        const out = pickAtHue(base, v);
        if (out !== pick) bad.push(`${pick} n=${n} -> ${out}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps the original lightness and chroma as the source: no drift and no sticking', () => {
    const base = hueBase('#FFFF00');
    /* every step is computed from the original L and C, so the hue keeps moving */
    const outs: string[] = [];
    for (let k = 1; k <= 120; k++) outs.push(pickAtHue(base, (base.slider + k) % 360));
    expect(new Set(outs).size).toBeGreaterThan(90);
    /* the reported stick: 36 presses right from yellow kept landing on the same 148 degree color */
    expect(pickAtHue(base, (base.slider + 37) % 360)).not.toBe(pickAtHue(base, (base.slider + 36) % 360));
    /* and chroma comes from the base, not the last clipped output */
    const at = (base.slider + 20) % 360;
    expect(pickAtHue(base, at)).toBe(fromOklch(base.L, base.C, at));
    /* 20 right then 20 left is the pick, not a washed-out copy */
    expect(pickAtHue(base, base.slider)).toBe('#FFFF00');
  });
});

describe('Copy theme', () => {
  const shape = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '').trim()
    .replace(/#[0-9A-Fa-f]{6}/g, '#HEX').replace(/data-brand="[a-z]+"/g, 'data-brand="SLUG"').replace(/\s+/g, ' ');

  it('is a [data-brand="custom"] theme.css in the same shape as themes/*.css', () => {
    const css = themeCss(deriveAccent('#7c3aed'));
    expect(css.startsWith('/* ')).toBe(true);
    for (const f of fs.readdirSync(path.join(repo, 'themes'))) {
      expect(shape(css), f).toBe(shape(fs.readFileSync(path.join(repo, 'themes', f), 'utf8')));
    }
    expect(css).toContain('[data-brand="custom"] {');
    expect(css).toContain('[data-brand="custom"][data-theme="light"] {');
  });

  it('parses: the contrast gate measures it clean in all four theme axes', () => {
    for (const pick of ['#7c3aed', '#ffff00', '#fefefe', '#010203']) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsv-custom-'));
      const file = path.join(dir, 'custom.css');
      fs.writeFileSync(file, themeCss(deriveAccent(pick)));
      const out = execFileSync(process.execPath, [path.join(repo, 'bin/contrast-gate.mjs'), '--tokens', path.join(repo, 'tokens.css'), '--tokens', file], { encoding: 'utf8' });
      expect(out, pick).toMatch(/clean \(\d+ pairs measured across 4 themes, 0 skipped\)/);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the runtime style text carries the same values as the copied file', () => {
    const d = deriveAccent('#0e7a46');
    const t = styleText({ dark: d.dark, light: d.light });
    for (const m of MODES) for (const v of [d[m].accent, d[m].hover, d[m].ink]) expect(t).toContain(v);
    expect(t).toBe(`:root[data-brand="custom"]{--accent:${d.dark.accent};--accent-hover:${d.dark.hover};--accent-ink:${d.dark.ink};--focus:${d.dark.accent}}:root[data-brand="custom"][data-theme="light"]{--accent:${d.light.accent};--accent-hover:${d.light.hover};--accent-ink:${d.light.ink};--focus:${d.light.accent}}`);
  });
});
