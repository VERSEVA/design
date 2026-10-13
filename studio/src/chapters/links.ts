// Where a link clicked inside an embedded chapter should go.
import chapters from '../data/chapters.json';

export type LinkTarget =
  | { kind: 'route'; to: string }
  | { kind: 'anchor'; id: string }
  | { kind: 'top'; href: string }
  | { kind: 'native' };

export function resolveChapterLink(href: string, origin: string, currentFile: string): LinkTarget {
  let url: URL;
  try { url = new URL(href, `${origin}/site/${currentFile}`); } catch { return { kind: 'native' }; }
  if (url.origin !== origin) return { kind: 'top', href: url.href };
  const file = url.pathname.split('/').pop() || 'index.html';
  const atSite = url.pathname === `/${file}` || url.pathname === `/site/${file}`;
  if (atSite && file === currentFile && url.hash) return { kind: 'anchor', id: decodeURIComponent(url.hash.slice(1)) };
  if (atSite && (file === 'index.html' || url.pathname === '/')) return { kind: 'route', to: '/' };
  const ch = atSite ? chapters.find((c) => c.file === file) : undefined;
  if (ch) return { kind: 'route', to: `/${ch.slug}${url.hash}` };
  return { kind: 'top', href: url.href };
}
