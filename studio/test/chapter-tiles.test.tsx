// The chapters redesigned onto the studio specimen tiles after Components (1.7.0): Web UI,
// Distribute, Docs + PDF, Data viz, Motion, Decks. These replace each chapter's retired element-for-element parity with
// its frozen site/*.html (test/redesigned.ts): the tile contract per page, the rail anchors on
// their tiles, and a bento with no holes at the package's 4- and 2-column breakpoints.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import type React from 'react';
import { NATIVE_CHAPTERS, NATIVE_FROZEN } from '../src/shell/routes';
import { REDESIGNED } from './redesigned';
import chapters from '../src/data/chapters.json';

/* The spans as the stylesheets write them, read from components.css (.wgrid columns, .wtile[data-size]
   spans, the 1100px override) and tiles.css (XL on one content row), so a CSS change reaches this test. */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const PACKAGE_CSS = strip(fs.readFileSync(path.resolve(__dirname, '../../components.css'), 'utf8'));
const TILES_CSS = strip(fs.readFileSync(path.resolve(__dirname, '../src/tiles/tiles.css'), 'utf8'));
const mediaBody = (css: string, q: string) => {
  const i = css.indexOf(`@media (${q}){`);
  if (i < 0) return '';
  let depth = 0, j = css.indexOf('{', i);
  const start = j + 1;
  for (; j < css.length; j++) { if (css[j] === '{') depth++; else if (css[j] === '}' && --depth === 0) break; }
  return css.slice(start, j);
};
const outsideMedia = (css: string) => css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
function spansFromCss(): { cols: Record<'wide' | 'mid', number>; span: Record<string, Record<number, [number, number]>> } {
  const base = outsideMedia(PACKAGE_CSS), mid = mediaBody(PACKAGE_CSS, 'max-width:1099.98px');
  const colsOf = (css: string) => Number(css.match(/\.wgrid\{[^}]*grid-template-columns:repeat\((\d+),/)![1]);
  const span = (css: string, size: string, axis: 'column' | 'row') => {
    const m = css.match(new RegExp(`\\.wtile\\[data-size="${size}"\\]\\{[^}]*grid-${axis}:span (\\d+)`));
    return m ? Number(m[1]) : undefined;
  };
  const xlRow = Number(TILES_CSS.match(/\.sgrid > \.stile\[data-size="xl"\] \{ grid-row: span (\d+); \}/)![1]);
  const wide = colsOf(base), midCols = colsOf(mid);
  const out: Record<string, Record<number, [number, number]>> = {};
  for (const s of ['s', 'm', 'l', 'xl']) {
    const c = span(base, s, 'column')!, r = s === 'xl' ? xlRow : span(base, s, 'row')!;
    out[s] = { [wide]: [c, r], [midCols]: [span(mid, s, 'column') ?? Math.min(c, midCols), r] };
  }
  return { cols: { wide, mid: midCols }, span: out };
}
const { cols: COLS, span: SPAN } = spansFromCss();

/** Packs tiles the way grid-auto-flow: row does (no dense), and returns every cell left empty,
    a short last row included: the bento is whole only at 0. */
export function holes(sizes: string[], cols: number): number {
  const filled: boolean[][] = [];
  const at = (r: number, c: number) => (filled[r] ??= Array(cols).fill(false))[c];
  let r = 0, c = 0;
  for (const s of sizes) {
    const [w, h] = SPAN[s][cols];
    for (;;) {
      if (c + w > cols) { r++; c = 0; continue; }
      let free = true;
      for (let y = 0; y < h && free; y++) for (let x = 0; x < w && free; x++) if (at(r + y, c + x)) free = false;
      if (free) break;
      c++;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) filled[r + y][c + x] = true;
    c += w;
  }
  return filled.reduce((n, row) => n + row.filter((x) => !x).length, 0);
}

const PAGES = ['web-ui', 'distribute', 'docs-pdf', 'data-viz', 'motion', 'decks'] as const;
/* Pages with generated samples: every tile shows its code. The rest have none to show. */
const SAMPLED_PAGES = new Set(['data-viz', 'motion']);
const css = (slug: string) => fs.readFileSync(path.resolve(__dirname, `../src/chapters/pages/${slug}.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const page = (slug: string) => { const Page = NATIVE_CHAPTERS[slug] as () => React.ReactElement; return render(<Page />).container; };
const grids = (root: Element) => [...root.querySelectorAll('.chap .wgrid.sgrid')];
const sizesOf = (grid: Element) => [...grid.children].map((t) => t.getAttribute('data-size')!);

describe('spans from the stylesheets', () => {
  it('reads 4 and 2 columns, S M L XL as the package writes them, XL to the M span at 2 columns and one row', () => {
    expect(COLS).toEqual({ wide: 4, mid: 2 });
    expect(SPAN).toEqual({ s: { 4: [1, 1], 2: [1, 1] }, m: { 4: [2, 1], 2: [2, 1] }, l: { 4: [2, 2], 2: [2, 2] }, xl: { 4: [4, 1], 2: [2, 1] } });
  });
});

describe('holes()', () => {
  it('counts what row flow leaves empty', () => {
    expect(holes(['m', 'm'], 4)).toBe(0);
    expect(holes(['xl', 'm'], 4)).toBe(2);
    expect(holes(['m', 'xl', 'm'], 4)).toBe(4);
    expect(holes(['l', 'm', 'm'], 4)).toBe(0);
    expect(holes(['xl', 'm'], 2)).toBe(0);
    expect(holes(['s'], 2)).toBe(1);
  });
});

describe.each(PAGES)('%s as tiles', (slug) => {
  const ch = chapters.find((c) => c.slug === slug)!;

  it('is registered redesigned, with no FROZEN pin', () => {
    expect(REDESIGNED[slug]).toBeTruthy();
    expect(NATIVE_FROZEN[slug]).toBeUndefined();
  });

  it('puts every specimen in a tile on a bento grid, and nothing beside the grids but the hero, section heads and footer', () => {
    const root = page(slug);
    const chap = root.querySelector('.chap')!;
    expect(grids(root).length).toBeGreaterThan(0);
    for (const g of grids(root)) for (const t of g.children) expect(t.matches('section.wtile.stile'), t.outerHTML.slice(0, 60)).toBe(true);
    for (const kid of chap.children) expect(kid.matches('section.hero, .wgrid.sgrid, section.ch, footer.site'), kid.className).toBe(true);
    for (const s of chap.querySelectorAll(':scope > section.ch')) expect([...s.children].map((k) => k.matches('h2') || k.matches('.wgrid.sgrid'))).not.toContain(false);
  });

  it('lands every rail anchor on a tile or a tile section, named by its rail label (a " · " suffix aside)', () => {
    const root = page(slug);
    for (const s of ch.sections) {
      const el = root.querySelector<HTMLElement>(`[id="${s.id}"]`)!;
      expect(el, s.id).not.toBeNull();
      expect(el.matches('section.stile, section.ch'), s.id).toBe(true);
      const h2 = el.matches('section.stile') ? el.querySelector(':scope > .wtile-body > .wtile-hd > h2.stile-name') : el.querySelector(':scope > h2');
      expect(h2!.textContent!.split(' · ')[0], s.id).toBe(s.label);
    }
  });

  it('leaves no hole in the bento at 4 columns (1440, 1280) or 2 (1100 down to 560, where XL takes the M span)', () => {
    for (const g of grids(page(slug))) {
      const sizes = sizesOf(g);
      for (const s of sizes) expect(['s', 'm', 'l', 'xl']).toContain(s);
      expect(holes(sizes, COLS.wide), sizes.join(',')).toBe(0);
      expect(holes(sizes, COLS.mid), sizes.join(',')).toBe(0);
    }
  });

  it('keeps header meta to neutral counts, carries no em dash and no legacy code chrome, and shows code exactly where it has samples', () => {
    const root = page(slug);
    for (const m of root.querySelectorAll('.wtile-meta')) {
      expect(m.textContent).toMatch(/^(\d+ [a-z]+|amended \d{4}-\d{2}-\d{2})$/);
      expect(m.closest('[class*="accent"]')).toBeNull();
    }
    expect(root.querySelector('.chap')!.textContent).not.toContain(String.fromCharCode(0x2014));
    expect(root.querySelector('.specstack, .comp, .codewrap, .codetoggle, .copybtn')).toBeNull();
    const tiles = root.querySelectorAll('section.stile');
    expect(root.querySelectorAll('.stile-toggle').length).toBe(SAMPLED_PAGES.has(slug) ? tiles.length : 0);
  });
});

/* The copy guard: every text of the frozen page, in order, must render, but for this written list.
   dropped: legacy text the redesign removes on purpose. changed: legacy text the redesign rewrites,
   with what renders in its place (capitalisation included). A copy edit anywhere else fails. */
export const COPY: Record<string, { dropped: string[]; changed: Record<string, string[]> }> = {
  'web-ui': {
    dropped: [],
    changed: {
      'Radius + press · amended 2026-08-31': ['Radius + press', 'amended 2026-08-31'],
      'buttons · equal-sized pairs, fill decides': ['Buttons'],
      'status · word-carrying chips': ['Status'],
      'card + stat': ['Card + stat'],
      'segmented + field': ['Segmented + field'],
    },
  },
  distribute: { dropped: [], changed: {} },
  'docs-pdf': { dropped: [], changed: {} },
  /* The legacy code panel's Copy button: the tile's own Copy shows only while its code is open. The Data
     viz ruling (law 3) changed colours and classes, no copy, so its changed list is empty. */
  'data-viz': { dropped: ['Copy'], changed: {} },
  motion: { dropped: ['Copy'], changed: {} },
  decks: { dropped: [], changed: {} },
};
const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
const texts = (root: Node) => {
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) { const t = norm(n.textContent!); if (t) out.push(t); return; }
    if (n.nodeType === 1 && ['script', 'style'].includes((n as Element).localName)) return;
    n.childNodes.forEach(walk);
  };
  walk(root);
  return out;
};
export function legacyCopy(slug: string): string[] {
  const file = chapters.find((c) => c.slug === slug)!.file;
  const doc = new DOMParser().parseFromString(fs.readFileSync(path.resolve(__dirname, '../../site', file), 'utf8'), 'text/html');
  const shell = doc.querySelector('.shell')!;
  shell.querySelectorAll('header.topbar, aside.docnav').forEach((n) => n.remove());
  const { dropped, changed } = COPY[slug];
  return texts(shell).flatMap((t) => (dropped.includes(t) ? [] : changed[t] ?? [t]));
}
/** The first expected text not found, in order, among the rendered texts; null when all are. */
export function missingInOrder(want: string[], got: string[]): string | null {
  let i = 0;
  for (const w of want) { while (i < got.length && got[i] !== w) i++; if (i === got.length) return w; i++; }
  return null;
}

describe.each(Object.keys(COPY))('%s copy guard', (slug) => {
  it('renders every text of the frozen page in order, but for its written dropped and changed lists', () => {
    expect(missingInOrder(legacyCopy(slug), texts(page(slug).querySelector('.chap')!))).toBeNull();
  });

  it('uses every entry of its lists, so a stale one fails', () => {
    const file = chapters.find((c) => c.slug === slug)!.file;
    const raw = texts(new DOMParser().parseFromString(fs.readFileSync(path.resolve(__dirname, '../../site', file), 'utf8'), 'text/html').querySelector('.shell')!);
    for (const t of [...COPY[slug].dropped, ...Object.keys(COPY[slug].changed)]) expect(raw, t).toContain(t);
  });
});

describe('copy guard', () => {
  it('fails an edited, a dropped or a reordered text', () => {
    expect(missingInOrder(['a', 'b', 'c'], ['a', 'x', 'b', 'c'])).toBeNull();
    expect(missingInOrder(['a', 'b', 'c'], ['a', 'B', 'c'])).toBe('b');
    expect(missingInOrder(['a', 'b', 'c'], ['a', 'c'])).toBe('b');
    expect(missingInOrder(['a', 'b', 'c'], ['a', 'c', 'b'])).toBe('c');
  });
});

describe('Web UI tiles', () => {
  it('holds the three tables and the four contract specimens, live', () => {
    const root = page('web-ui');
    expect([...root.querySelectorAll('section.stile')].map((t) => [t.querySelector('.stile-name')!.localName, t.getAttribute('data-size')])).toEqual([
      ['h2', 'xl'], ['h2', 'm'], ['h2', 'm'], ['h3', 'm'], ['h3', 'm'], ['h3', 'm'], ['h3', 'm'],
    ]);
    expect([...root.querySelectorAll('section.stile table.ttable')].map((t) => t.querySelectorAll('tbody tr').length)).toEqual([5, 3, 6]);
    const specs = root.querySelector('#contract-specimens')!;
    expect([...specs.querySelectorAll('h3.stile-name')].map((h) => h.textContent)).toEqual(['Buttons', 'Status', 'Card + stat', 'Segmented + field']);
    expect(specs.querySelector('section.stile .wtile-meta')!.textContent).toBe('5 buttons');
    const radius = root.querySelector('#radius-press')!;
    expect([radius.querySelector('.stile-name')!.textContent, radius.querySelector('.wtile-meta')!.textContent]).toEqual(['Radius + press', 'amended 2026-08-31']);
    expect(specs.querySelectorAll('button.btn').length).toBe(7);
    expect(specs.querySelectorAll('.badge').length).toBe(4);
    expect(specs.querySelector<HTMLInputElement>('#spec-name')!.labels![0].textContent).toBe('Client name');
  });
});

describe('Distribute tiles', () => {
  it('holds the command blocks, the agent tool table and the four presets', () => {
    const root = page('distribute');
    expect([...root.querySelectorAll('section.stile')].map((t) => t.getAttribute('data-size'))).toEqual(['m', 'm', 'xl', 'xl']);
    expect([...root.querySelectorAll('pre.cmd')].map((p) => p.textContent!.split('\n').length)).toEqual([5, 2, 1]);
    expect(root.querySelectorAll('#agents tbody tr').length).toBe(5);
    expect(root.querySelectorAll('#theme-presets .badge.ok').length).toBe(4);
  });
});

describe('Docs + PDF tiles', () => {
  it('holds the memo in one XL tile', () => {
    const root = page('docs-pdf');
    const t = root.querySelector('#memo-anatomy')!;
    expect(t.getAttribute('data-size')).toBe('xl');
    expect(t.querySelector('.doc-mock h3')!.textContent).toBe('Say the decision in the title');
    expect(t.querySelector('.doc-mock .callout b')!.textContent).toBe('Recommendation.');
  });
});

describe('Data viz tiles (law 3)', () => {
  it('gives the data accent to one focus tile, Line + area; every other chart is on the text ladder', () => {
    const root = page('data-viz');
    expect([...root.querySelectorAll('section.stile[data-focus]')].map((t) => t.id)).toEqual(['lines']);
    expect(root.querySelectorAll('section.stile:not([data-focus])').length).toBe(9);
  });

  it('names no colour inline: magnitude goes through data-l, categories through series classes', () => {
    const root = page('data-viz');
    for (const el of root.querySelectorAll('[style]')) expect(el.getAttribute('style'), el.outerHTML.slice(0, 80)).not.toMatch(/background|color|--data|--success|--warn|--danger|--accent/);
  });

  it('steps the bar rungs with the value, never against it', () => {
    const root = page('data-viz');
    const bars = [...root.querySelectorAll('#bars .bar')].map((b) => [Number(b.querySelector('.vlab')!.textContent), Number(b.querySelector('.fill')!.getAttribute('data-l'))]);
    expect(bars.length).toBe(5);
    const byValue = [...bars].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
    expect(byValue).toEqual([...byValue].sort((a, b) => a - b));
    expect(new Set(byValue).size).toBeGreaterThan(1);
  });

  it('puts the second series on --data-alt and a third on a neutral, in fixed order', () => {
    const root = page('data-viz');
    expect(root.querySelector('#vseries svg')!.innerHTML).toMatch(/stroke="var\(--data-alt\)"/);
    for (const col of root.querySelectorAll('#stacked .stackcol')) expect([...col.children].map((i) => i.className)).toEqual(['s1', 's2', 's3']);
    expect([...root.querySelectorAll('#stacked .vizlegend i')].map((i) => i.className)).toEqual(['', 'alt', 's3']);
    const c = css('data-viz');
    expect(c).toMatch(/\.stackcol i\.s2 \{ background: var\(--data-alt\);/);
    expect(c).toMatch(/\.stackcol i\.s1 \{ background: var\(--data-3\);/);
  });

  it('keeps status hues out of the chart marks', () => {
    const root = page('data-viz');
    const marks = root.querySelectorAll('.bar, .stackcol, .hbars, .actstrip, .actcal, .vizlegend, .ring, .spark, .vizplot, .srcdot, .microbar');
    for (const m of marks) expect(m.outerHTML).not.toMatch(/--(success|warn|danger)/);
    expect(css('data-viz')).not.toMatch(/--(success|warn|danger)/);
  });

  it('gives every data rung the chapter paints a text-ladder twin for a tile without data-focus', () => {
    const c = css('data-viz');
    for (const [sel] of [['.stackcol i.s1'], ['.vizlegend i[data-l="1"]'], ['.vizlegend i[data-l="2"]'], ['.srcdot i.mom']]) {
      expect(c, sel).toContain(`.wtile:not([data-focus]) ${sel}`);
    }
  });
});

describe('Motion tiles', () => {
  it('puts each demo control in its tile footer, beside Show code', () => {
    const root = page('motion');
    for (const [tile, ctl] of [['entrances', '[data-replay="stagdemo"]'], ['lines', '[data-replay-lines="linedemo"]'], ['numbers', '#tickroll'], ['attention', '#attnfire'], ['loading', '#skload'], ['grow', '#growfire']]) {
      const foot = root.querySelector(`#${tile} > .wtile-body > .wtile-foot`)!;
      expect([...foot.querySelectorAll('button')].map((b) => b.matches(ctl) ? 'ctl' : b.className.includes('stile-toggle') ? 'code' : '?'), tile).toEqual(['ctl', 'code']);
    }
    expect(root.querySelector('#tokens .specimen #firecurves')).not.toBeNull();
    expect(root.querySelector('#wipe .specimen #wipedemo')).not.toBeNull();
  });

  it('animates transform and opacity only in its own CSS', () => {
    const c = css('motion');
    for (const [, v] of c.matchAll(/transition:\s*([^;}]+)/g)) for (const part of v.split(',')) expect(part.trim().split(/\s+/)[0], v).toMatch(/^(transform|opacity)$/);
    expect(c).not.toMatch(/@keyframes/);
  });
});

describe('Decks tiles', () => {
  it('holds the slide and the five-beat structure side by side', () => {
    const root = page('decks');
    expect([...root.querySelectorAll('section.stile')].map((t) => [t.id, t.getAttribute('data-size')])).toEqual([['slide-anatomy', 'm'], ['structure', 'm']]);
    expect(root.querySelector('#slide-anatomy .slide-mock h3')!.textContent).toBe('One claim, stated as a verdict');
    expect(root.querySelectorAll('#structure tbody tr').length).toBe(5);
  });
});
