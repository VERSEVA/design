// A deep-linked heading must land below the sticky studio chrome at every width.
// One variable (--studio-scroll-pad) drives every scroll margin; it is built from
// the header's and the phone select's real heights, measured live, with per-breakpoint
// fallbacks for the first paint.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { App } from '../src/App';

const SRC = path.resolve(__dirname, '../src');
const cssFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  return d.isDirectory() ? cssFiles(p) : p.endsWith('.css') ? [p] : [];
});
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const STUDIO = strip(fs.readFileSync(path.join(SRC, 'studio.css'), 'utf8'));
const block = (css: string, sel: string) => {
  const i = css.indexOf(`${sel} {`);
  return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
};
const mobile = STUDIO.slice(STUDIO.indexOf('@media (max-width: 760px)'));

describe('sticky offset: one variable for every scroll margin', () => {
  it('every scroll-margin-top in the studio reads --studio-scroll-pad, never a pixel literal', () => {
    const hits = cssFiles(SRC).flatMap((f) => [...strip(fs.readFileSync(f, 'utf8')).matchAll(/scroll-margin-top:\s*([^;}]+)/g)].map((m) => `${path.relative(SRC, f)}: ${m[1].trim()}`));
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits.filter((h) => !h.endsWith('var(--studio-scroll-pad)'))).toEqual([]);
  });

  it('the variable is the header plus the phone select, with fallbacks at each breakpoint', () => {
    const root = block(STUDIO, ':root');
    expect(root).toMatch(/--studio-head-h:\s*\d+px/);
    expect(root).toMatch(/--studio-select-h:\s*0px/);
    expect(root).toMatch(/--studio-scroll-pad:\s*calc\(var\(--studio-head-h\) \+ var\(--studio-select-h\) \+ var\(--s-\d\)\)/);
    expect(block(mobile, ':root')).toMatch(/--studio-head-h:\s*\d+px/);
    expect(block(mobile, ':root')).toMatch(/--studio-select-h:\s*\d+px/);
    expect(mobile).toMatch(/\.studio-select \{[^}]*top:\s*var\(--studio-head-h\)/);
    expect(STUDIO).toMatch(/\.studio-side \{[^}]*top:\s*var\(--studio-head-h\)/);
  });
});

describe('sticky offset: measured live', () => {
  let observed: Element[] = [];
  let fire: () => void = () => {};
  const heights = new Map<string, number>();
  beforeEach(() => {
    observed = [];
    window.history.replaceState(null, '', '/foundations');
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { fire = cb; }
      observe(el: Element) { observed.push(el); }
      disconnect() {}
      unobserve() {}
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const h = [...heights].find(([sel]) => this.matches(sel))?.[1] ?? 0;
      return { height: h, width: 0, top: 0, left: 0, right: 0, bottom: h, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); heights.clear(); document.documentElement.style.cssText = ''; });

  it('writes the header and select heights to the root and follows a resize', () => {
    heights.set('.studio-head', 191).set('.studio-select', 61);
    render(<App />);
    const root = document.documentElement.style;
    expect(root.getPropertyValue('--studio-head-h')).toBe('191px');
    expect(root.getPropertyValue('--studio-select-h')).toBe('61px');
    expect(observed.map((e) => e.className)).toEqual(expect.arrayContaining(['studio-head', 'studio-select']));
    heights.set('.studio-head', 65).set('.studio-select', 0);
    act(() => fire());
    expect(root.getPropertyValue('--studio-head-h')).toBe('65px');
    expect(root.getPropertyValue('--studio-select-h')).toBe('0px');
  });
});

describe('cold deep link', () => {
  it('a cold load of /foundations#motion lands on the section once', async () => {
    window.history.replaceState(null, '', '/foundations#motion');
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<App />);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(spy.mock.contexts.filter((el) => (el as Element).id === 'motion')).toHaveLength(1);
    spy.mockRestore();
  });
});
