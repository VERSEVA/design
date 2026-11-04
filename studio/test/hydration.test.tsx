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
afterEach(() => { unmount?.(); unmount = null; document.body.innerHTML = ''; localStorage.clear(); vi.restoreAllMocks(); });

describe('hydration', () => {
  for (const { path } of LIVE_ROUTES) {
    it(`${path} hydrates without a mismatch`, async () => {
      const { renderApp } = await fresh<Server>('../src/entry-server');
      const html = serverHtml(renderApp, path);
      expect(html).toMatch(/<h1/);

      localStorage.setItem('verseva-brand', 'cobalt');
      localStorage.setItem('verseva-theme', 'light');
      window.history.replaceState(null, '', path);
      document.body.innerHTML = `<div id="studio-root" data-path="${path}">${html}</div>`;
      const el = document.getElementById('studio-root')!;

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
      expect(el.querySelector('h1')).toBeTruthy();
      expect(el.querySelector('.snav-page [aria-current="page"]')?.getAttribute('href')).toBe(path);
    });
  }
});
