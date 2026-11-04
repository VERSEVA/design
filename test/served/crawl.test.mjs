// Link crawl over out/: every route in the routes table is a pre-rendered page with the
// studio root. From every route (and 404.html) the crawl follows every in-site link the
// way Vercel answers it (vercel.json redirects first, then out/), through redirects and
// onto every studio page it reaches, and fails on a 404, on a page without
// id="studio-root" (404.html and the served example and file paths excepted), and on a
// link to a legacy page that is not a redirect, or on a link (not a frame) to an example
// file, which would leave the shell. A planted-defect run proves it can fail.
// Runs after `npm run studio:build && npm run assemble` (npm run test:served).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { root, SITE, resolve, redirectFor, redirectsOf } from './vercel-routing.mjs';

const out = path.join(root, 'out');
const routes = JSON.parse(fs.readFileSync(path.join(root, 'studio/src/data/routes.json'), 'utf8')).filter((r) => !r.proposed);
const { paths: declared } = JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/served-paths.json'), 'utf8'));

/* the legacy pages: site/*.html, served at the root and under /site */
const LEGACY = new Set(fs.readdirSync(path.join(root, 'site')).filter((f) => f.endsWith('.html')).flatMap((f) => [`/${f}`, `/site/${f}`]));
/* pages that are not the studio by design: 404.html, the gallery examples, and declared files (blocks, templates) */
const EXEMPT = (p) => p === '/404.html' || /^\/(site\/)?examples\//.test(p) || declared[p] === 'file';

const pageFile = (p) => path.join(out, p === '/' ? 'index.html' : `${p.slice(1)}/index.html`);
const isRedirect = (url) => !!redirectFor(url);
const served = (p) => resolve(out, p).kind === 'file';
const links = (html) => [...html.matchAll(/<(a|iframe)\b[^>]*?\s(?:href|src)="([^"]*)"/g)].map((m) => [m[1], m[2].replace(/&amp;/g, '&')]);

/* Crawls out/ from `starts` (paths); returns { bad, links, pages }. */
export function crawl(dir, starts, { legacy = LEGACY, exempt = EXEMPT, redirect = redirectFor } = {}) {
  const bad = [];
  const seen = new Set();
  let checked = 0;
  const pages = new Set();
  const queue = starts.map((p) => ({ url: new URL(p, SITE), from: '(start)' }));
  while (queue.length) {
    const { url, from } = queue.shift();
    const key = url.pathname + url.search;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = `${from} -> ${key}`;
    const r = resolve(dir, url, redirect);
    if (legacy.has(url.pathname) && r.kind !== 'redirect') bad.push(`${label}: legacy page linked without a redirect`);
    if (r.kind === '404') { bad.push(`${label}: 404`); continue; }
    if (r.kind === 'redirect') {
      /* a redirect lands in one hop: its target must not redirect again, and a repeat is a loop */
      const chain = [key];
      let to = new URL(r.location, SITE);
      let next = resolve(dir, to, redirect);
      while (next.kind === 'redirect' && !chain.includes(to.pathname + to.search)) {
        chain.push(to.pathname + to.search);
        to = new URL(next.location, SITE);
        next = resolve(dir, to, redirect);
      }
      const end = to.pathname + to.search;
      if (chain.includes(end)) { bad.push(`${label}: redirect loop ${[...chain, end].join(' -> ')}`); continue; }
      if (chain.length > 1) { bad.push(`${label}: redirect chain ${[...chain, end].join(' -> ')}, more than one hop`); continue; }
      queue.push({ url: to, from: `${from} (via ${key})` });
      continue;
    }
    if (!r.file.endsWith('.html')) continue;
    const html = fs.readFileSync(r.file, 'utf8');
    const studio = /id="studio-root"/.test(html);
    if (!studio) { if (!exempt(url.pathname)) bad.push(`${label}: no id="studio-root"`); continue; }
    if (pages.has(r.file)) continue;
    pages.add(r.file);
    for (const [tag, href] of links(html)) {
      if (!href || href.startsWith('#')) continue;
      const next = new URL(href, url);
      if (next.origin !== SITE) continue;
      checked++;
      /* an example may load in a frame, but a link to one leaves the shell: link its gallery page */
      if (tag === 'a' && /^\/(site\/)?examples\/[^/]+\.html$/.test(next.pathname)) bad.push(`${key} -> ${href}: a link out of the shell to an example file`);
      queue.push({ url: next, from: key });
    }
  }
  return { bad, links: checked, pages: pages.size };
}

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

test('404.html is the studio shell, kept out of the index', () => {
  const f = path.join(out, '404.html');
  assert.ok(fs.existsSync(f), 'out/404.html missing');
  const html = fs.readFileSync(f, 'utf8');
  assert.match(html, /<div id="studio-root" data-path="\/404">/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(html, /rel="canonical"/);
});

test('the crawl from every route reaches only live pages, through redirects for legacy links', () => {
  const { bad, links: n, pages } = crawl(out, [...routes.map((r) => r.path), '/404.html']);
  assert.ok(pages >= routes.length, `the crawl reached only ${pages} studio pages`);
  assert.ok(n > routes.length, `only ${n} in-site links found`);
  assert.deepEqual(bad, []);
});

test('the crawl is not vacuous: a planted 404, a page without the studio root, an unredirected legacy link, a link to an example file, a redirect chain and a redirect loop each fail', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsv-crawl-'));
  try {
    const page = (body) => `<!doctype html><div id="studio-root" data-path="/">${body}</div>`;
    fs.writeFileSync(path.join(dir, 'index.html'), page('<a href="/ok">ok</a><a href="/missing">gone</a><a href="/plain.html">plain</a><a href="/old.html">old</a><iframe src="/examples/x.html"></iframe><a href="/examples/x.html">x</a><a href="/hop1">chain</a><a href="/loopa">loop</a><a href="/one">one hop</a>'));
    fs.mkdirSync(path.join(dir, 'ok'));
    fs.writeFileSync(path.join(dir, 'ok/index.html'), page('<a href="/">home</a>'));
    fs.writeFileSync(path.join(dir, 'plain.html'), '<!doctype html><p>no shell</p>');
    fs.writeFileSync(path.join(dir, 'old.html'), page(''));
    fs.mkdirSync(path.join(dir, 'examples'));
    fs.writeFileSync(path.join(dir, 'examples/x.html'), '<!doctype html><p>an example</p>');
    const redirect = redirectsOf({ redirects: [
      { source: '/hop1', destination: '/hop2', permanent: true },
      { source: '/hop2', destination: '/', permanent: true },
      { source: '/loopa', destination: '/loopb', permanent: true },
      { source: '/loopb', destination: '/loopa', permanent: true },
      { source: '/one', destination: '/ok', permanent: true },
    ] });
    const { bad } = crawl(dir, ['/'], { legacy: new Set(['/old.html']), exempt: (p) => p.startsWith('/examples/'), redirect });
    assert.deepEqual(bad.sort(), [
      '/ -> /examples/x.html: a link out of the shell to an example file',
      '/ -> /hop1: redirect chain /hop1 -> /hop2 -> /, more than one hop',
      '/ -> /loopa: redirect loop /loopa -> /loopb -> /loopa',
      '/ -> /missing: 404',
      '/ -> /old.html: legacy page linked without a redirect',
      '/ -> /plain.html: no id="studio-root"',
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an unknown gallery example or code path is not served, so Vercel answers with 404.html', () => {
  assert.ok(fs.existsSync(path.join(out, '404.html')), 'out/404.html missing');
  for (const p of ['/gallery/bogus', '/gallery/bogus/code']) {
    assert.equal(served(p), false, `${p} must not resolve to a file or a pre-rendered page`);
    assert.equal(isRedirect(new URL(p, SITE)), false, `${p} must not redirect`);
  }
  for (const r of routes.filter((m) => m.parent)) assert.ok(fs.existsSync(pageFile(r.path)), `${r.path}: no pre-rendered page`);
});
