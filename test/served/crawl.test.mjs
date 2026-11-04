// Link crawl over out/: every route in the routes table is a pre-rendered page with the
// studio root, and every in-site link on those pages resolves to a served file, a
// pre-rendered route or a vercel.json redirect; a link to a legacy page must be a redirect.
// Runs after `npm run studio:build && npm run assemble` (npm run test:served).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'out');
const routes = JSON.parse(fs.readFileSync(path.join(root, 'studio/src/data/routes.json'), 'utf8')).filter((r) => !r.proposed);
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

/* vercel.json sources (":name" one segment, ":name*" any tail) as regexes */
const sourceRe = (s) => new RegExp(`^${s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\/:\w+\*/g, '(?:/.*)?').replace(/:\w+/g, '[^/]+')}$`);
const redirects = (vercel.redirects ?? []).map((r) => ({ re: sourceRe(r.source), has: r.has }));
/* a redirect gated on a query (`has`) only covers links that carry that query */
const isRedirect = (url) => redirects.some(({ re, has }) => re.test(url.pathname)
  && (!has || has.every((h) => h.type !== 'query' || url.searchParams.has(h.key))));

/* the legacy pages: site/*.html, served at the root and under /site */
const legacy = new Set(fs.readdirSync(path.join(root, 'site')).filter((f) => f.endsWith('.html')).flatMap((f) => [`/${f}`, `/site/${f}`]));

const pageFile = (p) => path.join(out, p === '/' ? 'index.html' : `${p.slice(1)}/index.html`);
const served = (p) => {
  const f = path.join(out, decodeURIComponent(p).slice(1));
  if (!f.startsWith(out)) return false;
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return true;
  return fs.existsSync(path.join(f, 'index.html'));
};

const SITE = 'https://design.verseva.com';
const hrefs = (html) => [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

test('out/ was assembled', () => {
  assert.ok(fs.existsSync(path.join(out, '.assembled')), 'out/.assembled missing: run npm run studio:build && npm run assemble');
});

test('every route is a pre-rendered page carrying the studio root for its path', () => {
  const bad = [];
  for (const r of routes) {
    const f = pageFile(r.path);
    if (!fs.existsSync(f)) { bad.push(`${r.path}: 404 (no ${path.relative(root, f)})`); continue; }
    const html = fs.readFileSync(f, 'utf8');
    if (!/id="studio-root"/.test(html)) bad.push(`${r.path}: no id="studio-root"`);
    else if (!html.includes(`<div id="studio-root" data-path="${r.path}">`)) bad.push(`${r.path}: studio root not pre-rendered for this path`);
  }
  assert.deepEqual(bad, []);
});

test('every in-site link from every route resolves, and legacy links are redirects', () => {
  const bad = [];
  let checked = 0;
  for (const r of routes) {
    if (!fs.existsSync(pageFile(r.path))) continue; // reported by the route test
    const html = fs.readFileSync(pageFile(r.path), 'utf8');
    for (const href of hrefs(html)) {
      if (!href || href.startsWith('#')) continue;
      const url = new URL(href, `${SITE}${r.path}`);
      if (url.origin !== SITE) continue;
      checked++;
      if (isRedirect(url)) continue;
      if (legacy.has(url.pathname)) { bad.push(`${r.path} -> ${href}: legacy page linked without a redirect`); continue; }
      if (!served(url.pathname)) bad.push(`${r.path} -> ${href}: 404`);
    }
  }
  assert.ok(checked > routes.length, `only ${checked} in-site links found`);
  assert.deepEqual(bad, []);
});
