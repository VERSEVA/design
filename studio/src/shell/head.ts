// Per-route <head>: title, description, canonical, social tags and JSON-LD, all drawn from
// the one routes table (routes.json). The pre-render writes it as HTML (headFor); the
// client keeps it in step on navigation (applyHead). One tag list feeds both.
import { LIVE_ROUTES, ROUTE_TABLE, type RouteMeta } from './routes-table';

export const SITE = 'https://design.verseva.com';
export const SITE_NAME = 'VERSEVA Design';
export const SOCIAL_CARD = { path: '/og.png', width: 1200, height: 630, alt: 'The VERSEVA emblem' };
export const NOT_FOUND_HEAD = { title: 'Page not found: VERSEVA Design', description: 'This page does not exist on design.verseva.com.' };

type Row = RouteMeta & { parent?: string };

export const canonicalFor = (path: string) => (path === '/' ? `${SITE}/` : `${SITE}${path}`);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/* JSON inside <script>: no "</script>" or "<!--" can close or confuse the element. */
const jsonScript = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

const liveRow = (path: string) => LIVE_ROUTES.find((m) => m.path === path) as Row | undefined;
function rowFor(path: string): Row {
  const r = liveRow(path);
  if (!r) throw new Error(`head: no live route for ${path}`);
  return r;
}

/** Home, then each ancestor named by `parent` (gallery rows), then the route itself. */
export function crumbsFor(path: string): ReadonlyArray<{ name: string; url: string }> {
  const chain: Row[] = [];
  for (let r: Row | undefined = rowFor(path); r; r = r.parent ? (ROUTE_TABLE.find((m) => m.path === r!.parent) as Row | undefined) : undefined) {
    chain.unshift(r);
    if (chain.length > ROUTE_TABLE.length) throw new Error(`head: parent cycle at ${path}`);
  }
  const rows = chain[0]?.path === '/' ? chain : [rowFor('/'), ...chain];
  return rows.map((r) => ({ name: r.path === '/' ? 'Home' : r.label, url: canonicalFor(r.path) }));
}

export function jsonLdFor(path: string): object {
  const graph: object[] = [{
    '@type': 'BreadcrumbList',
    itemListElement: crumbsFor(path).map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  }];
  if (path === '/') {
    graph.unshift({ '@type': 'WebSite', '@id': `${SITE}/#website`, name: SITE_NAME, url: `${SITE}/`, description: rowFor('/').description, inLanguage: 'en' });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

type Tag =
  | { kind: 'meta'; attr: 'name' | 'property'; key: string; content: string }
  | { kind: 'link'; rel: 'canonical'; href: string };

/* Every tag the router manages; anything in this list but absent for a page is removed. */
const MANAGED: ReadonlyArray<[Tag['kind'], string]> = [
  ['link', 'canonical'],
  ...['robots', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'].map((k) => ['meta', k] as [Tag['kind'], string]),
  ...['og:type', 'og:site_name', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt'].map((k) => ['meta', k] as [Tag['kind'], string]),
];

interface Head { title: string; description: string; tags: Tag[]; jsonLd: object | null }

/** A live route's head, or the not-found head (noindex, no canonical, no JSON-LD) for null. */
export function headData(path: string | null): Head {
  const r = path === null ? undefined : liveRow(path);
  if (!r) {
    return { ...NOT_FOUND_HEAD, tags: [{ kind: 'meta', attr: 'name', key: 'robots', content: 'noindex' }], jsonLd: null };
  }
  const url = canonicalFor(r.path);
  const img = `${SITE}${SOCIAL_CARD.path}`;
  const og = (key: string, content: string): Tag => ({ kind: 'meta', attr: 'property', key, content });
  const tw = (key: string, content: string): Tag => ({ kind: 'meta', attr: 'name', key, content });
  return {
    title: r.title,
    description: r.description,
    jsonLd: jsonLdFor(r.path),
    tags: [
      { kind: 'link', rel: 'canonical', href: url },
      og('og:type', 'website'), og('og:site_name', SITE_NAME), og('og:title', r.title), og('og:description', r.description),
      og('og:url', url), og('og:image', img), og('og:image:width', String(SOCIAL_CARD.width)),
      og('og:image:height', String(SOCIAL_CARD.height)), og('og:image:alt', SOCIAL_CARD.alt),
      tw('twitter:card', 'summary_large_image'), tw('twitter:title', r.title), tw('twitter:description', r.description), tw('twitter:image', img),
    ],
  };
}

/** The head block the pre-render writes in place of the template's <title> and description. */
export function headFor(path: string | null): string {
  const h = headData(path);
  return [
    `<title>${esc(h.title)}</title>`,
    `<meta name="description" content="${esc(h.description)}">`,
    ...h.tags.map((t) => (t.kind === 'link' ? `<link rel="${t.rel}" href="${esc(t.href)}">` : `<meta ${t.attr}="${t.key}" content="${esc(t.content)}">`)),
    ...(h.jsonLd ? [`<script type="application/ld+json">${jsonScript(h.jsonLd)}</script>`] : []),
  ].join('\n');
}

/* Open Graph keys live on property=, everything else on name= (as headData writes them). */
const selector = (kind: Tag['kind'], key: string) =>
  kind === 'link' ? `link[rel="${key}"]` : `meta[${key.startsWith('og:') ? 'property' : 'name'}="${key}"]`;

/** Brings document.head in line with the route after a client-side navigation. */
export function applyHead(doc: Document, path: string | null) {
  const h = headData(path);
  doc.title = h.title;
  const upsert = (sel: string, make: () => Element, set: (el: Element) => void) => {
    let el = doc.head.querySelector(sel);
    if (!el) { el = make(); doc.head.appendChild(el); }
    set(el);
  };
  upsert('meta[name="description"]', () => Object.assign(doc.createElement('meta'), { name: 'description' }), (el) => el.setAttribute('content', h.description));
  const keep = new Set<string>();
  for (const t of h.tags) {
    const key = t.kind === 'link' ? t.rel : t.key;
    keep.add(selector(t.kind, key));
    if (t.kind === 'link') upsert(selector('link', key), () => Object.assign(doc.createElement('link'), { rel: t.rel }), (el) => el.setAttribute('href', t.href));
    else upsert(selector('meta', key), () => { const m = doc.createElement('meta'); m.setAttribute(t.attr, t.key); return m; }, (el) => el.setAttribute('content', t.content));
  }
  for (const [kind, key] of MANAGED) {
    const sel = selector(kind, key);
    if (!keep.has(sel)) doc.head.querySelectorAll(sel).forEach((el) => el.remove());
  }
  const ld = doc.head.querySelector('script[type="application/ld+json"]');
  if (!h.jsonLd) ld?.remove();
  else upsert('script[type="application/ld+json"]', () => Object.assign(doc.createElement('script'), { type: 'application/ld+json' }), (el) => { el.textContent = JSON.stringify(h.jsonLd); });
}
