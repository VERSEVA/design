// The gallery's child routes: each example at /gallery/<slug> and its source at
// /gallery/<slug>/code, both inside the studio shell, both explicit rows in the
// routes table with a parent. No gallery link leaves the shell; /examples/*.html
// stay files (the iframes load them).
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { App } from '../src/App';
import { navigate } from '../src/shell/router';
import { ROUTES } from '../src/shell/routes';
import { ROUTE_TABLE, LIVE_ROUTES } from '../src/shell/routes-table';
import { exampleLink, GALLERY } from '../src/gallery/examples';
import { Page as Gallery } from '../src/chapters/pages/gallery';
import { GalleryCodePage } from '../src/gallery/GalleryCodePage';
import { REDESIGNED_ROUTES } from './redesigned';

const repo = path.resolve(__dirname, '../..');
const ORIGIN = window.location.origin;
const files = fs.readdirSync(path.join(repo, 'site/examples')).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')).sort();
const source = (slug: string) => fs.readFileSync(path.join(repo, 'site/examples', `${slug}.html`), 'utf8');

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('gallery rows in the routes table', () => {
  it('has one example row and one code row per site/examples/*.html, each with its parent', () => {
    expect(GALLERY.map((g) => g.slug).sort()).toEqual(files);
    for (const slug of files) {
      const ex = ROUTE_TABLE.find((r) => r.path === `/gallery/${slug}`);
      const code = ROUTE_TABLE.find((r) => r.path === `/gallery/${slug}/code`);
      expect(ex?.parent, slug).toBe('/gallery');
      expect(code?.parent, slug).toBe(`/gallery/${slug}`);
      expect(ROUTES.map((r) => r.path)).toContain(`/gallery/${slug}`);
      expect(ROUTES.map((r) => r.path)).toContain(`/gallery/${slug}/code`);
    }
  });

  it('points every parent at a live row', () => {
    const live = new Set(LIVE_ROUTES.map((r) => r.path));
    for (const r of LIVE_ROUTES.filter((m) => m.parent)) expect(live.has(r.parent!), r.path).toBe(true);
  });

  it('labels each example row with its gallery card name', () => {
    const { container } = render(<Gallery />);
    const cards = [...container.querySelectorAll('.gtile')].map((c) => [c.querySelector('.stile-foot a')!.getAttribute('href'), c.querySelector('.stile-name')!.textContent]);
    expect(cards).toEqual(GALLERY.map((g) => [`/gallery/${g.slug}`, ROUTE_TABLE.find((r) => r.path === `/gallery/${g.slug}`)!.label]));
  });
});

describe('gallery links stay in the shell', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/'); });

  it('sends every gallery link to a studio route, never a file', () => {
    const { container } = render(<Gallery />);
    const hrefs = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!);
    const live = new Set(LIVE_ROUTES.map((r) => r.path));
    for (const h of hrefs) expect(live.has(h.split('#')[0]), h).toBe(true);
    expect(hrefs.filter((h) => /\/code$/.test(h)).length).toBe(files.length);
    for (const f of container.querySelectorAll('iframe')) expect(f.getAttribute('src')).toMatch(/^\/examples\/[a-z0-9-]+\.html$/);
  });

  it('opens an example and its code from the gallery by clicking, in the shell', async () => {
    const { container } = render(<App />);
    await act(async () => { navigate('/gallery'); });
    await act(async () => { fireEvent.click(container.querySelector('.gtile a[href="/gallery/pulse"]')!); });
    expect(window.location.pathname).toBe('/gallery/pulse');
    expect(container.querySelector('.studio-side')).not.toBeNull();
    const frame = container.querySelector<HTMLIFrameElement>('.gex-frame')!;
    expect(frame.getAttribute('src')).toBe('/examples/pulse.html');
    expect(document.title).toBe(ROUTE_TABLE.find((r) => r.path === '/gallery/pulse')!.title);
    const crumbs = [...container.querySelectorAll('.gex .crumbs a, .gex .crumbs [aria-current="page"]')].map((n) => n.textContent);
    expect(crumbs).toEqual(['Gallery', 'Pulse · analytics']);
    await act(async () => { fireEvent.click(container.querySelector('.gex a[href="/gallery/pulse/code"]')!); });
    expect(window.location.pathname).toBe('/gallery/pulse/code');
    await act(async () => { fireEvent.click(container.querySelector('.studio-main .crumbs a[href="/gallery"]')!); });
    expect(window.location.pathname).toBe('/gallery');
  });

  it('marks the example in the sidebar on its code route, and lists no code rows there', async () => {
    const { container } = render(<App />);
    await act(async () => { navigate('/gallery/store/code'); });
    const side = container.querySelector('.studio-side .side-full')!;
    expect([...side.querySelectorAll('a.active')].map((a) => a.getAttribute('href'))).toEqual(['/gallery/store']);
    expect([...side.querySelectorAll('.snav-page > a')].some((a) => a.getAttribute('href')!.endsWith('/code'))).toBe(false);
    expect((container.querySelector('.studio-select select') as HTMLSelectElement).value).toBe('/gallery');
  });

  it('routes the links inside an example frame to the shell', async () => {
    const { container } = render(<App />);
    await act(async () => { navigate('/gallery/launch'); });
    const frame = container.querySelector<HTMLIFrameElement>('.gex-frame')!;
    const doc = frame.contentDocument!;
    /* jsdom loads no subresources: the frame's document is empty, so give it the links by hand. */
    if (!doc.documentElement) doc.append(doc.createElement('html'));
    if (!doc.body) doc.documentElement.append(doc.createElement('body'));
    doc.body.innerHTML = '<a id="a" href="../code.html?f=examples/launch.html">Code</a><a id="b" href="pulse.html">Pulse</a><a id="c" href="../index.html">Home</a><a id="d" href="#how">How</a><a id="e" href="https://github.com/VERSEVA/design">GitHub</a>';
    await act(async () => { frame.dispatchEvent(new Event('load')); });
    const click = (id: string) => { const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }); doc.getElementById(id)!.dispatchEvent(ev); return ev.defaultPrevented; };
    expect(click('d')).toBe(false);
    expect(click('e')).toBe(false);
    await act(async () => { expect(click('b')).toBe(true); });
    expect(window.location.pathname).toBe('/gallery/pulse');
  });

  it('resolves example links against the example file', () => {
    const base = `${ORIGIN}/examples/launch.html`;
    expect(exampleLink('../code.html?f=examples/launch.html', base, ORIGIN)).toBe('/gallery/launch/code');
    expect(exampleLink('pulse.html', base, ORIGIN)).toBe('/gallery/pulse');
    expect(exampleLink('../index.html', base, ORIGIN)).toBe('/');
    expect(exampleLink('/site/examples/store.html', base, ORIGIN)).toBe('/gallery/store');
    expect(exampleLink('../components.html#button', base, ORIGIN)).toBe('/components#button');
    expect(exampleLink('#how', base, ORIGIN)).toBeNull();
    expect(exampleLink('https://github.com/VERSEVA/design', base, ORIGIN)).toBeNull();
    expect(exampleLink('../../tokens.css', base, ORIGIN)).toBeNull();
    expect(exampleLink('../code.html?f=../secret.html', base, ORIGIN)).toBeNull();
    expect(exampleLink('nope.html', base, ORIGIN)).toBeNull();
  });

  it('answers an unknown example or code path with the not-found page', async () => {
    for (const p of ['/gallery/bogus', '/gallery/bogus/code']) {
      window.history.replaceState(null, '', p);
      const { container, unmount } = render(<App />);
      expect(container.querySelector('h1')?.textContent, p).toBe('Page not found');
      expect(container.querySelector('.gex-frame, [data-chapter="code"]'), p).toBeNull();
      unmount();
    }
  });

  it('lands a cold deep link on a code route', async () => {
    window.history.replaceState(null, '', '/gallery/store/code');
    const { container } = render(<App />);
    await tick();
    expect(container.querySelector('[data-chapter="code"] #srccode')!.textContent).toBe(source('store'));
  });

  /* vercel.json's /code.html?f= redirects pass the query through: the landing drops f, keeps the rest. */
  it.each([
    ['/gallery/pulse/code?f=examples/pulse.html', '/gallery/pulse/code'],
    ['/gallery/pulse/code?f=examples/pulse.html&x=1#top', '/gallery/pulse/code?x=1#top'],
    ['/gallery?f=examples/bogus.html', '/gallery'],
    ['/gallery/pulse/code?x=1', '/gallery/pulse/code?x=1'],
  ])('strips a stray f from %s on arrival', async (from, to) => {
    window.history.replaceState({ k: 1 }, '', from);
    const len = window.history.length;
    const { unmount } = render(<App />);
    await tick();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(to);
    expect(window.history.length).toBe(len);
    expect(window.history.state).toEqual({ k: 1 });
    unmount();
  });

  it('leaves f alone outside the gallery', async () => {
    window.history.replaceState(null, '', '/components?f=1');
    const { unmount } = render(<App />);
    await tick();
    expect(window.location.search).toBe('?f=1');
    unmount();
  });
});

describe('the code route', () => {
  it('retires its element-for-element parity with site/code.html, with a written reason', () => {
    expect(REDESIGNED_ROUTES['/gallery/<slug>/code'].length).toBeGreaterThan(20);
  });

  it('renders on the server with the crumbs and its h1', () => {
    const html = renderToStaticMarkup(<GalleryCodePage slug="pulse" />);
    expect(html).toMatch(/<h1 id="srctitle">Pulse · analytics<\/h1>/);
    expect(html).toContain('aria-label="Breadcrumb"');
  });
});
