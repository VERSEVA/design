// @vitest-environment jsdom
// Ported chapters' CSS cannot drift from the legacy site.css, cannot leak out of
// its chapter, and its .chap scope cannot flip a rule components.css used to win.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(repo, p), 'utf8');

interface Rule { media: string; selectors: string[]; decls: string[] }

/* A small CSS reader: rules with their @media context; @keyframes skipped. */
export function rules(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  const walk = (s: string, media: string) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf('{', i);
      if (open < 0) break;
      const head = s.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (depth && j < s.length) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
      const body = s.slice(open + 1, j - 1);
      if (head.startsWith('@media')) walk(body, head.replace(/\s+/g, ' '));
      else if (!head.startsWith('@')) {
        out.push({
          media,
          selectors: head.split(',').map((x) => x.trim().replace(/\s+/g, ' ')),
          decls: body.split(';').map((d) => d.trim().replace(/\s*:\s*/, ': ').replace(/\s+/g, ' ')).filter(Boolean),
        });
      }
      i = j;
    }
  };
  walk(src, '');
  return out;
}

const unscope = (sel: string) => sel.replace(/^(:where\(\.chap\)|\.chap) /, '');

/* site.css rules a port leaves behind, and why. */
const LEFT_BEHIND: Record<string, string> = {
  body: 'the .chap root carries its type and colour',
  '.shell': 'the .chap root carries its width and padding',
  '.topbar': 'the studio header replaces it', '.wordmark': 'studio header', '.stop': 'studio header',
  '.topbar nav': 'studio header', '.topbar nav a': 'studio header', '.topbar nav a.on': 'studio header',
  '.wordmark .vmark': 'studio header', '#themeflip': 'studio theme control', '#themeflip .ticon': 'studio theme control',
  '#themeflip .tmoon': 'studio theme control', '[data-theme="light"] #themeflip .tsun': 'studio theme control',
  '[data-theme="light"] #themeflip .tmoon': 'studio theme control',
  '::view-transition-old(root)': 'studio theme wipe', '::view-transition-new(root)': 'studio theme wipe',
  '.docnav': 'stripped from ports: the studio sidebar replaces it', '.docnav a': 'stripped', '.docnav a:hover': 'stripped', '.docnav a.on': 'stripped',
  '.cardgrid': 'index.html only, not a chapter', '.chapcard': 'index.html only', '.chapcard:hover': 'index.html only',
  '.chapcard:active': 'index.html only', '.chapcard b': 'index.html only', '.chapcard span': 'index.html only',
  '.cardgrid > *': 'index.html only', '.cardgrid > *:nth-child(2)': 'index.html only', '.cardgrid > *:nth-child(3)': 'index.html only',
  '.cardgrid > *:nth-child(4)': 'index.html only', '.cardgrid > *:nth-child(5)': 'index.html only', '.cardgrid > *:nth-child(6)': 'index.html only',
};

/* What native.css says that site.css does not, and why. Keyed by media|selector. */
const ADDED: Record<string, { decls: string[]; why: string }> = {
  '|.chap': { decls: ['max-width: var(--container-content)', 'margin: 0 auto', 'padding: 0 var(--s-5) var(--s-9)', 'color: var(--text-1)', 'font-family: var(--font-sans)', 'font-size: 15px', 'line-height: 1.6'], why: 'the legacy body and .shell, as the port root' },
  '|[id]': { decls: ['scroll-margin-top: 80px'], why: 'the embed markers scrolled clear of the sticky studio header' },
  '|.docgrid': { decls: ['grid-template-columns: minmax(0, 1fr)'], why: 'the embed fold collapsed the docnav column; ports strip the docnav' },
  '|.swatch': { decls: ['flex: initial'], why: 'studio.css .swatch sets flex: none' },
  '@media (max-width: 760px)|.seg button': { decls: ['min-height: auto'], why: 'studio.css raises shell .seg buttons to 44px on phones' },
};
/* site.css declarations a port overrides on purpose. */
const REPLACED: Record<string, string[]> = { '|.docgrid': ['grid-template-columns: 190px minmax(0, 1fr)'], '@media (max-width: 900px)|.docgrid': ['grid-template-columns: 1fr'] };

describe('native.css against site.css', () => {
  const site = rules(read('site/site.css'));
  const native = rules(read('studio/src/chapters/native.css'));
  const siteMap = new Map<string, string[]>();
  for (const r of site) for (const s of r.selectors) siteMap.set(`${r.media}|${s}`, [...(siteMap.get(`${r.media}|${s}`) ?? []), ...r.decls]);
  const nativeMap = new Map<string, string[]>();
  for (const r of native) for (const s of r.selectors) {
    const k = `${r.media}|${s === '.chap' ? '.chap' : unscope(s)}`;
    nativeMap.set(k, [...(nativeMap.get(k) ?? []), ...r.decls]);
  }

  it('scopes every native.css selector to .chap', () => {
    const bad = native.flatMap((r) => r.selectors).filter((s) => s !== '.chap' && !/^(:where\(\.chap\)|\.chap) /.test(s));
    expect(bad).toEqual([]);
  });

  it('declares exactly what site.css declares, plus the written additions', () => {
    const drift: string[] = [];
    for (const [k, got] of nativeMap) {
      const want = [...(siteMap.get(k) ?? []).filter((d) => !(REPLACED[k] ?? []).includes(d)), ...(ADDED[k]?.decls ?? [])];
      const a = [...got].sort().join('; '), b = [...want].sort().join('; ');
      if (a !== b) drift.push(`${k}\n  native: ${a}\n  expect: ${b}`);
    }
    expect(drift.join('\n')).toBe('');
  });

  it('ports every site.css rule except the written list it leaves behind', () => {
    const missing = [...siteMap.keys()].filter((k) => !nativeMap.has(k) && !LEFT_BEHIND[k.split('|')[1]] && !REPLACED[k]);
    expect(missing).toEqual([]);
  });
});

/* Specificity as [ids, classes, types]. Enough for the selectors in these files. */
function specificity(sel: string): [number, number, number] {
  let s = sel.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '');
  let ids = 0, cls = 0, tags = 0;
  s = s.replace(/:(?:is|not|has)\(((?:[^()]|\([^()]*\))*)\)/g, (_, inner: string) => {
    const best = inner.split(',').map((x) => specificity(x.trim())).sort((x, y) => cmp(y, x))[0];
    ids += best[0]; cls += best[1]; tags += best[2]; return ' ';
  });
  ids += (s.match(/#[\w-]+/g) ?? []).length;
  cls += (s.match(/\.[\w-]+|\[[^\]]*\]|(?<!:):(?!:)[\w-]+(\([^)]*\))?/g) ?? []).length;
  tags += (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length + (s.match(/::[\w-]+/g) ?? []).length;
  return [ids, cls, tags];
}
const cmp = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const subject = (sel: string) => {
  const parts = sel.replace(/:(?:not|has|is|where)\((?:[^()]|\([^()]*\))*\)/g, '').trim().split(/[\s>+~]+/);
  const last = parts[parts.length - 1].replace(/::?[\w-]+(\([^)]*\))?/g, '');
  return { tag: (last.match(/^[a-z][\w-]*/i) ?? [''])[0], classes: last.match(/\.[\w-]+/g) ?? ([] as string[]) };
};
const prop = (d: string) => d.split(':')[0].trim();

/* Every element of every legacy chapter body: a flip only matters where some element matches both rules. */
const CHAPTER_FILES = ['components', 'web-ui', 'data-viz', 'motion', 'decks', 'docs-pdf', 'distribute', 'examples'];
const legacyEls = CHAPTER_FILES.flatMap((f) => [...new DOMParser().parseFromString(read(`site/${f}.html`), 'text/html').querySelectorAll('.shell *')]);
const both = (a: string, b: string) => { try { return legacyEls.some((el) => el.matches(a) && el.matches(b)); } catch { return true; } };

describe('the .chap scope against components.css', () => {
  it('never flips a winner on a legacy element: a components.css rule that beat site.css still beats the port, and vice versa', () => {
    const comp = rules(read('components.css'));
    const native = rules(read('studio/src/chapters/native.css'));
    const flips: string[] = [];
    for (const n of native) for (const scoped of n.selectors) {
      if (scoped === '.chap' || scoped.startsWith(':where(.chap) *')) continue;
      const legacy = unscope(scoped);
      const ns = subject(legacy);
      for (const c of comp) for (const cs of c.selectors) {
        if (c.media !== n.media && c.media && n.media) continue;
        const sub = subject(cs);
        const overlap = sub.classes.some((x) => ns.classes.includes(x)) || (!!sub.tag && sub.tag === ns.tag && !sub.classes.length);
        if (!overlap) continue;
        const shared = n.decls.map(prop).filter((p) => c.decls.map(prop).includes(p));
        if (!shared.length) continue;
        /* Legacy: site.css loaded after components.css, so site won ties. The port loads
           before components.css (page CSS precedes studio.css), so components wins ties. */
        const legacyWinner = cmp(specificity(legacy), specificity(cs)) >= 0 ? 'site' : 'components';
        const nowWinner = cmp(specificity(scoped), specificity(cs)) > 0 ? 'site' : 'components';
        if (legacyWinner !== nowWinner && both(legacy, cs)) flips.push(`${legacy} vs ${cs}: ${shared.join(', ')} (${legacyWinner} -> ${nowWinner})`);
      }
    }
    expect(flips).toEqual([]);
  });

  it('sees real elements, so a flip on one would fail', () => {
    expect(legacyEls.length).toBeGreaterThan(1000);
    expect(both('.chap .ttable td', '.ttable td')).toBe(false);
    expect(both('.ttable td', 'td')).toBe(true);
  });

  it('reads specificity the way the cascade does', () => {
    expect(specificity('.chap .ttable td:first-child')).toEqual([0, 3, 1]);
    expect(specificity(':where(.chap) *')).toEqual([0, 0, 0]);
    expect(specificity('.seg button[aria-selected="true"]')).toEqual([0, 2, 1]);
  });
});

describe('per-chapter CSS', () => {
  const dir = path.join(repo, 'studio/src/chapters/pages');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.css'));
  it.each(files.length ? files : ['(none yet)'])('%s scopes every selector under its [data-chapter]', (f) => {
    if (f === '(none yet)') return;
    const slug = f.replace(/\.css$/, '');
    const bad = rules(fs.readFileSync(path.join(dir, f), 'utf8')).flatMap((r) => r.selectors).filter((s) => !s.startsWith(`[data-chapter="${slug}"] `));
    expect(bad).toEqual([]);
  });
});
