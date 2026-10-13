import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sectionsOf, buildChapters, CHAPTERS } from '../scripts/chapters-model.mjs';
import { resolveChapterLink } from '../src/chapters/links';

const repo = path.resolve(__dirname, '../..');
const O = 'https://design.verseva.com';

describe('chapter fold', () => {
  it('takes a section id when present, else a slug of the h2, trimming dated suffixes', () => {
    const html = '<section id="tokens"><h2>Tokens</h2></section><div><h2>Radius + press · amended 2026-08-31</h2></div><h2>Tokens</h2>';
    expect(sectionsOf(html)).toEqual([
      { id: 'tokens', label: 'Tokens' },
      { id: 'radius-press', label: 'Radius + press' },
      { id: 'tokens-2', label: 'Tokens' },
    ]);
  });

  it('gives every chapter page at least one section and keeps the generated data current', () => {
    const built = buildChapters();
    expect(built.map((c) => c.slug)).toEqual(CHAPTERS.map((c) => c.slug));
    for (const c of built) expect(c.sections.length).toBeGreaterThan(0);
    const committed = JSON.parse(fs.readFileSync(path.join(repo, 'studio/src/data/chapters.json'), 'utf8'));
    expect(committed).toEqual(built);
  });

  it('routes chapter links through the studio and sends everything else to the top window', () => {
    expect(resolveChapterLink('motion.html', O, 'components.html')).toEqual({ kind: 'route', to: '/motion' });
    expect(resolveChapterLink('examples.html#mock', O, 'components.html')).toEqual({ kind: 'route', to: '/gallery#mock' });
    expect(resolveChapterLink('index.html', O, 'motion.html')).toEqual({ kind: 'route', to: '/' });
    expect(resolveChapterLink('#tokens', O, 'motion.html')).toEqual({ kind: 'anchor', id: 'tokens' });
    expect(resolveChapterLink('examples/pulse.html', O, 'examples.html')).toEqual({ kind: 'top', href: `${O}/site/examples/pulse.html` });
    expect(resolveChapterLink('https://github.com/verseva/design', O, 'distribute.html')).toEqual({ kind: 'top', href: 'https://github.com/verseva/design' });
  });

  it('redirects every legacy chapter URL to its studio route', () => {
    const v = JSON.parse(fs.readFileSync(path.join(repo, 'vercel.json'), 'utf8'));
    const map = Object.fromEntries(v.redirects.map((r: { source: string; destination: string }) => [r.source, r.destination]));
    for (const c of CHAPTERS) expect(map[`/${c.file}`]).toBe(`/${c.slug}`);
  });
});
