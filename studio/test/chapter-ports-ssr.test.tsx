// @vitest-environment node
// Ported chapters render on the server (ticket 9 pre-renders them): no window,
// document or storage during render, and the anchors are in the HTML.
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { NATIVE_CHAPTERS } from '../src/shell/routes';
import chapters from '../src/data/chapters.json';

describe('ported chapters on the server', () => {
  it('runs without a DOM', () => {
    expect(typeof window).toBe('undefined');
  });

  for (const c of chapters.filter((x) => NATIVE_CHAPTERS[x.slug])) {
    it(`${c.slug} renders to HTML with its h1 and every anchor`, () => {
      const Page = NATIVE_CHAPTERS[c.slug];
      const html = renderToString(<Page />);
      expect(html).toMatch(/<h1[^>]*>/);
      for (const s of c.sections) expect(html, s.id).toContain(`id="${s.id}"`);
    });
  }
});
