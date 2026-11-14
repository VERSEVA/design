/**
 * The contrast measurement itself: alpha compositing, WCAG relative
 * luminance and ratio, and the walk over the contract's pair list
 * (bin/contrast-pairs.mjs). Shared by verseva-contrast-gate, which parses
 * token CSS itself, and bin/contrast-resolved.mjs, which measures the
 * values bin/token-resolver.mjs produced (the ones the Swift token files
 * are generated from). One formula, one pair list, two sources of color.
 * Browser-safe: no node: imports.
 *
 * A color here is { r, g, b, a }: channels 0 to 255, alpha 0 to 1.
 */
import { PAIRS } from './contrast-pairs.mjs';

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

/**
 * Measures every pair in one theme. `colorOf(name)` returns the color of a
 * token (named without the leading --) or null when it has none.
 *
 * Each backdrop chain composites over the theme's --bg, bottom layer first,
 * and a translucent foreground composites over that backdrop before it is
 * measured. A required pair that cannot be resolved is a FAILURE, not a
 * skip, and so is a theme with no --bg.
 *
 * Returns { measured, failures, passes, results }: `failures` and `passes`
 * are report lines; `results` has one { pair, ratio, floor } per measured
 * pair, pass or fail.
 */
export function measureTheme(themeName, colorOf) {
  const failures = [];
  const passes = [];
  const results = [];
  const canvas = colorOf('bg');
  if (!canvas) {
    failures.push(`[${themeName}] --bg is unresolvable; nothing can be measured`);
    return { measured: 0, failures, passes, results };
  }
  for (const [fgName, bgChain, floor] of PAIRS) {
    const pair = `${fgName} on ${bgChain.join('+')}`;
    const fg = colorOf(fgName);
    let backdrop = canvas;
    let resolvable = true;
    for (const layerName of [...bgChain].reverse()) {
      const [tokenName, alphaFactor] = layerName.split('*');
      const layer = colorOf(tokenName);
      if (!layer) { resolvable = false; break; }
      const scaled = alphaFactor ? { ...layer, a: layer.a * parseFloat(alphaFactor) } : layer;
      backdrop = compose(scaled, backdrop);
    }
    if (!fg || !resolvable) {
      failures.push(`[${themeName}] ${pair}  UNRESOLVABLE (required pair; the gate must measure it)`);
      continue;
    }
    const solidFg = fg.a < 1 ? compose(fg, backdrop) : fg;
    const r = ratio(solidFg, backdrop);
    results.push({ pair, ratio: r, floor });
    const line = `[${themeName}] ${pair}  ${r.toFixed(2)}:1  (floor ${floor})`;
    if (r < floor) failures.push(line);
    else passes.push(line);
  }
  return { measured: results.length, failures, passes, results };
}

/**
 * Measures every pair on the output of resolveTokens (bin/token-resolver.mjs),
 * for every theme and mode in it. Only a token the resolver typed as a color
 * counts as one: an unresolved token, a string or a missing token makes its
 * pairs UNRESOLVABLE, which fails.
 *
 * Returns { contexts, measured, failures, passes, results }: `contexts` names
 * each theme and mode measured ("signature·dark", "cobalt·light"), and each
 * result carries its `context`.
 */
export function measureResolved(resolved) {
  const out = { contexts: [], measured: 0, failures: [], passes: [], results: [] };
  for (const [theme, byMode] of Object.entries(resolved.themes)) {
    for (const [mode, tokens] of Object.entries(byMode)) {
      const context = `${theme}·${mode}`;
      const m = measureTheme(context, (name) => (Object.hasOwn(tokens, name) && tokens[name].type === 'color' ? tokens[name] : null));
      out.contexts.push(context);
      out.measured += m.measured;
      out.failures.push(...m.failures);
      out.passes.push(...m.passes);
      out.results.push(...m.results.map((r) => ({ context, ...r })));
    }
  }
  return out;
}
