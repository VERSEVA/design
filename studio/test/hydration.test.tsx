// Each pre-rendered route hydrates in jsdom with no mismatch: the server HTML is rendered
// with the browser globals hidden (as on the build machine), then booted as main.tsx boots
// it, for a returning visitor whose stored theme differs from the server default.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { LIVE_ROUTES } from '../src/shell/routes-table';

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
const VISITORS = [
  { name: 'stored light, cobalt', store: { 'verseva-brand': 'cobalt', 'verseva-theme': 'light' }, osLight: false, theme: 'light', mode: 'Light' },
  { name: 'stored dark', store: { 'verseva-theme': 'dark' }, osLight: true, theme: undefined, mode: 'Dark' },
  { name: 'system on a light OS', store: { 'verseva-theme': 'system' }, osLight: true, theme: 'light', mode: 'System' },
] as const;

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
  /* the server cannot know the stored mode: the Mode control ships pending */
  expect(html).toMatch(/class="modeswitch" data-pending=""/);

  for (const [k, val] of Object.entries(v.store)) localStorage.setItem(k, val);
  stubOs(v.osLight);
  window.history.replaceState(null, '', url);
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
  /* and the Mode control settles on the stored mode, no longer pending */
  expect(el.querySelector('.modeswitch')!.hasAttribute('data-pending')).toBe(false);
  expect([...el.querySelectorAll('.modeswitch [aria-selected="true"]')].map((b) => b.textContent)).toEqual([v.mode]);
  return el;
}

describe('hydration', () => {
  for (const v of VISITORS) {
    describe(v.name, () => {
      for (const { path } of LIVE_ROUTES) {
        it(`${path} hydrates without a mismatch`, async () => {
          const el = await hydrate(path, path, v);
          expect(el.querySelector('.snav-page [aria-current="page"]')?.getAttribute('href')).toBe(path);
          expect(el.querySelector<HTMLSelectElement>('.studio-select select')!.value).toBe(path);
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
        expect(el.querySelector('.snav-page [aria-current="page"]')?.getAttribute('href')).toBe('/foundations');
      });
    });
  }
});
