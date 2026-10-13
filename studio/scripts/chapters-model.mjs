#!/usr/bin/env node
// Folds the legacy chapter pages (site/*.html) into the studio: one route per
// chapter, with each chapter's h2 sections as sidebar anchors. Writes
// src/data/chapters.json at build time so the sidebar never drifts from the pages.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '../../site');
const out = path.resolve(here, '../src/data/chapters.json');

export const CHAPTERS = [
  { slug: 'components', file: 'components.html', label: 'Components' },
  { slug: 'web-ui', file: 'web-ui.html', label: 'Web UI' },
  { slug: 'data-viz', file: 'data-viz.html', label: 'Data viz' },
  { slug: 'motion', file: 'motion.html', label: 'Motion' },
  { slug: 'decks', file: 'decks.html', label: 'Decks' },
  { slug: 'docs-pdf', file: 'docs-pdf.html', label: 'Docs and PDF' },
  { slug: 'distribute', file: 'distribute.html', label: 'Distribute' },
  { slug: 'gallery', file: 'examples.html', label: 'Gallery' },
];

export const slug = (s) => s.toLowerCase().replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

/* One anchor per h2, in page order: the enclosing <section id> when it has one, else a slug of the heading. */
export function sectionsOf(html) {
  const sections = [];
  const seen = new Set();
  const re = /<section\b[^>]*\bid="([^"]+)"[^>]*>|<h2\b[^>]*>([\s\S]*?)<\/h2>/g;
  let pending = null;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) { pending = m[1]; continue; }
    const full = text(m[2]);
    const label = full.split(' · ')[0].trim();
    let id = pending ?? slug(label);
    pending = null;
    for (let n = 2; seen.has(id); n++) id = `${slug(label)}-${n}`;
    seen.add(id);
    sections.push({ id, label });
  }
  return sections;
}

export function buildChapters() {
  return CHAPTERS.map((c) => ({ ...c, sections: sectionsOf(fs.readFileSync(path.join(site, c.file), 'utf8')) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const chapters = buildChapters();
  fs.writeFileSync(out, JSON.stringify(chapters, null, 2) + '\n');
  console.log(`chapters-model: ${chapters.length} chapters, ${chapters.reduce((n, c) => n + c.sections.length, 0)} sections -> src/data/chapters.json`);
}
