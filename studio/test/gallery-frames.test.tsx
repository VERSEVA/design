// Gallery frames behave like the studio's own: they follow the theme and brand,
// an example frame is as tall as its document (one scrollbar, the page's), and its
// source ships inside the bundle, generated from the served file.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
import SOURCES from '../src/gallery/sources.json';
import { gallerySources, format } from '../scripts/gallery-sources.mjs';

const repo = path.resolve(__dirname, '../..');

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
    await act(async () => { f.dispatchEvent(new Event('load')); });
    expect(f.getAttribute('scrolling')).toBe('no');
    expect(f.style.height).toBe('2336px');
    h = 2600;
    await act(async () => { fire.forEach((cb) => cb()); });
    expect(f.style.height).toBe('2600px');
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

  it('renders each source on the server, with no fetch', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    for (const slug of Object.keys(SOURCES)) {
      const html = renderToStaticMarkup(<GalleryCodePage slug={slug} />);
      const code = new DOMParser().parseFromString(html, 'text/html').querySelector('#srccode')!.textContent;
      expect(code, slug).toBe((SOURCES as Record<string, string>)[slug]);
    }
    render(<GalleryCodePage slug="store" />);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('copies the inlined source', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    const { container } = render(<GalleryCodePage slug="landing" />);
    await act(async () => { fireEvent.click(container.querySelector('#copysrc')!); });
    expect(write).toHaveBeenCalledWith((SOURCES as Record<string, string>).landing);
    expect(container.querySelector('#copysrc')!.textContent).toBe('Copied');
  });
});

describe('gallery sources', () => {
  it('sources.json is byte for byte what the generator writes from site/examples/*.html, the files assemble serves at /examples', () => {
    expect(format(gallerySources(path.join(repo, 'site/examples')))).toBe(fs.readFileSync(path.join(repo, 'studio/src/gallery/sources.json'), 'utf8'));
    const files = fs.readdirSync(path.join(repo, 'site/examples')).filter((f) => f.endsWith('.html')).sort();
    expect(Object.keys(SOURCES).map((s) => `${s}.html`).sort()).toEqual(files);
    for (const f of files) expect((SOURCES as Record<string, string>)[f.replace(/\.html$/, '')]).toBe(fs.readFileSync(path.join(repo, 'site/examples', f), 'utf8'));
  });
});
