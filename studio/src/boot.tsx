// Client start: hydrate a pre-rendered root, or render into an empty one (vite dev).
import { StrictMode } from 'react';
import { createRoot, hydrateRoot, type HydrationOptions } from 'react-dom/client';
import { App } from './App';
import { initTheme } from './theme';
import { codeSlugOf, loadSource } from './gallery/sources';

/* Before boot: a pre-rendered code page loads its source chunk first, so hydration renders
   the same text as the HTML (no mismatch, no empty box). A failed load boots anyway. */
export async function ready(el: HTMLElement): Promise<void> {
  const slug = codeSlugOf(el.dataset.path ?? window.location.pathname);
  if (slug) await loadSource(slug).catch(() => undefined);
}

export function boot(el: HTMLElement, opts: Pick<HydrationOptions, 'onRecoverableError'> = {}): () => void {
  initTheme();
  const app = <StrictMode><App /></StrictMode>;
  if (el.hasChildNodes()) {
    const root = hydrateRoot(el, app, opts);
    return () => root.unmount();
  }
  const root = createRoot(el, opts);
  root.render(app);
  return () => root.unmount();
}
