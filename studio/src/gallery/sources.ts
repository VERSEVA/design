// Each gallery example's source, read from site/examples/<slug>.html (the file served at
// /examples/<slug>.html) as its own chunk, so the main bundle carries none of them.
// The pre-render primes every source (entry-server.tsx), so /gallery/<slug>/code holds
// the full text without JS; on a cold load the client seeds the route's source from that
// pre-rendered text before it hydrates (boot.tsx), and on a client visit the code page
// loads its chunk, with a Retry if the chunk fails.
import { useEffect, useSyncExternalStore } from 'react';

const LOADERS = import.meta.glob<string>('../../../site/examples/*.html', { query: '?raw', import: 'default' });
const slugOf = (file: string) => file.replace(/^.*\/|\.html$/g, '');
/** slug -> its chunk loader. Exported so tests can stand in a failed network fetch. */
export const BY_SLUG: Record<string, () => Promise<string>> = Object.fromEntries(Object.entries(LOADERS).map(([f, load]) => [slugOf(f), load]));

/** Every example slug with a source, in name order. */
export const SOURCE_SLUGS: ReadonlyArray<string> = Object.keys(BY_SLUG).sort();

const cache: Record<string, string> = {};
const inflight: Record<string, Promise<string | undefined>> = {};
const failed = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The pre-render: every source, keyed by its file path, ready before the first render. */
export function primeSources(files: Record<string, string>) {
  for (const [f, text] of Object.entries(files)) cache[slugOf(f)] = text;
}

/** A cold load: the source as the pre-rendered page already shows it. */
export function primeSource(slug: string, text: string) {
  cache[slug] = text;
}

/** Loads one example's source chunk; resolves undefined for an unknown slug. A failed
    load rejects, is marked failed, and is forgotten, so the next call fetches again. */
export function loadSource(slug: string): Promise<string | undefined> {
  if (slug in cache) return Promise.resolve(cache[slug]);
  const load = BY_SLUG[slug];
  if (!load) return Promise.resolve(undefined);
  return (inflight[slug] ??= load().then((text) => {
    cache[slug] = text;
    failed.delete(slug);
    delete inflight[slug];
    notify();
    return text;
  }, (err: unknown) => {
    failed.add(slug);
    delete inflight[slug];
    notify();
    throw err;
  }));
}

/** The slug a /gallery/<slug>/code path shows, or null. */
export function codeSlugOf(path: string): string | null {
  return path.match(/^\/gallery\/([a-z0-9-]+)\/code$/)?.[1] ?? null;
}

const quiet = (slug: string) => { loadSource(slug).catch(() => { /* recorded in failed */ }); };

/** The source for a slug: '' until its chunk has loaded (it starts loading on mount);
    failed when the chunk did not load, with retry to fetch it again. */
export function useSource(slug: string): { text: string; failed: boolean; retry: () => void } {
  const text = useSyncExternalStore(subscribe, () => cache[slug] ?? '', () => cache[slug] ?? '');
  const isFailed = useSyncExternalStore(subscribe, () => failed.has(slug), () => false);
  useEffect(() => { quiet(slug); }, [slug]);
  return { text, failed: isFailed, retry: () => { failed.delete(slug); notify(); quiet(slug); } };
}
