// WCAG 2.4.1 beyond ported chapters: sidebar anchors (router.navigate) and anchors
// inside a chapter still in an iframe (ChapterPage) move focus as well as scroll.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { App } from '../src/App';
import { ChapterPage } from '../src/chapters/ChapterPage';

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

describe('anchor focus', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/'); localStorage.clear();
    /* ChapterPage measures the frame on load; jsdom has no ResizeObserver. */
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('a Foundations On this page anchor moves focus to its section', async () => {
    window.history.replaceState(null, '', '/foundations');
    const { container } = render(<App />);
    await tick();
    const link = container.querySelector<HTMLAnchorElement>('.pagetoc a[href="/foundations#motion"]')!;
    expect(link).not.toBeNull();
    fireEvent.click(link, { button: 0 });
    await tick();
    const target = document.getElementById('motion')!;
    expect(document.activeElement).toBe(target);
    expect(target.getAttribute('tabindex')).toBe('-1');
  });

  it('an in-page anchor inside an iframe chapter moves focus into the frame', async () => {
    const chapter = { slug: 'gallery', file: 'gallery.html', label: 'Gallery', sections: [{ id: 'blocks', label: 'Blocks' }] };
    const { container } = render(<ChapterPage chapter={chapter} />);
    const f = container.querySelector('iframe')!;
    const d = f.contentDocument!;
    d.open();
    d.write('<!doctype html><html><head></head><body><a id="skip" href="#gal-main">Skip</a><h2>Blocks</h2><div id="gal-main"><p>x</p></div></body></html>');
    d.close();
    /* jsdom implements no scrolling; the setup shim covers the top window only. */
    (f.contentWindow as unknown as typeof window).Element.prototype.scrollIntoView = function () {};
    f.dispatchEvent(new Event('load'));
    fireEvent.click(d.getElementById('skip')!, { button: 0 });
    const target = d.getElementById('gal-main')!;
    expect(target.getAttribute('tabindex')).toBe('-1');
    expect(d.activeElement).toBe(target);
  });
});
