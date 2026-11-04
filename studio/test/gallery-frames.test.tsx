// Gallery frames behave like the studio's own: they follow the theme and brand,
// an example frame is as tall as its document (one scrollbar, the page's), and its
// source is the served file, loaded as its own chunk.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { App } from '../src/App';
import { navigate } from '../src/shell/router';
import { applyTheme } from '../src/theme';
import { GalleryCodePage } from '../src/gallery/GalleryCodePage';
import { GalleryExamplePage } from '../src/gallery/GalleryExamplePage';
import { Page as Gallery } from '../src/chapters/pages/gallery';
import { SOURCE_SLUGS, loadSource } from '../src/gallery/sources';

const repo = path.resolve(__dirname, '../..');
const served = (slug: string) => fs.readFileSync(path.join(repo, 'site/examples', `${slug}.html`), 'utf8');

/* jsdom loads no subresources: give a frame an empty document to work on. */
function frameDoc(f: HTMLIFrameElement) {
  const d = f.contentDocument!;
  if (!d.documentElement) d.append(d.createElement('html'));
  if (!d.head) d.documentElement.append(d.createElement('head'));
  if (!d.body) d.documentElement.append(d.createElement('body'));
  return d;
}

let fire: Array<() => void> = [];
beforeEach(() => {
  fire = [];
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('ResizeObserver', class {
    cb: () => void;
    constructor(cb: () => void) { this.cb = cb; fire.push(cb); }
    observe() {}
    disconnect() {}
    unobserve() {}
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); applyTheme({ brand: '', mode: 'dark' }); });

describe('example frames follow the studio theme', () => {
  it('carries a mode change and a brand change into the example frame', async () => {
    const { container } = render(<GalleryExamplePage slug="launch" />);
    const f = container.querySelector<HTMLIFrameElement>('.gex-frame')!;
    const d = frameDoc(f);
    await act(async () => { f.dispatchEvent(new Event('load')); });
    await act(async () => { applyTheme({ brand: '', mode: 'light' }); });
    expect(d.documentElement.dataset.theme).toBe('light');
    await act(async () => { applyTheme({ brand: 'violet', mode: 'dark' }); });
    expect([d.documentElement.dataset.theme, d.documentElement.dataset.brand]).toEqual([undefined, 'violet']);
    expect(d.querySelector('link[data-vsv-theme="violet"]')).not.toBeNull();
  });

  it('carries them into every gallery preview card', async () => {
    const { container } = render(<Gallery />);
    const frames = [...container.querySelectorAll<HTMLIFrameElement>('.prevbox iframe')];
    const docs = frames.map(frameDoc);
    await act(async () => { applyTheme({ brand: 'cobalt', mode: 'light' }); });
    expect(docs.map((d) => [d.documentElement.dataset.theme, d.documentElement.dataset.brand])).toEqual(frames.map(() => ['light', 'cobalt']));
  });
});

describe('example frames fit their document', () => {
  it('sizes the frame to its document height, with no scrollbar of its own, and follows a resize', async () => {
    const { container } = render(<GalleryExamplePage slug="pulse" />);
    const f = container.querySelector<HTMLIFrameElement>('.gex-frame')!;
    const d = frameDoc(f);
    let h = 2336;
    Object.defineProperty(d.documentElement, 'scrollHeight', { configurable: true, get: () => h });
    /* the frame's own 1px top and bottom border: the document gets every pixel of its height */
    Object.defineProperty(f, 'offsetHeight', { configurable: true, get: () => 572 });
    Object.defineProperty(f, 'clientHeight', { configurable: true, get: () => 570 });
    await act(async () => { f.dispatchEvent(new Event('load')); });
    expect(f.getAttribute('scrolling')).toBe('no');
    expect(f.style.height).toBe('2338px');
    h = 2600;
    await act(async () => { fire.forEach((cb) => cb()); });
    expect(f.style.height).toBe('2602px');
  });

  it('pins viewport-height rules to px first, so a 100vh stage cannot grow the frame without end', async () => {
    const { container } = render(<GalleryExamplePage slug="three-hero" />);
    const f = container.querySelector<HTMLIFrameElement>('.gex-frame')!;
    const d = frameDoc(f);
    const st = d.createElement('style');
    st.textContent = '.stage { position: relative; height: 100vh; } @media (min-width: 1px) { .tall { min-height: calc(50dvh - 10px); } }';
    d.head.append(st);
    await act(async () => { f.dispatchEvent(new Event('load')); });
    const pin = d.querySelector('style[data-vsv-vh]')!.textContent!;
    const px = (window.innerHeight).toFixed(2);
    expect(pin).toContain(`.stage { height: ${px}px; }`);
    expect(pin).toContain(`min-height: calc(${(window.innerHeight / 2).toFixed(2)}px - 10px)`);
    expect(pin).toContain('@media (min-width: 1px)');
  });
});

describe('gallery code route', () => {
  it('opens Open live in the shell, without a reload', async () => {
    const { container } = render(<App />);
    await act(async () => { navigate('/gallery/pulse/code'); });
    const a = container.querySelector<HTMLAnchorElement>('#openlive')!;
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    await act(async () => { a.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    expect(window.location.pathname).toBe('/gallery/pulse');
  });

  it('pre-renders each code page with its whole source escaped in the HTML, with no fetch', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const { renderDocument } = await import('../src/entry-server');
    const template = fs.readFileSync(path.join(repo, 'studio/index.html'), 'utf8');
    for (const slug of SOURCE_SLUGS) {
      /* jsdom has a document, so the router reads the URL (the build machine has none) */
      window.history.replaceState(null, '', `/gallery/${slug}/code`);
      const html = renderDocument(template, `/gallery/${slug}/code`);
      expect(html, slug).not.toContain('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">');
      const code = new DOMParser().parseFromString(html, 'text/html').querySelector('#srccode')!.textContent;
      expect(code, slug).toBe(served(slug));
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('on a client visit, loads the source chunk into an empty, busy box, then shows it', async () => {
    vi.resetModules();
    const { GalleryCodePage: Fresh } = await import('../src/gallery/GalleryCodePage');
    const { container } = render(<Fresh slug="quote-tool" />);
    const pre = container.querySelector('pre')!;
    expect([pre.textContent, pre.getAttribute('aria-busy'), container.querySelector<HTMLButtonElement>('#copysrc')!.disabled]).toEqual(['', 'true', true]);
    await vi.waitFor(() => expect(container.querySelector('#srccode')!.textContent).toBe(served('quote-tool')));
    expect([pre.hasAttribute('aria-busy'), container.querySelector<HTMLButtonElement>('#copysrc')!.disabled]).toEqual([false, false]);
  });

  it('copies the loaded source', async () => {
    await loadSource('landing');
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    const { container } = render(<GalleryCodePage slug="landing" />);
    await act(async () => { fireEvent.click(container.querySelector('#copysrc')!); });
    expect(write).toHaveBeenCalledWith(served('landing'));
    expect(container.querySelector('#copysrc')!.textContent).toBe('Copied');
  });
});

describe('gallery sources', () => {
  beforeAll(() => Promise.all(SOURCE_SLUGS.map(loadSource)));
  it('loads one source per site/examples/*.html, byte for byte the file assemble serves at /examples', async () => {
    const files = fs.readdirSync(path.join(repo, 'site/examples')).filter((f) => f.endsWith('.html')).sort();
    expect(SOURCE_SLUGS.map((s) => `${s}.html`)).toEqual(files);
    for (const slug of SOURCE_SLUGS) expect(await loadSource(slug), slug).toBe(served(slug));
    expect(await loadSource('nope')).toBeUndefined();
  });
});
