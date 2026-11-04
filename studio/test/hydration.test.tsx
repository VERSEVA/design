// Each pre-rendered route hydrates in jsdom with no mismatch: the server HTML is rendered
// with the browser globals hidden (as on the build machine), then booted as main.tsx boots
// it, for a returning visitor whose stored theme differs from the server default.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import fs from 'node:fs';
import { LIVE_ROUTES, topOf } from '../src/shell/routes-table';
import { navActive } from '../src/shell/nav';

/* Server and client each get a fresh module graph, as on the build machine and in the browser. */
const fresh = async <T,>(spec: string): Promise<T> => { vi.resetModules(); return import(/* @vite-ignore */ spec) as Promise<T>; };
type Server = typeof import('../src/entry-server');
type Client = typeof import('../src/boot');

const BROWSER_GLOBALS = ['window', 'document', 'localStorage', 'matchMedia', 'navigator', 'location', 'history'] as const;

function serverHtml(renderApp: Server['renderApp'], path: string): string {
  const saved = BROWSER_GLOBALS.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const);
  for (const k of BROWSER_GLOBALS) Object.defineProperty(globalThis, k, { value: undefined, configurable: true, writable: true });
  try {
    return renderApp(path);
  } finally {
    for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete (globalThis as Record<string, unknown>)[k]; }
  }
}

let unmount: (() => void) | null = null;
const realMatchMedia = window.matchMedia;
afterEach(() => {
  unmount?.(); unmount = null; document.body.innerHTML = ''; localStorage.clear(); vi.restoreAllMocks();
  window.matchMedia = realMatchMedia;
});

/* Returning visitors: a stored light + brand choice, a stored dark choice, and system on a light OS. */
const BASE = [
  { name: 'stored light, cobalt', store: { 'verseva-brand': 'cobalt', 'verseva-theme': 'light' }, osLight: false, theme: 'light', mode: 'light', label: 'Theme: light. Switch to dark' },
  { name: 'stored dark', store: { 'verseva-theme': 'dark' }, osLight: true, theme: undefined, mode: 'dark', label: 'Theme: dark. Switch to system' },
  { name: 'system on a light OS', store: { 'verseva-theme': 'system' }, osLight: true, theme: 'light', mode: 'system', label: 'Theme: system. Switch to light' },
] as const;
/* Each visitor with the sidebar expanded and collapsed to the rail (stored, applied by the head script). */
const VISITORS = BASE.flatMap((v) => [false, true].map((rail) => ({ ...v, rail, name: `${v.name}, ${rail ? 'rail' : 'expanded'}`, store: rail ? { ...v.store, 'verseva-rail': '1' } : v.store })));
const headScript = new DOMParser().parseFromString(fs.readFileSync(`${__dirname}/../index.html`, 'utf8'), 'text/html').querySelector('head script:not([src])')!.textContent!;

function stubOs(light: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: light && q.includes('prefers-color-scheme: light'), media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** Pre-render `renderPath` on a fresh server graph, load it at `url`, boot it as main.tsx does. */
async function hydrate(renderPath: string, url: string, v: (typeof VISITORS)[number]) {
  const { renderApp } = await fresh<Server>('../src/entry-server');
  const html = serverHtml(renderApp, renderPath);
  expect(html).toMatch(/<h1/);
  /* the server cannot know the stored mode: the mode button ships pending, its icon drawn from <html data-mode> */
  expect(html).toMatch(/class="ibtn modebtn" data-pending=""/);

  for (const [k, val] of Object.entries(v.store)) localStorage.setItem(k, val);
  stubOs(v.osLight);
  window.history.replaceState(null, '', url);
  for (const k of ['mode', 'theme', 'brand', 'rail', 'navShut']) delete document.documentElement.dataset[k];
  new Function(headScript)();
  expect(document.documentElement.dataset.mode).toBe(v.mode);
  expect(document.documentElement.dataset.rail).toBe(v.rail ? 'collapsed' : undefined);
  document.body.innerHTML = `<div id="studio-root" data-path="${renderPath}">${html}</div>`;
  const el = document.getElementById('studio-root')!;
  const first = el.firstElementChild;
  const h1 = el.querySelector('h1');
  expect(first).toBeTruthy();

  const errors: string[] = [];
  const recoverable: unknown[] = [];
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errors.push(a.map(String).join(' ')); });

  const { boot } = await fresh<Client>('../src/boot');
  await act(async () => {
    unmount = boot(el, { onRecoverableError: (e) => recoverable.push(e) });
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  expect(recoverable.map(String)).toEqual([]);
  expect(errors.filter((e) => /hydrat|did not match|mismatch/i.test(e))).toEqual([]);
  /* hydrated, not re-rendered: React adopted the server nodes */
  expect(el.firstElementChild).toBe(first);
  expect(el.querySelector('h1')).toBe(h1);
  /* and the visitor's theme is applied after hydration */
  expect(document.documentElement.dataset.theme).toBe(v.theme);
  /* and the mode button settles on the stored mode, no longer pending */
  const btn = el.querySelector('.modebtn')!;
  expect(btn.hasAttribute('data-pending')).toBe(false);
  expect(btn.getAttribute('aria-label')).toBe(v.label);
  /* the rail state is the head script's, untouched by hydration */
  expect(document.documentElement.dataset.rail).toBe(v.rail ? 'collapsed' : undefined);
  return el;
}

describe('a code page whose source chunk fails on a cold load', () => {
  it('keeps the server text: hydrates without a mismatch, nothing busy, Copy on', async () => {
    const route = '/gallery/landing/code';
    const { renderApp } = await fresh<Server>('../src/entry-server');
    const html = serverHtml(renderApp, route);
    window.history.replaceState(null, '', route);
    document.body.innerHTML = `<div id="studio-root" data-path="${route}">${html}</div>`;
    const el = document.getElementById('studio-root')!;
    const recoverable: unknown[] = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();
    const sources = await import('../src/gallery/sources');
    const chunk = vi.fn(() => Promise.reject(new Error('500 /_s/landing.js')));
    sources.BY_SLUG.landing = chunk;
    const { boot } = await import('../src/boot');
    await act(async () => { unmount = boot(el, { onRecoverableError: (e) => recoverable.push(e) }); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(recoverable.map(String)).toEqual([]);
    expect(el.querySelector('#srccode')!.textContent).toBe(fs.readFileSync(`${__dirname}/../../site/examples/landing.html`, 'utf8'));
    expect(el.querySelector('pre')!.hasAttribute('aria-busy')).toBe(false);
    expect(el.querySelector<HTMLButtonElement>('#copysrc')!.disabled).toBe(false);
    /* the server text is the source: no chunk round trip before hydration */
    expect(chunk).not.toHaveBeenCalled();
  });
});

describe('hydration', () => {
  for (const v of VISITORS) {
    describe(v.name, () => {
      for (const { path } of LIVE_ROUTES) {
        it(`${path} hydrates without a mismatch`, async () => {
          const el = await hydrate(path, path, v);
          /* A row with a parent (a gallery example or its code) marks its top-level row instead. */
          const top = topOf(path);
          const nav = navActive(path);
          expect(el.querySelector(`.side-full .snav-page [aria-current="${nav === path ? 'page' : 'true'}"]`)?.getAttribute('href')).toBe(nav);
          expect(el.querySelector<HTMLSelectElement>('.studio-select select')!.value).toBe(top);
          /* A code page hydrates with its whole source in place: no empty box, nothing pending. */
          const code = path.match(/^\/gallery\/([a-z0-9-]+)\/code$/);
          if (code) {
            expect(el.querySelector('#srccode')!.textContent).toBe(fs.readFileSync(`${__dirname}/../../site/examples/${code[1]}.html`, 'utf8'));
            expect(el.querySelector('pre')!.hasAttribute('aria-busy')).toBe(false);
            expect(el.querySelector<HTMLButtonElement>('#copysrc')!.disabled).toBe(false);
          }
        });
      }
      it('404.html hydrates at an unknown path', async () => {
        const el = await hydrate('/404', '/gallery/x', v);
        expect(el.querySelector('h1')?.textContent).toBe('Page not found');
        expect(el.querySelector('.snav-page [aria-current="page"]')).toBeNull();
        /* the phone route menu names no current route */
        const sel = el.querySelector<HTMLSelectElement>('.studio-select select')!;
        expect(sel.value).toBe('');
        expect(sel.selectedOptions[0]?.textContent).toBe('Go to');
      });
      it('a direct hit on /foundations/index.html is the Foundations page', async () => {
        const el = await hydrate('/foundations', '/foundations/index.html', v);
        expect(el.querySelector('h1')?.textContent).toBe('Foundations');
        expect(el.querySelector('.side-full .snav-page [aria-current="page"]')?.getAttribute('href')).toBe('/foundations');
      });
    });
  }
});
