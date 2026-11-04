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

  it('has one generated sample per specimen, each the same markup as its specimen once the script has drawn it', () => {
    const { container } = render(<DataViz />);
    const specs = [...container.querySelectorAll('.comp')].filter((c) => c.querySelector('.codewrap code')).map((c) => c.querySelector('.specimen')!);
    expect(CODE.length).toBe(specs.length);
    const tags = (root: ParentNode) => [...root.querySelectorAll('*')].map((e) => e.localName).join(',');
    specs.forEach((spec, i) => {
      const parsed = document.createElement('div');
      parsed.innerHTML = CODE[i];
      expect(tags(parsed), `sample ${i}`).toBe(tags(spec));
    });
  });
});
