// Each gallery example's source, read from site/examples/<slug>.html (the file served at
// /examples/<slug>.html) as its own chunk, so the main bundle carries none of them.
// The pre-render primes every source (entry-server.tsx), so /gallery/<slug>/code holds
// the full text without JS; the client loads the route's source before it hydrates
// (main.tsx), and on a later visit when the code page asks for it.
import { useEffect, useSyncExternalStore } from 'react';

const LOADERS = import.meta.glob<string>('../../../site/examples/*.html', { query: '?raw', import: 'default' });
const slugOf = (file: string) => file.replace(/^.*\/|\.html$/g, '');
const BY_SLUG: Record<string, () => Promise<string>> = Object.fromEntries(Object.entries(LOADERS).map(([f, load]) => [slugOf(f), load]));

/** Every example slug with a source, in name order. */
export const SOURCE_SLUGS: ReadonlyArray<string> = Object.keys(BY_SLUG).sort();

const cache: Record<string, string> = {};
const inflight: Record<string, Promise<string | undefined>> = {};
const listeners = new Set<() => void>();

/** The pre-render: every source, keyed by its file path, ready before the first render. */
export function primeSources(files: Record<string, string>) {
  for (const [f, text] of Object.entries(files)) cache[slugOf(f)] = text;
}

/** Loads one example's source chunk; resolves undefined for an unknown slug. */
export function loadSource(slug: string): Promise<string | undefined> {
  if (slug in cache) return Promise.resolve(cache[slug]);
  const load = BY_SLUG[slug];
  if (!load) return Promise.resolve(undefined);
  return (inflight[slug] ??= load().then((text) => {
    cache[slug] = text;
    delete inflight[slug];
    listeners.forEach((l) => l());
    return text;
  }));
}

/** The slug a /gallery/<slug>/code path shows, or null. */
export function codeSlugOf(path: string): string | null {
  return path.match(/^\/gallery\/([a-z0-9-]+)\/code$/)?.[1] ?? null;
}

/** The source for a slug: '' until its chunk has loaded (it starts loading on mount). */
export function useSource(slug: string): string {
  const get = () => cache[slug] ?? '';
  const text = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, get, get);
  useEffect(() => { void loadSource(slug); }, [slug]);
  return text;
}
