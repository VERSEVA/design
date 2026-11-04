// Per-route <head> for the pre-render: title, description, canonical, social tags and
// JSON-LD, all drawn from the one routes table (routes.json).
import { LIVE_ROUTES, ROUTE_TABLE, type RouteMeta } from './routes-table';

export const SITE = 'https://design.verseva.com';
export const SITE_NAME = 'VERSEVA Design';
export const SOCIAL_CARD = { path: '/og.png', width: 1200, height: 630, alt: 'The VERSEVA emblem' };

type Row = RouteMeta & { parent?: string };

export const canonicalFor = (path: string) => (path === '/' ? `${SITE}/` : `${SITE}${path}`);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/* JSON inside <script>: no "</script>" or "<!--" can close or confuse the element. */
const jsonScript = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

function rowFor(path: string): Row {
  const r = LIVE_ROUTES.find((m) => m.path === path);
  if (!r) throw new Error(`head: no live route for ${path}`);
  return r as Row;
}

/** Home, then each ancestor named by `parent` (gallery rows), then the route itself. */
export function crumbsFor(path: string): ReadonlyArray<{ name: string; url: string }> {
  const chain: Row[] = [];
  for (let r: Row | undefined = rowFor(path); r; r = r.parent ? (ROUTE_TABLE.find((m) => m.path === r!.parent) as Row | undefined) : undefined) {
    chain.unshift(r);
    if (chain.length > ROUTE_TABLE.length) throw new Error(`head: parent cycle at ${path}`);
  }
  const home = rowFor('/');
  const rows = chain[0]?.path === '/' ? chain : [home, ...chain];
  return rows.map((r) => ({ name: r.path === '/' ? 'Home' : r.label, url: canonicalFor(r.path) }));
}

export function jsonLdFor(path: string): object {
  const crumbs = crumbsFor(path);
  const graph: object[] = [{
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  }];
  if (path === '/') {
    graph.unshift({
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      name: SITE_NAME,
      url: `${SITE}/`,
      description: rowFor('/').description,
      inLanguage: 'en',
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

/** The route-specific head block, which replaces the template's <title> and description. */
export function headFor(path: string): string {
  const r = rowFor(path);
  const url = canonicalFor(path);
  const img = `${SITE}${SOCIAL_CARD.path}`;
  return [
    `<title>${esc(r.title)}</title>`,
    `<meta name="description" content="${esc(r.description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:title" content="${esc(r.title)}">`,
    `<meta property="og:description" content="${esc(r.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="${SOCIAL_CARD.width}">`,
    `<meta property="og:image:height" content="${SOCIAL_CARD.height}">`,
    `<meta property="og:image:alt" content="${SOCIAL_CARD.alt}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(r.title)}">`,
    `<meta name="twitter:description" content="${esc(r.description)}">`,
    `<meta name="twitter:image" content="${img}">`,
    `<script type="application/ld+json">${jsonScript(jsonLdFor(path))}</script>`,
  ].join('\n');
}
