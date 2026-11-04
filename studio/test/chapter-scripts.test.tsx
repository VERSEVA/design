// Chapter scripts: what a ported page's legacy inline script became. Each one is
// idempotent across StrictMode's mount, cleanup, mount, and does what it did on the legacy page.
import { describe, it, expect } from 'vitest';
import { StrictMode } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { Page as DataViz } from '../src/chapters/pages/data-viz';

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

  it('hides each code sample behind its toggle, fills it from the specimen in the legacy style form, and flips the range', () => {
    const { container } = render(<DataViz />);
    const comp = container.querySelector('#stat')!;
    const cw = comp.querySelector<HTMLElement>('.codewrap')!;
    const btn = comp.querySelector<HTMLButtonElement>('.codetoggle button')!;
    expect(cw.hidden).toBe(true);
    fireEvent.click(btn);
    expect([cw.hidden, btn.textContent, btn.getAttribute('aria-expanded')]).toEqual([false, 'Hide code', 'true']);
    const code = cw.querySelector('code')!.textContent!;
    expect(code).toContain('style="width:45%"');
    expect(code).not.toMatch(/style="[^"]*: /);
    const tag = container.querySelector('#vseries .reftag')!;
    expect(tag.textContent).toBe('YOUR AVG · 12 WK');
    fireEvent.click(container.querySelectorAll('#vrange button')[1]);
    expect(tag.textContent).toBe('YOUR AVG · 30 D');
    expect(container.querySelector('#vxlab')!.textContent).toBe('D1D30');
  });
});
