// Client start: hydrate a pre-rendered root, or render into an empty one (vite dev).
import { StrictMode } from 'react';
import { createRoot, hydrateRoot, type HydrationOptions } from 'react-dom/client';
import { App } from './App';
import { initTheme } from './theme';
import { codeSlugOf, primeSource } from './gallery/sources';

/* Before hydrating: a pre-rendered code page seeds its source from the text it already
   shows, so hydration renders the same text (no mismatch, no chunk round trip, nothing a
   failed chunk can erase). */
export function ready(el: HTMLElement): void {
  const slug = codeSlugOf(el.dataset.path ?? window.location.pathname);
  const code = slug ? el.querySelector('#srccode') : null;
  if (slug && code?.textContent) primeSource(slug, code.textContent);
}

export function boot(el: HTMLElement, opts: Pick<HydrationOptions, 'onRecoverableError'> = {}): () => void {
  initTheme();
  const app = <StrictMode><App /></StrictMode>;
  if (el.hasChildNodes()) {
    ready(el);
    const root = hydrateRoot(el, app, opts);
    return () => root.unmount();
  }
  const root = createRoot(el, opts);
  root.render(app);
  return () => root.unmount();
}
