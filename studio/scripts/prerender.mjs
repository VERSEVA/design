#!/usr/bin/env node
// After `vite build` and `vite build --ssr src/entry-server.tsx --outDir dist-ssr`:
// writes dist/<route>/index.html for every live route in routes.json (dist/index.html for /),
// each with its own head and pre-rendered root, then the SEO kit (icons, social card,
// manifest, robots, sitemap). dist-ssr is build scratch and is removed at the end.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeSeoKit } from './seo-kit.mjs';

const studio = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(studio, 'dist');
const ssrDir = path.join(studio, 'dist-ssr');
const entry = ['entry-server.js', 'entry-server.mjs'].map((f) => path.join(ssrDir, f)).find((f) => fs.existsSync(f));
if (!entry) { console.error('prerender: dist-ssr/entry-server.js missing, run the ssr build first'); process.exit(1); }

const { renderDocument, PRERENDER_PATHS } = await import(pathToFileURL(entry).href);
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

for (const route of PRERENDER_PATHS) {
  if (!/^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/.test(route)) throw new Error(`prerender: refusing route path ${route}`);
  const file = route === '/' ? path.join(dist, 'index.html') : path.join(dist, route.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, renderDocument(template, route));
}
const kit = writeSeoKit(dist, PRERENDER_PATHS);
fs.rmSync(ssrDir, { recursive: true, force: true });
console.log(`prerender: ${PRERENDER_PATHS.length} routes, ${kit.length} SEO kit files -> dist/`);
