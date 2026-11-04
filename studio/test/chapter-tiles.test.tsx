// The chapters redesigned onto the studio specimen tiles after Components (1.7.0): Web UI,
// Distribute, Docs + PDF. These replace each chapter's retired element-for-element parity with
// its frozen site/*.html (test/redesigned.ts): the tile contract per page, the rail anchors on
// their tiles, and a bento with no holes at the package's 4- and 2-column breakpoints.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type React from 'react';
import { NATIVE_CHAPTERS, NATIVE_FROZEN } from '../src/shell/routes';
import { REDESIGNED } from './redesigned';
import chapters from '../src/data/chapters.json';

const SPAN: Record<string, Record<number, [number, number]>> = {
  /* [columns, rows] per size, as components.css spans them at 4 columns (>=1100px) and 2 (560 to 1099px). */
  s: { 4: [1, 1], 2: [1, 1] },
  m: { 4: [2, 1], 2: [2, 1] },
  l: { 4: [2, 2], 2: [2, 2] },
  xl: { 4: [4, 1], 2: [2, 1] },
};

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

const PAGES = ['web-ui', 'distribute', 'docs-pdf'] as const;
const page = (slug: string) => { const Page = NATIVE_CHAPTERS[slug] as () => React.ReactElement; return render(<Page />).container; };
const grids = (root: Element) => [...root.querySelectorAll('.chap .wgrid.sgrid')];
const sizesOf = (grid: Element) => [...grid.children].map((t) => t.getAttribute('data-size')!);

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
      expect(holes(sizes, 4), sizes.join(',')).toBe(0);
      expect(holes(sizes, 2), sizes.join(',')).toBe(0);
    }
  });

  it('keeps header meta to neutral counts, carries no em dash and no doctrine sublabels, and shows no code it has no sample for', () => {
    const root = page(slug);
    for (const m of root.querySelectorAll('.wtile-meta')) {
      expect(m.textContent).toMatch(/^\d+ [a-z]+$/);
      expect(m.closest('[class*="accent"]')).toBeNull();
    }
    expect(root.querySelector('.chap')!.textContent).not.toContain(String.fromCharCode(0x2014));
    expect(root.querySelector('.speclabel, .specstack, .stile-toggle')).toBeNull();
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
