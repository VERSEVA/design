// Chapter scripts: what a ported page's legacy inline script became. Each one is
// idempotent across StrictMode's mount, cleanup, mount, and does what it did on the legacy page.
import { describe, it, expect } from 'vitest';
import { StrictMode } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { Page as DataViz } from '../src/chapters/pages/data-viz';
import CODE from '../src/chapters/pages/data-viz.code.json';

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
