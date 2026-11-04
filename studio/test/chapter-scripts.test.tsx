// Chapter scripts: what a ported page's legacy inline script became. Each one is
// idempotent across StrictMode's mount, cleanup, mount, and does what it did on the legacy page.
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { StrictMode } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { Page as DataViz } from '../src/chapters/pages/data-viz';
import CODE from '../src/chapters/pages/data-viz.code.json';
import { Page as Motion } from '../src/chapters/pages/motion';
import MOTION_CODE from '../src/chapters/pages/motion.code.json';
import { chapterThemeWipe } from '../src/chapters/themeWipe';
import { Page as Components } from '../src/chapters/pages/components';
import COMPONENTS_CODE from '../src/chapters/pages/components.code.json';

describe('data-viz chapter script', () => {
  it('adds one code toggle per demo, even under StrictMode, and removes them on unmount', () => {
    const { container, unmount } = render(<StrictMode><DataViz /></StrictMode>);
    const demos = [...container.querySelectorAll('.comp')].filter((c) => c.querySelector('.demo') && c.querySelector('.codewrap'));
    expect(demos.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.codetoggle').length).toBe(demos.length);
    expect(container.querySelectorAll('#vseries .reftag').length).toBe(1);
    const chap = container.querySelector('.chap')!;
    unmount();
    expect(chap.querySelectorAll('.codetoggle, #vseries .reftag, .viztip').length).toBe(0);
  });

  it('hides each code sample behind its toggle, shows the legacy sample text, and flips the range', () => {
    const { container } = render(<DataViz />);
    const comp = container.querySelector('#stat')!;
    const cw = comp.querySelector<HTMLElement>('.codewrap')!;
    const btn = comp.querySelector<HTMLButtonElement>('.codetoggle button')!;
    expect(cw.hidden).toBe(true);
    fireEvent.click(btn);
    expect([cw.hidden, btn.textContent, btn.getAttribute('aria-expanded')]).toEqual([false, 'Hide code', 'true']);
    expect(cw.querySelector('code')!.textContent).toBe(CODE[0]);
    const tag = container.querySelector('#vseries .reftag')!;
    expect(tag.textContent).toBe('YOUR AVG · 12 WK');
    fireEvent.click(container.querySelectorAll('#vrange button')[1]);
    expect(tag.textContent).toBe('YOUR AVG · 30 D');
    expect(container.querySelector('#vxlab')!.textContent).toBe('D1D30');
  });

  it('has one generated sample per specimen, each the same markup, attributes and text as its specimen once the script has drawn it', () => {
    const { container } = render(<DataViz />);
    const specs = [...container.querySelectorAll('.comp')].filter((c) => c.querySelector('.codewrap code')).map((c) => c.querySelector('.specimen')!);
    expect(CODE.length).toBe(specs.length);
    specs.forEach((spec, i) => {
      const parsed = document.createElement('div');
      parsed.innerHTML = CODE[i];
      expect(canon(spec), `sample ${i}`).toBe(canon(parsed));
    });
  });

  it('compares attributes and text, so a changed one fails', () => {
    const a = document.createElement('div'), b = document.createElement('div');
    a.innerHTML = '<i style="width: 45%" class="x">4</i>';
    b.innerHTML = '<i style="width:45%" class="x">4</i>';
    expect(canon(a)).toBe(canon(b));
    for (const html of ['<i style="width:46%" class="x">4</i>', '<i style="width:45%" class="y">4</i>', '<i style="width:45%" class="x">5</i>', '<i style="width:45%" class="x" hidden>4</i>']) {
      b.innerHTML = html;
      expect(canon(a), html).not.toBe(canon(b));
    }
  });
});

describe('motion chapter script', () => {
  const pristine = () => new DOMParser().parseFromString(renderToStaticMarkup(<Motion />), 'text/html').querySelector('.chap')!;

  it('is idempotent under StrictMode and leaves the markup exactly as rendered on unmount', async () => {
    const { container, unmount } = render(<StrictMode><Motion /></StrictMode>);
    const magnet = container.querySelector('[data-magnet]')!;
    fireEvent.pointerEnter(magnet);
    fireEvent.pointerMove(magnet, { clientX: 40, clientY: 20 });
    fireEvent.pointerLeave(magnet);
    fireEvent.pointerMove(container.querySelector('[data-spot] .spot')!, { clientX: 30, clientY: 30 });
    fireEvent.click(container.querySelector('[data-replay]')!);
    fireEvent.click(container.querySelector('#firecurves')!);
    await new Promise((r) => setTimeout(r, 60));
    expect(magnet.getAttribute('style')).toContain('transform');
    expect((container.querySelector('[data-spot] .spot') as HTMLElement).style.getPropertyValue('--mx')).not.toBe('');
    const comps = [...container.querySelectorAll('.comp')].filter((c) => c.querySelector('.demo') && c.querySelector('.codewrap'));
    expect(container.querySelectorAll('.codetoggle').length).toBe(comps.length);
    expect(container.querySelectorAll('#tickdemo .td').length).toBe(3);
    expect(window.versevaThemeWipe).toBe(chapterThemeWipe);
    fireEvent.click(container.querySelector('#growfire')!);
    fireEvent.click(container.querySelector('#skload')!);
    fireEvent.click(container.querySelector('#attnfire')!);
    fireEvent.click(container.querySelector('#tickroll')!);
    const chap = container.querySelector('.chap')!;
    unmount();
    expect(window.versevaThemeWipe).toBeUndefined();
    expect(canon(chap)).toBe(canon(pristine()));
  });

  it('gets the .js root class the legacy theme.js set, so the line reveal starts hidden and slides in', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const head = new DOMParser().parseFromString(html, 'text/html').querySelector('head script:not([src])')!.textContent!;
    document.documentElement.classList.remove('js');
    new Function(head)();
    expect(document.documentElement.classList.contains('js')).toBe(true);
  });

  it('runs the demos as the legacy page did', () => {
    const { container } = render(<Motion />);
    const tick = container.querySelector('#tickdemo')!;
    const digits = () => [...tick.querySelectorAll<HTMLElement>('.td')].map((c) => c.style.getPropertyValue('--d')).join('');
    expect([digits(), tick.querySelector('.sr-only')!.textContent]).toEqual(['112', '112']);
    fireEvent.click(container.querySelector('#tickroll')!);
    expect([digits(), tick.querySelector('.sr-only')!.textContent]).toEqual(['148', '148']);
    const grow = container.querySelector('#growfire')!;
    fireEvent.click(grow);
    expect([container.querySelector('#growdemo')!.classList.contains('open'), grow.textContent, grow.getAttribute('aria-expanded')]).toEqual([true, 'Close it', 'true']);
    const sk = container.querySelector<HTMLButtonElement>('#skload')!;
    fireEvent.click(sk);
    expect([container.querySelector('#skdemo .mcard b')!.textContent, sk.disabled]).toEqual(['Q-2081 · Northline', true]);
    const attn = container.querySelector('#attndemo')!;
    fireEvent.click(container.querySelector('#attnfire')!);
    expect(attn.classList.contains('attn')).toBe(true);
  });

  it('hands the wipe demo click to window.versevaThemeWipe, as theme.js did', () => {
    const { container } = render(<Motion />);
    const spy = vi.fn();
    window.versevaThemeWipe = spy;
    fireEvent.click(container.querySelector('#wipedemo')!, { clientX: 12, clientY: 34 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ clientX: 12, clientY: 34 });
    window.versevaThemeWipe = chapterThemeWipe;
  });

  it('has one generated sample per specimen, each the same markup, attributes and text as its specimen once the script has drawn it', () => {
    const { container } = render(<Motion />);
    const specs = [...container.querySelectorAll('.comp')].filter((c) => c.querySelector('.codewrap code')).map((c) => c.querySelector('.specimen')!);
    expect(MOTION_CODE.length).toBe(specs.length);
    specs.forEach((spec, i) => {
      const parsed = document.createElement('div');
      parsed.innerHTML = MOTION_CODE[i];
      expect(canon(spec), `sample ${i}`).toBe(canon(parsed));
    });
    expect(container.querySelector('#numbers .codewrap code')!.textContent).toContain('class="td"');
  });
});

describe('components chapter script', () => {
  const pristine = () => new DOMParser().parseFromString(renderToStaticMarkup(<Components />), 'text/html').querySelector('.chap')!;

  it('is idempotent under StrictMode and leaves the markup and inputs exactly as rendered on unmount', async () => {
    const { container, unmount } = render(<StrictMode><Components /></StrictMode>);
    const copy = container.querySelector<HTMLButtonElement>('.copybtn')!;
    fireEvent.click(copy);
    await new Promise((r) => setTimeout(r, 0));
    expect(copy.textContent).not.toBe('Copy');
    const comps = [...container.querySelectorAll('.comp')].filter((c) => c.querySelector('.demo') && c.querySelector('.codewrap'));
    expect(container.querySelectorAll('.codetoggle').length).toBe(comps.length);
    fireEvent.click(container.querySelectorAll('.tabbar [role="tab"]')[1]);
    fireEvent.click(container.querySelector('.menu [aria-haspopup]')!);
    const radio = [...container.querySelectorAll('.menu.inline [role="menuitemradio"]')].find((i) => i.getAttribute('aria-checked') !== 'true' && !i.getAttribute('aria-disabled') && !i.getAttribute('aria-busy'))!;
    fireEvent.click(radio);
    const erase = container.querySelector<HTMLInputElement>('.modal.erase input[data-phrase]')!;
    fireEvent.input(erase, { target: { value: erase.dataset.phrase } });
    fireEvent.click(container.querySelector('.bulk-demo tbody .pick input')!);
    fireEvent.click(container.querySelector('.sgroup-head')!);
    fireEvent.click(container.querySelector('.codetoggle button')!);
    const chap = container.querySelector('.chap')!;
    const box = chap.querySelector<HTMLInputElement>('.bulk-demo tbody .pick input')!;
    const boxWas = pristine().querySelector<HTMLInputElement>('.bulk-demo tbody .pick input')!.hasAttribute('checked');
    unmount();
    expect(canon(chap)).toBe(canon(pristine()));
    expect([box.checked, erase.value]).toEqual([boxWas, '']);
  });

  it('runs the demos as the legacy page did', () => {
    const { container } = render(<Components />);
    const tabs = [...container.querySelector('.tabbar')!.querySelectorAll('[role="tab"]')];
    fireEvent.click(tabs[1]);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(tabs.map((_, i) => String(i === 1)));
    const menu = container.querySelector('.menu')!;
    const trig = menu.querySelector('[aria-haspopup]')!;
    fireEvent.click(trig);
    expect([menu.querySelector<HTMLElement>('.menu-list')!.hidden, trig.getAttribute('aria-expanded')]).toEqual([false, 'true']);
    fireEvent.pointerDown(document.body);
    expect([menu.querySelector<HTMLElement>('.menu-list')!.hidden, trig.getAttribute('aria-expanded')]).toEqual([true, 'false']);
    const erase = container.querySelector<HTMLInputElement>('.modal.erase input[data-phrase]')!;
    const go = erase.closest('.modal')!.querySelector<HTMLButtonElement>('.btn-destructive')!;
    fireEvent.input(erase, { target: { value: 'Marisol' } });
    expect(go.disabled).toBe(true);
    fireEvent.input(erase, { target: { value: ` ${erase.dataset.phrase} ` } });
    expect(go.disabled).toBe(false);
    const panel = container.querySelector('.bulk-demo')!;
    const bar = panel.querySelector<HTMLElement>('.bulkbar')!;
    const all = panel.querySelector<HTMLInputElement>('thead .pick input')!;
    const boxes = [...panel.querySelectorAll<HTMLInputElement>('tbody .pick input')];
    expect([bar.hidden, bar.querySelector('.count')!.textContent]).toEqual([false, `${boxes.filter((b) => b.checked).length} selected`]);
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(bar.hidden).toBe(true);
    fireEvent.click(boxes[0]);
    expect([bar.hidden, bar.querySelector('.count')!.textContent, all.indeterminate, boxes[0].closest('tr')!.getAttribute('aria-selected')]).toEqual([false, '1 selected', true, 'true']);
    fireEvent.click(all);
    expect([boxes.every((b) => b.checked), all.indeterminate, bar.querySelector('.count')!.textContent]).toEqual([true, false, `${boxes.length} selected`]);
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect([boxes.some((b) => b.checked), bar.hidden]).toEqual([false, true]);
  });

  it('has one generated sample per specimen, each the same markup, attributes and text as its specimen before the demos sync', () => {
    const { container } = render(<Components />);
    const withSample = (r: ParentNode) => [...r.querySelectorAll('.comp')].filter((c) => c.querySelector('.codewrap code') && c.querySelector('.specimen')).map((c) => c.querySelector('.specimen')!);
    expect(COMPONENTS_CODE.length).toBe(withSample(container).length);
    const before = withSample(pristine());
    before.forEach((spec, i) => {
      const parsed = document.createElement('div');
      parsed.innerHTML = COMPONENTS_CODE[i];
      expect(canon(spec), `sample ${i}`).toBe(canon(parsed));
    });
  });
});

/* A specimen as text: every element's tag, attributes and text, whitespace between
   elements dropped (the samples are indented, React output is not). Inline styles
   are compared as declarations, with two serializer differences normalized: numbers
   to the browser's 6 significant digits, and the flex shorthand to its longhands. */
export function canon(root: Element): string {
  const num = (v: string) => v.replace(/-?\d*\.\d+|-?\d+/g, (n) => String(Number(Number(n).toPrecision(6))));
  const flex = (v: string) => {
    const p = v.trim().split(/\s+/);
    if (p.length === 1 && /^[\d.]+$/.test(p[0])) return `${p[0]} 1 0%`;
    if (p.length === 2 && /^[\d.]+$/.test(p[1])) return `${p[0]} ${p[1]} 0%`;
    return p.join(' ');
  };
  const style = (v: string) => v.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const k = d.slice(0, d.indexOf(':')).trim(), val = d.slice(d.indexOf(':') + 1).trim().replace(/\s+/g, ' ');
    return `${k}: ${num(k === 'flex' ? flex(val) : val)}`;
  }).sort().join('; ');
  const walk = (n: Node): string => {
    if (n.nodeType === 3) { const t = n.textContent!.replace(/\s+/g, ' ').trim(); return t ? JSON.stringify(t) : ''; }
    if (n.nodeType !== 1) return '';
    const el = n as Element;
    const attrs = [...el.attributes].map((a) => `${a.name}=${JSON.stringify(a.name === 'style' ? style(a.value) : a.value)}`).sort().join(' ');
    return `<${el.localName}${attrs ? ' ' + attrs : ''}>${[...el.childNodes].map(walk).join('')}</${el.localName}>`;
  };
  return [...root.childNodes].map(walk).join('');
}
