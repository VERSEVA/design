// Client start: hydrate a pre-rendered root, or render into an empty one (vite dev).
import { StrictMode } from 'react';
import { createRoot, hydrateRoot, type HydrationOptions } from 'react-dom/client';
import { App } from './App';
import { initTheme } from './theme';

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
