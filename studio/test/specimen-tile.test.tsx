// The studio specimen tile contract (1.7.0): anatomy, sizes, states and code panels,
// on the tile itself and on the pages built from it (Components, Foundations). The
// Components tiles replace the retired element-for-element parity with site/components.html
// (test/redesigned.ts); the specimens inside them are still held to their generated samples.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { SpecimenGrid, SpecimenTile, LABELS, type TileSize } from '../src/tiles/SpecimenTile';
import { Page as Components, SAMPLED, INSTALL } from '../src/chapters/pages/components';
import CODE from '../src/chapters/pages/components.code.json';
import { FoundationsPage } from '../src/foundations/FoundationsPage';
import { tokenCss, tokensOf } from '../src/foundations/Specimen';
import { jumpTo } from '../src/shell/router';
import chapters from '../src/data/chapters.json';

const repo = path.resolve(__dirname, '../..');
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const TILES_CSS = strip(fs.readFileSync(path.join(repo, 'studio/src/tiles/tiles.css'), 'utf8'));
const PACKAGE_CSS = strip(fs.readFileSync(path.join(repo, 'components.css'), 'utf8'));
const ICON = <svg aria-hidden="true"><path d="M4 4h16" /></svg>;
const tile = (c: HTMLElement) => c.querySelector<HTMLElement>('section.stile')!;
const toggle = (t: Element) => t.querySelector<HTMLButtonElement>('.stile-toggle')!;

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('SpecimenTile anatomy', () => {
  it('is a .wtile in the /widgets anatomy: header (icon, name, meta), specimen body, code footer', () => {
    const { container } = render(<SpecimenTile id="button" name="Button" icon={ICON} meta="8 variants" code="<b>x</b>"><button type="button">Go</button></SpecimenTile>);
    const t = tile(container);
    expect(t.id).toBe('button');
    expect([...t.classList]).toEqual(['wtile', 'stile']);
    const body = t.querySelector(':scope > .wtile-body')!;
    expect([...body.children].map((c) => c.className)).toEqual(['wtile-hd', 'stile-spec', 'wtile-foot stile-foot']);
    const hd = body.querySelector('.wtile-hd')!;
    expect([...hd.children].map((c) => c.localName + (c.getAttribute('class') ? '.' + c.getAttribute('class')!.split(' ')[0] : ''))).toEqual(['svg', 'h2.stile-name', 'span.wtile-meta']);
    expect(hd.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(hd.querySelector('h2')!.textContent).toBe('Button');
    expect(hd.querySelector('.wtile-meta')!.textContent).toBe('8 variants');
    expect(t.querySelector('.stile-spec button')!.textContent).toBe('Go');
  });

  it('names at h3 under a page section, and drops the meta and the footer it is not given', () => {
    const { container } = render(<SpecimenTile name="Radius" level={3}>x</SpecimenTile>);
    const t = tile(container);
    expect(t.querySelector('.wtile-hd h3.stile-name')!.textContent).toBe('Radius');
    expect(t.querySelector('h2, .wtile-meta, .wtile-foot, .stile-code')).toBeNull();
  });

  it('keeps data-focus by default, and drops it with focus={false} so the package recolours its charts (law 3)', () => {
    const { container, rerender } = render(<SpecimenTile name="A">x</SpecimenTile>);
    expect(tile(container).hasAttribute('data-focus')).toBe(true);
    rerender(<SpecimenTile name="A" focus={false}>x</SpecimenTile>);
    expect(tile(container).hasAttribute('data-focus')).toBe(false);
  });

  it('puts extra actions in the footer before Show code', () => {
    const { container } = render(<SpecimenTile name="Curves" code="c" actions={<button type="button">Replay</button>}>x</SpecimenTile>);
    expect([...tile(container).querySelectorAll('.wtile-foot button')].map((b) => b.textContent)).toEqual(['Replay', LABELS.show]);
  });
});

describe('SpecimenTile sizes', () => {
  it('writes S, M, L and XL as data-size, M by default', () => {
    const { container } = render(
      <SpecimenGrid>
        <SpecimenTile name="a">x</SpecimenTile>
        {(['s', 'm', 'l', 'xl'] as TileSize[]).map((s) => <SpecimenTile key={s} name={s} size={s}>x</SpecimenTile>)}
      </SpecimenGrid>,
    );
    const grid = container.querySelector('.wgrid.sgrid')!;
    expect([...grid.children].map((t) => t.getAttribute('data-size'))).toEqual(['m', 's', 'm', 'l', 'xl']);
  });

  it('spans the package grid: 4 columns, XL drops to the M span under 1100px and every tile to one column under 560px', () => {
    for (const rule of ['.wtile[data-size="s"]{grid-column:span 1;grid-row:span 1}', '.wtile[data-size="m"]{grid-column:span 2;grid-row:span 1}', '.wtile[data-size="l"]{grid-column:span 2;grid-row:span 2}', '.wtile[data-size="xl"]{grid-column:span 4;grid-row:span 2}']) {
      expect(PACKAGE_CSS, rule).toContain(rule);
    }
    expect(PACKAGE_CSS).toContain('@media (max-width:1099.98px){.wgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.wtile[data-size="xl"]{grid-column:span 2}}');
    expect(PACKAGE_CSS).toContain('@media (max-width:559.98px){.wgrid{grid-template-columns:minmax(0,1fr);gap:var(--s-3)}.wtile[data-size]{grid-column:span 1;grid-row:span 1}');
  });

  it('sizes rows to the specimens, with XL on one row', () => {
    expect(TILES_CSS).toMatch(/\.wgrid\.sgrid \{ grid-auto-rows: auto; \}/);
    expect(TILES_CSS).toMatch(/\.sgrid > \.stile\[data-size="xl"\] \{ grid-row: span 1; \}/);
  });
});

describe('SpecimenTile code panel', () => {
  const sample = '<div class="x">\n  <b>"quoted" &amp; spaced  </b>\n</div>\n';

  it('shows the sample byte for byte behind Show code, with Copy only while open', () => {
    const { container } = render(<SpecimenTile id="t" name="T" code={sample}>x</SpecimenTile>);
    const t = tile(container);
    const btn = toggle(t);
    expect([btn.textContent, btn.getAttribute('aria-expanded'), t.querySelector('.stile-code'), t.querySelector('.stile-copy')]).toEqual([LABELS.show, 'false', null, null]);
    fireEvent.click(btn);
    const pre = t.querySelector<HTMLPreElement>('pre.stile-code')!;
    expect(pre.querySelector('code')!.textContent).toBe(sample);
    expect([btn.textContent, btn.getAttribute('aria-expanded'), btn.getAttribute('aria-controls'), pre.id, pre.tabIndex]).toEqual([LABELS.hide, 'true', 't-code', 't-code', 0]);
    expect(t.querySelector('.stile-copy')!.textContent).toBe(LABELS.copy);
    fireEvent.click(btn);
    expect([t.querySelector('.stile-code'), t.querySelector('.stile-copy')]).toEqual([null, null]);
  });

  it('loads a sample on first intent: hover starts it, the panel shows a skeleton, then the text', async () => {
    let resolve!: (t: string) => void;
    const loader = vi.fn(() => new Promise<string>((r) => { resolve = r; }));
    const { container } = render(<SpecimenTile id="t" name="T" code={loader}>x</SpecimenTile>);
    const t = tile(container);
    fireEvent.pointerEnter(toggle(t));
    fireEvent.focus(toggle(t));
    expect(loader).toHaveBeenCalledTimes(1);
    fireEvent.click(toggle(t));
    expect(loader).toHaveBeenCalledTimes(1);
    expect([t.querySelector('.stile-code-wait[aria-busy="true"] .skel'), t.querySelector('pre'), t.querySelector('.stile-copy')].map(Boolean)).toEqual([true, false, false]);
    await act(async () => { resolve(sample); });
    expect(t.querySelector('pre.stile-code code')!.textContent).toBe(sample);
    expect(t.querySelector('.stile-code-wait')).toBeNull();
    expect(t.querySelector('.stile-copy')).not.toBeNull();
  });

  it('says when a loaded sample fails, and Retry loads it again', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(sample);
    const { container } = render(<SpecimenTile name="T" code={loader}>x</SpecimenTile>);
    const t = tile(container);
    await act(async () => { fireEvent.click(toggle(t)); });
    const err = t.querySelector('.stile-code-err[role="alert"]')!;
    expect(err.textContent).toContain(LABELS.codeError);
    await act(async () => { fireEvent.click(err.querySelector('button')!); });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(t.querySelector('pre.stile-code code')!.textContent).toBe(sample);
  });

  it('copies the exact sample, says so, then settles back', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { container } = render(<SpecimenTile name="T" code={sample}>x</SpecimenTile>);
    fireEvent.click(toggle(tile(container)));
    const copy = tile(container).querySelector<HTMLButtonElement>('.stile-copy')!;
    await act(async () => { fireEvent.click(copy); });
    expect(writeText).toHaveBeenCalledWith(sample);
    expect(copy.textContent).toBe(LABELS.copied);
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(copy.textContent).toBe(LABELS.copy);
  });

  it('selects the sample when the clipboard refuses, and clears its timer on unmount', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
    const { container, unmount } = render(<SpecimenTile name="T" code={sample}>x</SpecimenTile>);
    fireEvent.click(toggle(tile(container)));
    const copy = tile(container).querySelector<HTMLButtonElement>('.stile-copy')!;
    await act(async () => { fireEvent.click(copy); });
    expect(copy.textContent).toBe(LABELS.copyFailed);
    expect(window.getSelection()!.toString()).toBe(sample);
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});

describe('SpecimenTile states', () => {
  it('loading: aria-busy, the skeleton in place of the specimen, no footer', () => {
    const { container } = render(<SpecimenTile name="T" code="c" status={{ loading: true, error: 'x', empty: 'y' }}><i className="live" /></SpecimenTile>);
    const t = tile(container);
    expect([t.getAttribute('aria-busy'), t.dataset.state]).toEqual(['true', 'loading']);
    expect(t.querySelector('.stile-spec .wtile-skel[aria-hidden="true"] .skel')).not.toBeNull();
    expect(t.querySelector('.live, .wtile-foot, .wtile-err')).toBeNull();
  });

  it('error: the message as an alert, with Retry only when it can retry', () => {
    const onRetry = vi.fn();
    const { container, rerender } = render(<SpecimenTile name="T" code="c" status={{ error: 'Tokens did not load.' }} onRetry={onRetry}><i className="live" /></SpecimenTile>);
    const err = tile(container).querySelector('.wtile-err[role="alert"]')!;
    expect(err.querySelector('.wtile-errline')!.textContent).toBe('Tokens did not load.');
    fireEvent.click(err.querySelector('button')!);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(tile(container).querySelector('.live, .wtile-foot')).toBeNull();
    rerender(<SpecimenTile name="T" status={{ error: 'Tokens did not load.' }}>x</SpecimenTile>);
    expect(tile(container).querySelector('.wtile-err button')).toBeNull();
  });

  it('empty: the label in place of the specimen', () => {
    const { container } = render(<SpecimenTile name="T" status={{ empty: 'No tokens' }}><i className="live" /></SpecimenTile>);
    const t = tile(container);
    expect([t.dataset.state, t.querySelector('.stile-empty')!.textContent, t.querySelector('.live')]).toEqual(['empty', 'No tokens', null]);
  });

  it('hover and focus-visible: the package tile states, a keyboard landing on a deep link, and a visible ring on the code scroller', () => {
    expect(PACKAGE_CSS).toContain('.wtile:hover{border-color:var(--hairline-strong)}');
    expect(PACKAGE_CSS).toContain('.wtile:focus-visible{outline:2px solid var(--focus);outline-offset:2px}');
    expect(TILES_CSS).toMatch(/\.stile-code:focus-visible \{ outline: 2px solid var\(--focus\);/);
    const { container } = render(<SpecimenTile id="t" name="T">x</SpecimenTile>);
    jumpTo(tile(container), 'auto');
    expect(document.activeElement).toBe(tile(container));
  });
});

describe('tiles.css', () => {
  it('spends no accent: counts, meta and chrome stay neutral (law 3)', () => {
    expect(TILES_CSS).not.toMatch(/accent/);
  });

  it('animates transform and opacity only, and only without reduced motion', () => {
    const frames = [...TILES_CSS.matchAll(/@keyframes [\w-]+ \{([\s\S]*?\})\s*\}/g)].map((m) => m[1]);
    expect(frames.length).toBeGreaterThan(0);
    for (const f of frames) for (const [, prop] of f.matchAll(/([\w-]+):/g)) expect(['opacity', 'transform']).toContain(prop);
    const animated = TILES_CSS.replace(/@media \(prefers-reduced-motion: no-preference\) \{[^{}]*\{[^{}]*\}\s*\}/g, '');
    expect(animated).not.toMatch(/animation:|transition:/);
  });
});

describe('Components as tiles', () => {
  const comp = chapters.find((c) => c.slug === 'components')!;

  it('renders every section as a tile in one bento grid, in rail order, each named by its h2 (the rail drops a " · variant" suffix)', () => {
    const { container } = render(<Components />);
    const tiles = [...container.querySelectorAll<HTMLElement>('.chap .wgrid.sgrid > section.stile')];
    expect(tiles.length).toBe(50);
    expect(tiles.map((t) => t.id)).toEqual(comp.sections.map((s) => s.id));
    expect(tiles.map((t) => t.querySelector(':scope > .wtile-body > .wtile-hd > h2.stile-name')!.textContent!.split(' · ')[0])).toEqual(comp.sections.map((s) => s.label));
    expect(container.querySelectorAll('.chap h2').length).toBe(50);
  });

  it('sizes each tile to its content: button rows M, tables and consoles XL', () => {
    const { container } = render(<Components />);
    const size = (id: string) => container.querySelector(`#${id}`)!.getAttribute('data-size');
    expect(size('button')).toBe('m');
    for (const id of ['table', 'table-pin', 'bulk', 'shell', 'shell-rail', 'topbar', 'notifications', 'whatsnew']) expect(size(id), id).toBe('xl');
    for (const t of container.querySelectorAll('section.stile')) expect(['s', 'm', 'l', 'xl'], t.id).toContain(t.getAttribute('data-size'));
  });

  it('maps every generated sample to its tile, in page order', () => {
    const { container } = render(<Components />);
    expect(SAMPLED).toEqual([...container.querySelectorAll('section.stile')].filter((t) => t.querySelector('.specimen')).map((t) => t.id));
    expect(SAMPLED.length).toBe(CODE.length);
  });

  it('opens every tile\'s code as its generated sample, byte for byte (Install shows its commands)', async () => {
    const { container } = render(<Components />);
    for (const t of container.querySelectorAll<HTMLElement>('section.stile')) {
      fireEvent.click(toggle(t));
      await waitFor(() => expect(t.querySelector('.stile-code code'), t.id).not.toBeNull());
      const want = t.id === 'install' ? INSTALL : CODE[SAMPLED.indexOf(t.id)];
      expect(t.querySelector('.stile-code code')!.textContent, t.id).toBe(want);
      fireEvent.click(toggle(t));
    }
  });

  it('keeps counts in the header meta neutral and carries no em dash', () => {
    const { container } = render(<Components />);
    for (const m of container.querySelectorAll('.wtile-meta')) expect(m.textContent).toMatch(/^\d+ (variants|states|chips)$/);
    expect(container.querySelector('.chap')!.textContent).not.toContain(String.fromCharCode(0x2014));
  });
});

describe('Foundations as tiles', () => {
  it('puts every token family in a tile under its section, with a count and its declarations as code', () => {
    const { container } = render(<FoundationsPage />);
    const names = [...container.querySelectorAll('section.section > .wgrid.sgrid > section.stile h3.stile-name')].map((h) => h.textContent);
    expect(names).toEqual(['Canvas and text', 'Accent', 'Status', 'Data', 'Material and elevation', 'Radius', 'Spacing', 'Layout', 'Type', 'Duration', 'Motion curves', 'Pairs']);
    const canvas = [...container.querySelectorAll<HTMLElement>('section.stile')][0];
    expect(canvas.querySelector('.wtile-meta')!.textContent).toBe(`${tokensOf('canvas').length} tokens`);
    fireEvent.click(toggle(canvas));
    expect(canvas.querySelector('.stile-code code')!.textContent).toBe(tokenCss(tokensOf('canvas')));
  });

  it('writes declarations as tokens.css does: :root, then the light flip for what changes', () => {
    const list = [{ name: '--a', family: 'x', dark: '1px', light: '1px', brands: {} }, { name: '--b', family: 'x', dark: 'red', light: 'blue', brands: {} }];
    expect(tokenCss(list)).toBe(':root {\n  --a: 1px;\n  --b: red;\n}\n[data-theme="light"] {\n  --b: blue;\n}');
    expect(tokenCss(list.slice(0, 1))).toBe(':root {\n  --a: 1px;\n}');
  });
});
