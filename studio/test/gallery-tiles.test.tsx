// The gallery in the studio tile language (1.7.0): /gallery is a bento of example tiles
// (header: name and tags as neutral badges; body: a live thumbnail; footer: Live and Code),
// the thumbnails are inert, aria-hidden and lazy (at most MAX_LIVE frames at once), they
// play only while their tile is hovered or focused and motion is neither paused nor
// reduced, and /gallery/<slug> and /code wrap their frame and source in the same tile.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { App } from '../src/App';
import { navigate } from '../src/shell/router';
import { setMotionPaused } from '../src/theme';
import { GALLERY } from '../src/gallery/examples';
import { META, FILTERS } from '../src/gallery/meta';
import { MAX_LIVE, PHONE } from '../src/gallery/Thumb';
import { Page as Gallery } from '../src/chapters/pages/gallery';
import { GalleryExamplePage } from '../src/gallery/GalleryExamplePage';
import { GalleryCodePage } from '../src/gallery/GalleryCodePage';
import { loadSource } from '../src/gallery/sources';

const repo = path.resolve(__dirname, '../..');
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const GALLERY_CSS = strip(fs.readFileSync(path.join(repo, 'studio/src/gallery/gallery.css'), 'utf8'));

/* IntersectionObserver by hand: a test says which thumbnails are on screen. */
type Obs = { cb: IntersectionObserverCallback; els: Set<Element> };
let observers: Obs[] = [];
const see = (els: Element[], on: boolean) => act(() => {
  for (const o of observers) {
    const hits = els.filter((e) => o.els.has(e));
    if (hits.length) o.cb(hits.map((target) => ({ target, isIntersecting: on }) as unknown as IntersectionObserverEntry), o as unknown as IntersectionObserver);
  }
});
let phone = false;
let reduced = false;
beforeEach(() => {
  observers = [];
  phone = false;
  reduced = false;
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('IntersectionObserver', class {
    o: Obs;
    constructor(cb: IntersectionObserverCallback) { this.o = { cb, els: new Set() }; observers.push(this.o); }
    observe(el: Element) { this.o.els.add(el); }
    unobserve(el: Element) { this.o.els.delete(el); }
    disconnect() { this.o.els.clear(); }
  });
  vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({
    matches: (q === PHONE && phone) || (q.includes('prefers-reduced-motion: reduce') && reduced),
    media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }) as MediaQueryList);
});
afterEach(() => { act(() => setMotionPaused(false)); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const tiles = (c: ParentNode) => [...c.querySelectorAll<HTMLElement>('#mock-sites ~ .sgrid > .gtile')];
const thumbs = (c: ParentNode) => [...c.querySelectorAll<HTMLElement>('.gthumb')];
const liveFrames = (c: ParentNode) => [...c.querySelectorAll<HTMLIFrameElement>('.gthumb iframe')];

describe('the gallery bento', () => {
  it('has one tile per example, in gallery order, in XL, M and S', () => {
    const { container } = render(<Gallery />);
    const t = tiles(container);
    expect(t.map((x) => x.querySelector('.stile-name')!.textContent)).toEqual(GALLERY.map((g) => g.label));
    expect(t.map((x) => x.dataset.size)).toEqual(GALLERY.map((g) => META[g.slug].size));
    expect(new Set(t.map((x) => x.dataset.size))).toEqual(new Set(['xl', 'm', 's']));
    expect(t.every((x) => x.classList.contains('wtile') && x.classList.contains('stile'))).toBe(true);
  });

  it('heads each tile with its name (h3 under Mock sites) and its tags as neutral badges', () => {
    const { container } = render(<Gallery />);
    for (const [i, t] of tiles(container).entries()) {
      const g = GALLERY[i];
      const hd = t.querySelector(':scope > .wtile-body > .wtile-hd')!;
      expect(hd.querySelector('h3.stile-name')!.textContent, g.slug).toBe(g.label);
      const badges = [...hd.querySelectorAll('.badge')];
      expect(badges.map((b) => b.textContent), g.slug).toEqual(META[g.slug].tags);
      for (const b of badges) expect([...b.classList].sort(), g.slug).toEqual(['badge', 'neutral']);
    }
  });

  it('puts the thumbnail in the body and Live then Code in the footer, both studio routes', () => {
    const { container } = render(<Gallery />);
    for (const [i, t] of tiles(container).entries()) {
      const { slug, label } = GALLERY[i];
      expect(t.querySelector(':scope > .wtile-body > .stile-spec > .gthumb'), slug).not.toBeNull();
      const links = [...t.querySelectorAll<HTMLAnchorElement>('.stile-foot a')];
      expect(links.map((a) => [a.textContent, a.getAttribute('href')]), slug).toEqual([['Live', `/gallery/${slug}`], ['Code', `/gallery/${slug}/code`]]);
      /* each link names its example: the visible word plus the tile name */
      for (const a of links) expect(document.getElementById(a.getAttribute('aria-describedby')!)?.textContent, slug).toBe(label);
    }
  });

  it('opens Live and Code in the shell by clicking', async () => {
    const { container } = render(<App />);
    await act(async () => { navigate('/gallery'); });
    await act(async () => { fireEvent.click(container.querySelector('.gtile a[href="/gallery/pulse"]')!); });
    expect(window.location.pathname).toBe('/gallery/pulse');
    await act(async () => { navigate('/gallery'); });
    await act(async () => { fireEvent.click(container.querySelector('.gtile a[href="/gallery/store/code"]')!); });
    expect(window.location.pathname).toBe('/gallery/store/code');
  });

  it('pre-renders every tile with a placeholder and no frame', () => {
    const doc = new DOMParser().parseFromString(renderToStaticMarkup(<Gallery />), 'text/html');
    expect(tiles(doc).length).toBe(GALLERY.length);
    expect(doc.querySelectorAll('iframe').length).toBe(0);
    expect(doc.querySelectorAll('.gthumb .gthumb-ph').length).toBe(GALLERY.length);
  });
});

describe('thumbnails are inert', () => {
  it('are aria-hidden, inert, and hold no focusable element, live or not', () => {
    const { container } = render(<Gallery />);
    see(thumbs(container).slice(0, 2), true);
    expect(liveFrames(container).length).toBe(2);
    for (const t of thumbs(container)) {
      expect(t.getAttribute('aria-hidden')).toBe('true');
      expect(t.hasAttribute('inert')).toBe(true);
    }
    for (const f of liveFrames(container)) {
      expect(f.getAttribute('tabindex')).toBe('-1');
      expect(f.getAttribute('src')).toMatch(/^\/examples\/[a-z0-9-]+\.html$/);
    }
  });

  it('take no pointer events, so a click or a scroll on one is the tile\'s', () => {
    expect(GALLERY_CSS).toMatch(/\.gthumb\s*\{[^}]*pointer-events:\s*none/);
    expect(GALLERY_CSS).toMatch(/\.gthumb iframe\s*\{[^}]*pointer-events:\s*none/);
  });
});

describe('thumbnails load lazily', () => {
  it('loads none until a thumbnail is on screen, then only the ones on screen', () => {
    const { container } = render(<Gallery />);
    expect(liveFrames(container).length).toBe(0);
    see(thumbs(container).slice(0, 3), true);
    expect(liveFrames(container).map((f) => f.getAttribute('src'))).toEqual(GALLERY.slice(0, 3).map((g) => `/examples/${g.slug}.html`));
  });

  it.each([[false, MAX_LIVE.wide], [true, MAX_LIVE.phone]])('keeps at most N frames live (phone %s: N = %i), however many are on screen', (isPhone, n) => {
    phone = isPhone;
    const { container } = render(<Gallery />);
    see(thumbs(container), true);
    expect(liveFrames(container).length).toBe(n);
    expect(n).toBeLessThan(GALLERY.length);
  });

  it('hands a slot from a thumbnail scrolled away to one scrolled to, never over N', () => {
    phone = true;
    const { container } = render(<Gallery />);
    const t = thumbs(container);
    see(t.slice(0, 3), true);
    let most = liveFrames(container).length;
    for (let i = 3; i < t.length; i++) {
      see([t[i - 3]], false);
      see([t[i]], true);
      most = Math.max(most, liveFrames(container).length);
      expect(t[i].querySelector('iframe'), `thumbnail ${i}`).not.toBeNull();
    }
    expect(most).toBeLessThanOrEqual(MAX_LIVE.phone);
  });

  it('frees its slot on unmount', () => {
    const a = render(<Gallery />);
    see(thumbs(a.container), true);
    a.unmount();
    const b = render(<Gallery />);
    see(thumbs(b.container), true);
    expect(liveFrames(b.container).length).toBe(MAX_LIVE.wide);
  });
});

describe('hover or focus plays a thumbnail', () => {
  /* jsdom loads no subresources: give the frame a document, as the example would. */
  async function liveThumb(c: HTMLElement, i = 1) {
    const box = thumbs(c)[i];
    see([box], true);
    const f = box.querySelector('iframe')!;
    const d = f.contentDocument!;
    if (!d.documentElement) d.append(d.createElement('html'));
    if (!d.head) d.documentElement.append(d.createElement('head'));
    if (!d.body) d.documentElement.append(d.createElement('body'));
    /* The example's animation frames, on the test's timers. */
    const w = f.contentWindow as Window & { requestAnimationFrame: (cb: FrameRequestCallback) => number };
    w.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0) as unknown as number;
    await act(async () => { f.dispatchEvent(new Event('load')); });
    return { tile: box.closest<HTMLElement>('.gtile')!, box, d };
  }
  const playing = (d: Document) => d.documentElement.dataset.motion !== 'paused';

  it('holds a thumbnail still until its tile is hovered, and stills it again on leave', async () => {
    const { container } = render(<Gallery />);
    const { tile, box, d } = await liveThumb(container);
    expect(d.querySelector('style[data-vsv-pause]')).not.toBeNull();
    expect(playing(d)).toBe(false);
    await act(async () => { fireEvent.pointerEnter(tile); });
    expect([playing(d), box.dataset.playing]).toEqual([true, '']);
    await act(async () => { fireEvent.pointerLeave(tile); });
    expect([playing(d), box.dataset.playing]).toEqual([false, undefined]);
  });

  it('plays while focus is inside its tile, and stops when focus leaves', async () => {
    const { container } = render(<Gallery />);
    const { tile, d } = await liveThumb(container);
    await act(async () => { tile.querySelector<HTMLAnchorElement>('a')!.focus(); });
    expect(playing(d)).toBe(true);
    await act(async () => { tile.querySelectorAll<HTMLAnchorElement>('a')[1].focus(); });
    expect(playing(d)).toBe(true);
    await act(async () => { (document.activeElement as HTMLElement).blur(); });
    expect(playing(d)).toBe(false);
  });

  it('never plays while Pause motion is on, and stops a playing one when it is switched on', async () => {
    const { container } = render(<Gallery />);
    const { tile, d } = await liveThumb(container);
    await act(async () => { fireEvent.pointerEnter(tile); });
    expect(playing(d)).toBe(true);
    await act(async () => { setMotionPaused(true); });
    expect(playing(d)).toBe(false);
    await act(async () => { fireEvent.pointerLeave(tile); fireEvent.pointerEnter(tile); });
    expect(playing(d)).toBe(false);
    await act(async () => { setMotionPaused(false); });
    expect(playing(d)).toBe(true);
  });

  it('never plays under reduced motion', async () => {
    reduced = true;
    const { container } = render(<Gallery />);
    const { tile, d } = await liveThumb(container);
    await act(async () => { fireEvent.pointerEnter(tile); tile.querySelector<HTMLAnchorElement>('a')!.focus(); });
    expect(playing(d)).toBe(false);
  });

  it('holds the example\'s own animation-frame loop while still, and runs it while playing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { container } = render(<Gallery />);
    const { tile, box } = await liveThumb(container);
    const w = box.querySelector('iframe')!.contentWindow! as Window & typeof globalThis;
    const raf = vi.fn();
    act(() => { vi.runAllTimers(); });
    w.requestAnimationFrame(raf);
    act(() => { vi.runAllTimers(); });
    expect(raf).not.toHaveBeenCalled();
    await act(async () => { fireEvent.pointerEnter(tile); });
    act(() => { vi.runAllTimers(); });
    expect(raf).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('a thumbnail that does not load', () => {
  /* A missing example is answered with 404.html, the studio shell: the frame holds #studio-root. */
  async function load(c: HTMLElement, i: number, html: string) {
    const box = thumbs(c)[i];
    see([box], true);
    const f = box.querySelector('iframe')!;
    const d = f.contentDocument!;
    if (!d.documentElement) d.append(d.createElement('html'));
    if (!d.body) d.documentElement.append(d.createElement('body'));
    d.body.innerHTML = html;
    await act(async () => { f.dispatchEvent(new Event('load')); });
    return box.closest<HTMLElement>('.gtile') ?? c.querySelectorAll<HTMLElement>('.gtile')[i];
  }

  it('shows the tile error with Retry, not the studio shell nested in the tile', async () => {
    const { container } = render(<Gallery />);
    const tile = await load(container, 1, '<div id="studio-root"><div class="studio"></div></div>');
    const err = tile.querySelector('.stile-spec .wtile-err[role="alert"]')!;
    expect(err).not.toBeNull();
    expect(err.textContent).toContain('Preview did not load');
    expect(tile.querySelector('iframe')).toBeNull();
    expect(tile.querySelector('.stile-foot')).toBeNull();
    await act(async () => { fireEvent.click(err.querySelector('button')!); });
    expect(tile.querySelector('.wtile-err')).toBeNull();
    expect(tile.querySelector('.gthumb')).not.toBeNull();
  });

  it('keeps an example that loads', async () => {
    const { container } = render(<Gallery />);
    const tile = await load(container, 1, '<main class="wrap"></main>');
    expect(tile.querySelector('.wtile-err')).toBeNull();
    expect(tile.querySelector('.gthumb iframe[data-loaded]')).not.toBeNull();
  });
});

describe('the tag filter', () => {
  it('shows only the tiles with the chip\'s tag, as neutral selection with a count on every chip', () => {
    const { container } = render(<Gallery />);
    const chips = [...container.querySelectorAll<HTMLButtonElement>('#gfilter .fchip')];
    expect(chips.map((c) => c.dataset.f)).toEqual(['all', ...FILTERS.map(([f]) => f)]);
    for (const c of chips) {
      const f = c.dataset.f!;
      const n = f === 'all' ? GALLERY.length : GALLERY.filter((g) => META[g.slug].filters.includes(f)).length;
      expect(c.querySelector('.cnt')!.textContent, f).toBe(String(n));
    }
    /* A filtered-out tile is not rendered: no class to lose to the package's .wtile display. */
    const shown = () => tiles(container).map((t) => t.querySelector('.stile-name')!.textContent);
    expect(shown().length).toBe(GALLERY.length);
    fireEvent.click(container.querySelector('#gfilter [data-f="light"]')!);
    expect(shown()).toEqual(['Redline Supply · storefront', 'Ledgerline · landing']);
    expect(chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.f)).toEqual(['light']);
    fireEvent.click(container.querySelector('#gfilter [data-f="3d"]')!);
    expect(shown()).toEqual(['Signal Foundry · 3D hero']);
    fireEvent.click(container.querySelector('#gfilter [data-f="all"]')!);
    expect(shown().length).toBe(GALLERY.length);
  });

  it('announces the result politely, and nothing before a chip is pressed', () => {
    const { container } = render(<Gallery />);
    const status = container.querySelector('#gfilter-status')!;
    expect([status.getAttribute('aria-live'), status.classList.contains('sr-only'), status.textContent]).toEqual(['polite', true, '']);
    fireEvent.click(container.querySelector('#gfilter [data-f="light"]')!);
    expect(status.textContent).toBe('2 examples');
    fireEvent.click(container.querySelector('#gfilter [data-f="3d"]')!);
    expect(status.textContent).toBe('1 example');
    fireEvent.click(container.querySelector('#gfilter [data-f="all"]')!);
    expect(status.textContent).toBe(`${GALLERY.length} examples`);
  });

  it('frees the slot of a thumbnail the filter hides', () => {
    phone = true;
    const { container } = render(<Gallery />);
    see(thumbs(container), true);
    fireEvent.click(container.querySelector('#gfilter [data-f="light"]')!);
    const live = liveFrames(container).map((f) => f.getAttribute('src'));
    expect(live.sort()).toEqual(['/examples/landing.html', '/examples/store.html']);
  });
});

describe('the example and code routes in the tile language', () => {
  it('/gallery/<slug>: the frame in a tile, with the file and tags in the header and Code in the footer', () => {
    const { container } = render(<GalleryExamplePage slug="pulse" />);
    const t = container.querySelector<HTMLElement>('.gex section.stile.gex-tile')!;
    expect(t.querySelector('.wtile-hd .stile-name')!.textContent).toBe('examples/pulse.html');
    expect([...t.querySelectorAll('.wtile-hd .badge.neutral')].map((b) => b.textContent)).toEqual(META.pulse.tags);
    expect(t.querySelector('.stile-spec .gex-stage iframe.gex-frame')!.getAttribute('src')).toBe('/examples/pulse.html');
    expect([...t.querySelectorAll('.stile-foot a')].map((a) => [a.textContent, a.getAttribute('href')])).toEqual([['Code', '/gallery/pulse/code']]);
    expect(container.querySelectorAll('h1').length).toBe(1);
  });

  it('/gallery/<slug>/code: the source in a tile, with Open live and Copy in the footer', async () => {
    await loadSource('landing');
    const { container } = render(<GalleryCodePage slug="landing" />);
    const t = container.querySelector<HTMLElement>('[data-chapter="code"] section.stile.gsrc-tile')!;
    expect(t.querySelector('.wtile-hd .stile-name')!.textContent).toBe('site/examples/landing.html');
    expect(t.querySelector('.stile-spec pre code#srccode')!.textContent!.startsWith('<!DOCTYPE html>')).toBe(true);
    expect([...t.querySelectorAll('.stile-foot a, .stile-foot button')].map((a) => a.id)).toEqual(['openlive', 'copysrc']);
    expect(container.querySelectorAll('h1').length).toBe(1);
  });
});
