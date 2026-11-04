// History API router: three studio routes, hash anchors within each page.
import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') window.addEventListener('popstate', notify);

export function navigate(href: string) {
  const url = new URL(href, window.location.href);
  if (url.pathname + url.hash === window.location.pathname + window.location.hash) return;
  window.history.pushState(null, '', url.pathname + url.hash);
  notify();
  if (url.hash) requestAnimationFrame(() => document.getElementById(url.hash.slice(1))?.scrollIntoView());
  else window.scrollTo(0, 0);
}

/* A cold deep link (/foundations#motion) lands once the page has rendered. A malformed
   escape (#%) must not throw out of an effect and unmount the studio: use the raw id. */
export function scrollToHash() {
  const raw = window.location.hash.slice(1);
  if (!raw) return;
  let id = raw;
  try { id = decodeURIComponent(raw); } catch { /* keep raw */ }
  document.getElementById(id)?.scrollIntoView();
}

const snapshot = () => window.location.pathname;
export function usePath(): string {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, snapshot, () => '/');
}

/* Click handler for in-studio links: keeps modified clicks native. */
export function onStudioLink(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = e.currentTarget.getAttribute('href');
  if (!href || !href.startsWith('/') || href.includes('.html')) return;
  e.preventDefault();
  navigate(href);
}
