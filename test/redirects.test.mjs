// vercel.json's redirects for the legacy site: /code.html?f=<example> lands on that
// example's gallery code route, any other /code.html on /gallery, and every
// /site/*.html chapter page on its studio route. Each is a 308.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { root, redirectFor } from './served/vercel-routing.mjs';

const routes = JSON.parse(fs.readFileSync(path.join(root, 'studio/src/data/routes.json'), 'utf8')).filter((r) => !r.proposed);
const live = new Set(routes.map((r) => r.path));
const examples = fs.readdirSync(path.join(root, 'site/examples')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));
const legacy = fs.readdirSync(path.join(root, 'site')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));

/* A legacy page's studio route: index is /, the examples page is the gallery, code needs its query. */
const routeFor = (page) => (page === 'index' ? '/' : page === 'examples' ? '/gallery' : page === 'code' ? '/gallery' : `/${page}`);
const pathOf = (loc) => new URL(loc, 'https://x').pathname;

test('every example in site/examples has a gallery code route', () => {
  assert.ok(examples.length >= 8, `only ${examples.length} examples`);
  for (const slug of examples) assert.ok(live.has(`/gallery/${slug}/code`), `/gallery/${slug}/code is not a route`);
});

for (const base of ['/code.html', '/site/code.html']) {
  test(`${base}?f=examples/<slug>.html 308s to /gallery/<slug>/code for every example`, () => {
    for (const slug of examples) {
      const r = redirectFor(`${base}?f=examples/${slug}.html`);
      assert.ok(r, `${base}?f=examples/${slug}.html does not redirect`);
      assert.equal(r.status, 308);
      assert.equal(pathOf(r.location), `/gallery/${slug}/code`);
    }
  });

  test(`${base} with an unknown f, or none, 308s to /gallery`, () => {
    for (const q of ['', '?f=', '?f=examples/bogus.html', '?f=../secret.html', '?f=examples/console.html.bak', '?f=xexamples/console.html', '?x=1']) {
      const r = redirectFor(base + q);
      assert.ok(r, `${base}${q} does not redirect`);
      assert.equal(r.status, 308, `${base}${q}`);
      assert.equal(pathOf(r.location), '/gallery', `${base}${q} -> ${r.location}`);
    }
  });
}

test('every /site/*.html page 308s to its studio route, and so does its root copy', () => {
  for (const page of legacy) {
    for (const p of [`/site/${page}.html`, `/${page}.html`]) {
      const r = redirectFor(p);
      assert.ok(r, `${p} does not redirect`);
      assert.equal(r.status, 308, p);
      assert.equal(pathOf(r.location), routeFor(page), `${p} -> ${r.location}`);
      assert.ok(live.has(pathOf(r.location)), `${p} -> ${r.location}, not a live route`);
    }
  }
});

test('files that keep serving as files never redirect', () => {
  const files = [
    ...fs.readdirSync(path.join(root, 'site/r')).flatMap((f) => [`/r/${f}`, `/site/r/${f}`]),
    ...examples.flatMap((s) => [`/examples/${s}.html`, `/site/examples/${s}.html`]),
    '/site.css', '/theme.js', '/site/site.css', '/site/theme.js', '/site/DEPLOY.md',
    '/tokens.css', '/components.css', '/registry.json', '/blocks/launch.html', '/react/button.tsx', '/docs/laws.md',
  ];
  const redirected = files.filter((p) => redirectFor(p));
  assert.deepEqual(redirected, []);
});
