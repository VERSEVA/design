// @vitest-environment node
// Every pre-rendered route: its own head from the routes table, real content without JS,
// and the theme script ahead of every stylesheet.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderDocument, renderNotFound, PRERENDER_PATHS } from '../src/entry-server';
import { LIVE_ROUTES } from '../src/shell/routes-table';

const SITE = 'https://design.verseva.com';
const template = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const docs = new Map(PRERENDER_PATHS.map((p) => [p, renderDocument(template, p)]));

const all = (html: string, re: RegExp) => [...html.matchAll(re)].map((m) => m[1]);
const one = (html: string, re: RegExp, what: string) => {
  const found = all(html, re);
  expect(found.length, `${what}: exactly one`).toBe(1);
  return found[0];
};
const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const meta = (html: string, attr: 'name' | 'property', key: string) =>
  one(html, new RegExp(`<meta ${attr}="${reEscape(key)}" content="([^"]*)">`, 'g'), key);
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

describe('pre-render heads', () => {
  it('pre-renders every live route in the table', () => {
    expect([...PRERENDER_PATHS].sort()).toEqual(LIVE_ROUTES.map((r) => r.path).sort());
  });

  it('gives every route a unique title and canonical', () => {
    const titles = [...docs.values()].map((d) => one(d, /<title>([^<]*)<\/title>/g, 'title'));
    expect(new Set(titles).size).toBe(titles.length);
    const canon = [...docs.values()].map((d) => one(d, /<link rel="canonical" href="([^"]*)">/g, 'canonical'));
    expect(new Set(canon).size).toBe(canon.length);
  });

  for (const r of LIVE_ROUTES) {
    describe(r.path, () => {
      const html = docs.get(r.path)!;
      const url = r.path === '/' ? `${SITE}/` : `${SITE}${r.path}`;

      it('carries the approved title (60 or fewer) and description (160 or fewer)', () => {
        const title = decode(one(html, /<title>([^<]*)<\/title>/g, 'title'));
        const desc = decode(meta(html, 'name', 'description'));
        expect(title).toBe(r.title);
        expect(desc).toBe(r.description);
        expect(title.length).toBeLessThanOrEqual(60);
        expect(desc.length).toBeLessThanOrEqual(160);
      });

      it('has a canonical on design.verseva.com matching its path', () => {
        expect(one(html, /<link rel="canonical" href="([^"]*)">/g, 'canonical')).toBe(url);
      });

      it('has Open Graph and Twitter tags', () => {
        expect(meta(html, 'property', 'og:type')).toBe('website');
        expect(decode(meta(html, 'property', 'og:title'))).toBe(r.title);
        expect(decode(meta(html, 'property', 'og:description'))).toBe(r.description);
        expect(meta(html, 'property', 'og:url')).toBe(url);
        expect(meta(html, 'property', 'og:image')).toBe(`${SITE}/og.png`);
        expect(meta(html, 'property', 'og:image:width')).toBe('1200');
        expect(meta(html, 'property', 'og:image:height')).toBe('630');
        expect(meta(html, 'name', 'twitter:card')).toBe('summary_large_image');
        expect(decode(meta(html, 'name', 'twitter:title'))).toBe(r.title);
        expect(decode(meta(html, 'name', 'twitter:description'))).toBe(r.description);
        expect(meta(html, 'name', 'twitter:image')).toBe(`${SITE}/og.png`);
      });

      it('has valid JSON-LD: a breadcrumb ending at this page, and WebSite on home only', () => {
        const raw = one(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, 'JSON-LD');
        const ld = JSON.parse(raw);
        expect(ld['@context']).toBe('https://schema.org');
        const graph: Array<Record<string, unknown>> = ld['@graph'];
        const crumbs = graph.find((g) => g['@type'] === 'BreadcrumbList') as { itemListElement: Array<{ '@type': string; position: number; name: string; item: string }> };
        expect(crumbs).toBeTruthy();
        const items = crumbs.itemListElement;
        expect(items.map((i) => i.position)).toEqual(items.map((_, i) => i + 1));
        for (const i of items) { expect(i['@type']).toBe('ListItem'); expect(i.name.length).toBeGreaterThan(0); expect(i.item.startsWith(`${SITE}/`)).toBe(true); }
        expect(items[0].item).toBe(`${SITE}/`);
        expect(items[items.length - 1].item).toBe(url);
        const site = graph.filter((g) => g['@type'] === 'WebSite');
        if (r.path === '/') {
          expect(site.length).toBe(1);
          expect(site[0].url).toBe(`${SITE}/`);
          expect(site[0].name).toBe('VERSEVA Design');
        } else expect(site.length).toBe(0);
      });

      it('ships real headings without JS, inside #studio-root[data-path]', () => {
        const root = html.match(/<div id="studio-root" data-path="([^"]*)">([\s\S]*)<\/div>\s*<script type="module"/);
        expect(root, 'pre-rendered root').toBeTruthy();
        expect(root![1]).toBe(r.path);
        expect(root![2]).toMatch(/<h1[^>]*>[\s\S]*?\S[\s\S]*?<\/h1>/);
        expect(root![2]).toContain('studio-main');
      });

      it('sets theme attributes and .js in an inline script ahead of every stylesheet', () => {
        const head = html.slice(0, html.indexOf('</head>'));
        const script = head.search(/<script>[\s\S]*?classList\.add\('js'\)/);
        const css = head.search(/<link rel="stylesheet"/);
        expect(script).toBeGreaterThan(-1);
        expect(css).toBeGreaterThan(-1);
        expect(script).toBeLessThan(css);
      });

      it('links the icon set and manifest', () => {
        expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="32x32">');
        expect(html).toContain('<link rel="icon" href="/icon.svg" type="image/svg+xml">');
        expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png">');
        expect(html).toContain('<link rel="manifest" href="/site.webmanifest">');
      });
    });
  }
});

describe('a row with a parent', () => {
  it('carries the full breadcrumb chain in JSON-LD: Home > Gallery > the example > Code', () => {
    const html = docs.get('/gallery/pulse/code')!;
    const ld = JSON.parse(one(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, 'JSON-LD'));
    const crumbs = ld['@graph'].find((g: { '@type': string }) => g['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((i: { position: number; name: string; item: string }) => [i.position, i.name, i.item])).toEqual([
      [1, 'Home', `${SITE}/`],
      [2, 'Gallery', `${SITE}/gallery`],
      [3, 'Pulse · analytics', `${SITE}/gallery/pulse`],
      [4, 'Code', `${SITE}/gallery/pulse/code`],
    ]);
  });

  it('pre-renders every example and code route with its real content', () => {
    for (const r of LIVE_ROUTES.filter((m) => m.parent)) {
      const html = docs.get(r.path)!;
      expect(html, r.path).toContain(`<div id="studio-root" data-path="${r.path}">`);
      if (r.path.endsWith('/code')) expect(decode(html.match(/<code id="srccode">([\s\S]*?)<\/code>/)![1]), r.path).toMatch(/^<!DOCTYPE html>/);
      else expect(html, r.path).toMatch(/<iframe[^>]*class="gex-frame"[^>]*src="\/examples\/[a-z0-9-]+\.html"/);
    }
  });
});

describe('404.html', () => {
  const html = renderNotFound(template);

  it('is the studio shell with a not-found page, kept out of the index', () => {
    expect(one(html, /<title>([^<]*)<\/title>/g, 'title')).toBe('Page not found: VERSEVA Design');
    expect(meta(html, 'name', 'robots')).toBe('noindex');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('application/ld+json');
    const root = html.match(/<div id="studio-root" data-path="\/404">([\s\S]*)<\/div>\s*<script type="module"/);
    expect(root, 'pre-rendered root').toBeTruthy();
    expect(root![1]).toMatch(/<h1[^>]*>Page not found<\/h1>/);
    expect(root![1]).toContain('href="/"');
  });
});
