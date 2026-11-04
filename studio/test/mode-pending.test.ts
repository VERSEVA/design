// The mode button before hydration: the head script records the stored mode on <html>
// (data-mode), and studio.css draws that mode's icon from it, so the server's System
// placeholder never shows a wrong icon and nothing animates on load.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (f: string) => fs.readFileSync(path.resolve(__dirname, f), 'utf8');
const headScript = () => new DOMParser().parseFromString(read('../index.html'), 'text/html').querySelector('head script:not([src])')!.textContent!;

afterEach(() => { localStorage.clear(); delete document.documentElement.dataset.mode; delete document.documentElement.dataset.theme; delete document.documentElement.dataset.brand; });

describe('mode button before hydration', () => {
  for (const [stored, mode] of [['light', 'light'], ['dark', 'dark'], ['', 'dark'], ['system', 'system'], [null, 'system'], ['junk', 'system']] as const) {
    it(`the head script records stored ${JSON.stringify(stored)} as data-mode="${mode}"`, () => {
      if (stored !== null) localStorage.setItem('verseva-theme', stored);
      new Function(headScript())();
      expect(document.documentElement.dataset.mode).toBe(mode);
    });
  }

  it('studio.css draws exactly one icon per recorded mode, and the system icon with no script', () => {
    const css = read('../src/studio.css');
    expect(css).toContain('.modebtn .mi { display: none; }');
    for (const m of ['light', 'dark', 'system']) expect(css).toContain(`:root[data-mode="${m}"] .modebtn .mi-${m} { display: block; }`);
    expect(css).toContain(':root:not([data-mode]) .modebtn .mi-system { display: block; }');
    /* no transition or animation on the icon: hydration and first paint change nothing on screen */
    expect(css).not.toMatch(/\.modebtn[^{]*\{[^}]*(transition|animation)/);
  });
});
