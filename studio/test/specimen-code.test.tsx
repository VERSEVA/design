// The code samples of a from-source chapter (scripts/chapter-code.mjs FROM_SOURCE): generated from
// its own specimens as rendered and drawn by its chapter script, and held byte for byte, so a sample
// can never drift from what renders. VSV_WRITE_CODE=1 npx vitest run test/specimen-code.test.tsx
// rewrites the committed file after a specimen changes.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { specimenCode } from '../src/chapters/specimenCode';
import { Page as DataViz, SAMPLED } from '../src/chapters/pages/data-viz';
import { FROM_SOURCE, format } from '../scripts/chapter-code.mjs';

const pages = path.resolve(__dirname, '../src/chapters/pages');
const CHAPTERS: Record<string, { Page: () => React.ReactElement; sampled: string[] }> = { 'data-viz': { Page: DataViz, sampled: SAMPLED } };

describe('from-source code samples', () => {
  it('covers every from-source chapter', () => {
    expect(Object.keys(CHAPTERS).sort()).toEqual([...FROM_SOURCE].sort());
  });

  it.each(Object.keys(CHAPTERS))('%s.code.json is its specimens as drawn, byte for byte', (slug) => {
    const { Page, sampled } = CHAPTERS[slug];
    const { container } = render(<Page />);
    const tiles = [...container.querySelectorAll('section.stile')].filter((t) => t.querySelector('.specimen'));
    expect(tiles.map((t) => t.id)).toEqual(sampled);
    const text = format(tiles.map((t) => specimenCode(t.querySelector('.specimen')!)));
    const file = path.join(pages, `${slug}.code.json`);
    if (process.env.VSV_WRITE_CODE === '1') fs.writeFileSync(file, text);
    expect(text).toBe(fs.readFileSync(file, 'utf8'));
  });

  it('writes one element a line at two spaces a level, text-only elements on one line', () => {
    const div = document.createElement('div');
    div.innerHTML = '<div class="a" hidden><b>x &amp; "y"</b><i style="width: 4%"></i>t<input value="q"></div>';
    expect(specimenCode(div)).toBe('<div class="a" hidden>\n  <b>x &amp; "y"</b>\n  <i style="width: 4%"></i>\n  t\n  <input value="q">\n</div>');
  });
});
