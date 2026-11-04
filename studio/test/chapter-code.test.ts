// @vitest-environment node
// The generated code samples: each pages/<slug>.code.json is exactly what
// scripts/chapter-code.mjs makes from the frozen page today, so a stale file
// cannot ship, and the generator stops on any error the legacy script throws.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import chapters from '../src/data/chapters.json';
import { chapterCode, format, ALLOWED_JSDOM_ERRORS, FROM_SOURCE } from '../scripts/chapter-code.mjs';

const repo = path.resolve(__dirname, '../..');
const pages = path.join(repo, 'studio/src/chapters/pages');
const generated = fs.readdirSync(pages).filter((f) => f.endsWith('.code.json')).map((f) => f.replace(/\.code\.json$/, '')).filter((slug) => !FROM_SOURCE.includes(slug));

describe('generated chapter code samples', () => {
  it('has at least one generated file', () => {
    expect(generated.length).toBeGreaterThan(0);
  });

  it('generates every from-source chapter elsewhere (specimen-code.test.tsx), and gives it no jsdom allowlist', () => {
    for (const slug of FROM_SOURCE) {
      expect(fs.existsSync(path.join(pages, `${slug}.code.json`)), slug).toBe(true);
      expect(ALLOWED_JSDOM_ERRORS[slug], slug).toBeUndefined();
    }
  });

  it.each(generated)('%s.code.json is what the generator writes from its frozen page', (slug) => {
    const file = chapters.find((c) => c.slug === slug)?.file ?? `${slug}.html`;
    const html = fs.readFileSync(path.join(repo, 'site', file), 'utf8');
    expect(format(chapterCode(html, ALLOWED_JSDOM_ERRORS[slug]))).toBe(fs.readFileSync(path.join(pages, `${slug}.code.json`), 'utf8'));
  });

  it.each(generated)('%s has a written jsdom allowlist', (slug) => {
    expect(Array.isArray(ALLOWED_JSDOM_ERRORS[slug])).toBe(true);
  });
});

describe('chapter-code on legacy script errors', () => {
  const page = (js: string) => `<!doctype html><div class="comp"><div class="specimen"><b>x</b></div><div class="codewrap"><code></code></div></div><script>${js}</script>`;

  it('throws on an uncaught error in the legacy script', () => {
    expect(() => chapterCode(page('noSuchFunction();'), [])).toThrow(/noSuchFunction/);
  });

  it('throws on a jsdom "Not implemented" the page does not allow', () => {
    expect(() => chapterCode(page('window.scrollTo(0, 0);'), [])).toThrow(/Not implemented: window\.scrollTo/);
  });

  it('passes only the exact allowlisted message', () => {
    expect(chapterCode(page('window.scrollTo(0, 0);'), ['Not implemented: window.scrollTo'])).toEqual(['']);
    expect(() => chapterCode(page('window.scrollTo(0, 0); window.alert("x");'), ['Not implemented: window.scrollTo'])).toThrow(/window\.alert/);
  });
});
