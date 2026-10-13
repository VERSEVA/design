// Token model: tokens.css + themes/*.css -> src/data/tokens.json.
// Shape: [{ name, family, dark, light, brands: { <slug>: { dark, light } } }].
// Every token belongs to exactly one family; an unsectioned or doubly
// sectioned token fails the build rather than vanishing from the studio.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FAMILIES = [
  { id: 'canvas', label: 'Canvas and text', match: /^(bg|surface(-\d+)?|hairline(-soft|-strong)?|text-\d+)$/ },
  { id: 'accent', label: 'Accent', match: /^(accent(-[\w-]+)?|focus|highlight)$/ },
  { id: 'status', label: 'Status', match: /^(success|warn|danger)(-bg)?$/ },
  { id: 'data', label: 'Data', match: /^(data|chart)-[\w-]+$/ },
  { id: 'material', label: 'Material and elevation', match: /^(glass-[\w-]+|surface-body|e-\d+)$/ },
  { id: 'radius', label: 'Radius', match: /^r-[\w-]+$/ },
  { id: 'spacing', label: 'Spacing', match: /^s-\d+$/ },
  { id: 'type', label: 'Type', match: /^(font|display|heading|btn)-[\w-]+$/ },
  { id: 'motion', label: 'Motion', match: /^(dur|ease)-[\w-]+$/ },
  { id: 'layout', label: 'Layout', match: /^(nav|container)-[\w-]+$/ },
];

export function familyOf(name) {
  const bare = name.replace(/^--/, '');
  const hits = FAMILIES.filter((f) => f.match.test(bare));
  if (hits.length === 0) throw new Error(`unsectioned token --${bare}`);
  if (hits.length > 1) throw new Error(`token --${bare} matches ${hits.map((f) => f.id).join(' and ')}`);
  return hits[0].id;
}

/** Brace-depth scan: [{ selector, props }] for every block declaring custom properties. */
export function blocksOf(cssRaw) {
  const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
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
      const props = {};
      for (const m of css.slice(i + 1, j - 1).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) props[`--${m[1]}`] = m[2].trim().replace(/\s+/g, ' ');
      if (Object.keys(props).length) out.push({ selector: css.slice(selStart, i).trim(), props });
      i = j;
      selStart = j;
    } else {
      if (css[i] === '}') selStart = i + 1;
      i++;
    }
  }
  return out;
}

/** @typedef {{ name: string, family: string, dark: string, light: string, brands: Record<string, { dark: string, light: string }> }} TokenRow */

/**
 * @param {string} tokensCss the signature tokens.css
 * @param {Record<string, string>} themes slug -> theme.css text
 * @returns {TokenRow[]}
 */
export function buildTokens(tokensCss, themes) {
  const base = {};
  const light = {};
  for (const { selector, props } of blocksOf(tokensCss)) {
    if (/\[data-theme="light"\]/.test(selector)) Object.assign(light, props);
    else if (selector.includes(':root')) Object.assign(base, props);
  }
  const brands = {};
  for (const [slug, css] of Object.entries(themes)) {
    brands[slug] = { dark: {}, light: {} };
    for (const { selector, props } of blocksOf(css)) {
      if (!selector.includes(`[data-brand="${slug}"]`)) continue;
      Object.assign(brands[slug][/\[data-theme="light"\]/.test(selector) ? 'light' : 'dark'], props);
    }
  }
  const names = new Set([...Object.keys(base), ...Object.keys(light)]);
  for (const b of Object.values(brands)) for (const n of [...Object.keys(b.dark), ...Object.keys(b.light)]) names.add(n);
  for (const n of names) familyOf(n);

  return [...names].map((name) => {
    const dark = base[name] ?? '';
    const lt = light[name] ?? dark;
    const per = {};
    for (const [slug, b] of Object.entries(brands)) {
      if (!(name in b.dark) && !(name in b.light)) continue;
      per[slug] = { dark: b.dark[name] ?? dark, light: b.light[name] ?? b.dark[name] ?? lt };
    }
    return { name, family: familyOf(name), dark, light: lt, brands: per };
  });
}

if (process.argv[1] && import.meta.url.startsWith('file:') && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  const themeDir = path.join(repo, 'themes');
  const themes = Object.fromEntries(
    fs.readdirSync(themeDir).filter((f) => f.endsWith('.css')).sort()
      .map((f) => [f.replace(/\.css$/, ''), fs.readFileSync(path.join(themeDir, f), 'utf8')]),
  );
  const model = buildTokens(fs.readFileSync(path.join(repo, 'tokens.css'), 'utf8'), themes);
  const out = fileURLToPath(new URL('../src/data/tokens.json', import.meta.url));
  fs.writeFileSync(out, `${JSON.stringify(model, null, 2)}\n`);
  console.log(`tokens-model: ${model.length} tokens -> src/data/tokens.json`);
}
