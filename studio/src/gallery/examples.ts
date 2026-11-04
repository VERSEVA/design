// The gallery examples, read from the routes table: each /gallery/<slug> row is one
// example file, site/examples/<slug>.html, served at /examples/<slug>.html.
import { ROUTE_TABLE } from '../shell/routes-table';
import chapters from '../data/chapters.json';

export interface Example { slug: string; label: string }

export const GALLERY: ReadonlyArray<Example> = ROUTE_TABLE
  .filter((r) => r.parent === '/gallery' && !r.proposed)
  .map((r) => ({ slug: r.path.slice('/gallery/'.length), label: r.label }));

const known = (slug: string) => GALLERY.some((g) => g.slug === slug);

/* Where a link clicked inside an example should go in the studio, or null to leave it
   native (same-page anchors, other sites, assets, anything unknown). `base` is the
   example document's URL; legacy /site/ paths resolve as their root copies. */
export function exampleLink(href: string, base: string, origin: string): string | null {
  let url: URL, doc: URL;
  try { url = new URL(href, base); doc = new URL(base); } catch { return null; }
  if (url.origin !== origin) return null;
  if (url.pathname === doc.pathname && url.search === doc.search) return null;
  const p = url.pathname.replace(/^\/site\//, '/');
  const ex = p.match(/^\/examples\/([a-z0-9-]+)\.html$/);
  if (ex) return known(ex[1]) ? `/gallery/${ex[1]}${url.hash}` : null;
  if (p === '/code.html') {
    const f = url.searchParams.get('f')?.match(/^examples\/([a-z0-9-]+)\.html$/);
    return f && known(f[1]) ? `/gallery/${f[1]}/code` : null;
  }
  if (p === '/' || p === '/index.html') return `/${url.hash}`;
  const ch = chapters.find((c) => p === `/${c.file}`);
  return ch ? `/${ch.slug}${url.hash}` : null;
}
