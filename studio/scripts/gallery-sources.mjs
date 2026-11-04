#!/usr/bin/env node
// The gallery code routes show each example's source inline, so a pre-rendered
// /gallery/<slug>/code page holds the real text and nothing is fetched. This writes
// src/gallery/sources.json from site/examples/*.html (the files assemble serves at
// /examples). test/gallery-frames.test.tsx regenerates it in memory and fails if stale.
// usage: node studio/scripts/gallery-sources.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const studio = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** { slug: source } for every example file, in name order. */
export function gallerySources(dir) {
  return Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort()
    .map((f) => [f.replace(/\.html$/, ''), fs.readFileSync(path.join(dir, f), 'utf8')]));
}

export const format = (sources) => JSON.stringify(sources, null, 2) + '\n';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sources = gallerySources(path.join(studio, '..', 'site/examples'));
  const outFile = path.join(studio, 'src/gallery/sources.json');
  fs.writeFileSync(outFile, format(sources));
  console.log(`gallery-sources: ${Object.keys(sources).length} examples -> ${path.relative(process.cwd(), outFile)}`);
}
