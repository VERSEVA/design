// The gallery's child routes: each example at /gallery/<slug> and its source at
// /gallery/<slug>/code, both inside the studio shell, both explicit rows in the
// routes table with a parent. No gallery link leaves the shell; /examples/*.html
// stay files (the iframes load them).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { App } from '../src/App';
import { navigate } from '../src/shell/router';
import { ROUTES } from '../src/shell/routes';
import { ROUTE_TABLE, LIVE_ROUTES } from '../src/shell/routes-table';
import { exampleLink, GALLERY } from '../src/gallery/examples';
import { Page as Gallery } from '../src/chapters/pages/gallery';
import { GalleryCodePage, FROZEN_CODE } from '../src/gallery/GalleryCodePage';
import { createHash } from 'node:crypto';

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
    const cards = [...container.querySelectorAll('.gcard')].map((c) => [c.querySelector('.prevlink')!.getAttribute('href'), c.querySelector('.gcap b')!.textContent]);
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
    await act(async () => { fireEvent.click(container.querySelector('.gcard a.open[href="/gallery/pulse"]')!); });
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

  it('marks Gallery in the sidebar on its child routes, and lists no child rows there', async () => {
    const { container } = render(<App />);
    await act(async () => { navigate('/gallery/store/code'); });
    const side = container.querySelector('.studio-side')!;
    expect(side.querySelector('a.active')!.getAttribute('href')).toBe('/gallery');
    expect([...side.querySelectorAll('.snav-page > a')].some((a) => a.getAttribute('href')!.startsWith('/gallery/'))).toBe(false);
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

  it('lands a cold deep link on a code route', async () => {
    window.history.replaceState(null, '', '/gallery/store/code');
    const { container } = render(<App />);
    await tick();
    expect(container.querySelector('[data-chapter="code"] #srccode')!.textContent).toBe(source('store'));
  });
});

/* The legacy code.html after its own script, for one example, as the parity reference. */
function legacyCode(slug: string): Element {
  const { JSDOM } = createRequire(path.join(repo, 'studio/package.json'))('jsdom');
  const html = fs.readFileSync(path.join(repo, 'site/code.html'), 'utf8').replace(/<script src="theme\.js[^"]*"><\/script>/, '');
  let done!: () => void;
  const fetched = new Promise<void>((r) => { done = r; });
  const dom = new JSDOM(html, {
    url: `${ORIGIN}/site/code.html?f=examples/${slug}.html`,
    runScripts: 'dangerously',
    beforeParse(w: Window & typeof globalThis) { w.fetch = (() => { setTimeout(done, 0); return Promise.resolve({ ok: true, text: () => Promise.resolve(source(slug)) }); }) as unknown as typeof fetch; },
  });
  return Object.assign(dom.window.document.querySelector('.shell')!, { fetched });
}

describe('the code route against the legacy code.html', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('pins the frozen site/code.html by hash', () => {
    expect(createHash('sha256').update(fs.readFileSync(path.join(repo, 'site/code.html'))).digest('hex')).toBe(FROZEN_CODE);
  });

  it.each(files)('%s: renders what code.html showed once its script ran, element for element', async (slug) => {
    const legacy = legacyCode(slug) as Element & { fetched: Promise<void> };
    await legacy.fetched;
    await new Promise((r) => setTimeout(r, 0));
    legacy.querySelector('header.topbar')!.remove();
    const { container } = render(<GalleryCodePage slug={slug} />);
    await tick();
    const chap = container.querySelector('.chap')!;
    /* Written deviations: the breadcrumb row replaces the stripped top bar's "Back to the gallery". */
    chap.querySelector(':scope > .hero > .crumbs')!.remove();
    /* The source text is compared as text (React and jsdom escape quotes in text differently). */
    expect(chap.querySelector('#srccode')!.textContent).toBe(legacy.querySelector('#srccode')!.textContent);
    for (const el of [chap, legacy]) el.querySelector('#srccode')!.textContent = '';
    const norm = (el: Element) => el.innerHTML.replace(/[ \t\n\r\f]+/g, ' ').replace(/> </g, '><').trim();
    const want = norm(legacy).replace(`href="examples/${slug}.html"`, `href="/gallery/${slug}"`);
    expect(norm(chap)).toBe(want);
  });



  it('renders on the server with the crumbs and its h1', () => {
    const html = renderToStaticMarkup(<GalleryCodePage slug="pulse" />);
    expect(html).toMatch(/<h1 id="srctitle">pulse<\/h1>/);
    expect(html).toContain('aria-label="Breadcrumb"');
  });
});
