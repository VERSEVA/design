// The Mode control before hydration: the head script records the stored mode on <html>
// (data-mode), and studio.css draws that option as selected while the control is pending,
// with the exact look of the selected segment, so hydration changes nothing on screen.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MODES } from '../src/theme';

const read = (f: string) => fs.readFileSync(path.resolve(__dirname, f), 'utf8');
const headScript = () => new DOMParser().parseFromString(read('../index.html'), 'text/html').querySelector('head script:not([src])')!.textContent!;
/** Declarations of the rule whose selector list contains `selector` (exact, then "{" or ","). */
const decls = (css: string, selector: string) => {
  const m = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[{,]`).exec(css);
  expect(m, selector).toBeTruthy();
  const i = m!.index;
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  return Object.fromEntries(body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(':'); return [k.trim(), v.join(':').trim()]; }).filter(([k]) => k !== 'transition'));
};

afterEach(() => { localStorage.clear(); delete document.documentElement.dataset.mode; delete document.documentElement.dataset.theme; delete document.documentElement.dataset.brand; });

describe('Mode control before hydration', () => {
  for (const [stored, mode] of [['light', 'light'], ['dark', 'dark'], ['', 'dark'], ['system', 'system'], [null, 'system'], ['junk', 'system']] as const) {
    it(`the head script records stored ${JSON.stringify(stored)} as data-mode="${mode}"`, () => {
      if (stored !== null) localStorage.setItem('verseva-theme', stored);
      new Function(headScript())();
      expect(document.documentElement.dataset.mode).toBe(mode);
    });
  }

  it('studio.css draws the recorded option with the selected segment look while pending', () => {
    const studio = read('../src/studio.css');
    const selected = decls(read('../../components.css'), '.seg button[aria-selected="true"]');
    expect(MODES.map((m) => m.value)).toEqual(['light', 'dark', 'system']);
    MODES.forEach((m, i) => {
      const sel = `:root[data-mode="${m.value}"] .modeswitch[data-pending] .seg button:nth-child(${i + 1})`;
      expect(studio, sel).toContain(sel);
    });
    for (const [i, m] of MODES.entries()) expect(decls(studio, `:root[data-mode="${m.value}"] .modeswitch[data-pending] .seg button:nth-child(${i + 1})`)).toEqual(selected);
    /* the server-marked System steps back to the plain segment look */
    const plain = decls(read('../../components.css'), '.seg button');
    const reset = decls(studio, ':root[data-mode] .modeswitch[data-pending] .seg button[aria-selected="true"]');
    expect(reset.background).toBe(plain.background);
    expect(reset.color).toBe(plain.color);
    expect(reset['box-shadow']).toBe('none');
    expect(studio).toContain(':root[data-mode] .modeswitch[data-pending] .seg button { transition: none; }');
  });
});
