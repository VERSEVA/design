// Pre-render safety (PR #16): /widgets and the header hydrate with no mismatch for a
// reduced-motion visitor. usePauseMotion reads false on the server and through
// hydration, and the live value only after mount.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { StudioHeader } from '../src/shell/StudioHeader';
import { WidgetsPage } from '../src/widgets/WidgetsPage';

const realMatchMedia = window.matchMedia;
afterEach(() => { window.matchMedia = realMatchMedia; document.body.innerHTML = ''; vi.restoreAllMocks(); });

const reduce = (on: boolean) => {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes('prefers-reduced-motion: reduce'), media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};

function Tree() {
  return <div className="studio"><StudioHeader /><main><WidgetsPage /></main></div>;
}

describe('hydration under reduced motion', () => {
  it('/widgets and the Pause motion control hydrate with no mismatch, then read pressed', async () => {
    reduce(false);
    const html = renderToString(<Tree />);
    reduce(true);
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.appendChild(el);
    const first = el.firstElementChild;
    const errors: string[] = [];
    const recoverable: unknown[] = [];
    vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errors.push(a.map(String).join(' ')); });
    let root: ReturnType<typeof hydrateRoot> | null = null;
    await act(async () => { root = hydrateRoot(el, <Tree />, { onRecoverableError: (e) => recoverable.push(e) }); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(recoverable.map(String)).toEqual([]);
    expect(errors.filter((e) => /hydrat|did not match|mismatch/i.test(e))).toEqual([]);
    expect(el.firstElementChild).toBe(first);
    expect(el.querySelector('button[aria-label="Pause motion"]')?.getAttribute('aria-pressed')).toBe('true');
    act(() => root!.unmount());
  });
});
