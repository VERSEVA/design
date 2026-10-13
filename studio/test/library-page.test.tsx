// AssetLibraryPage on a fixture manifest: filters, detail dialog, loops.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react';

const spies = vi.hoisted(() => ({ download: vi.fn(() => Promise.resolve()) }));
vi.mock('../src/three/ThreeStage', () => ({
  ThreeStage: ({ src, label }: { src: string; label: string }) => <div data-testid="stage" data-src={src} role="img" aria-label={label} />,
}));
vi.mock('../src/three/thumbs', () => ({ useThemedThumb: (_id: string, _glb: string, baked: string) => baked }));
vi.mock('../src/three/exportThemed', () => ({ downloadThemed: spies.download }));

import { AssetLibraryPage, SECTIONS } from '../src/library/AssetLibraryPage';
import type { Library } from '../src/library/types';

const FAMILIES = ['Intelligence', 'Connection', 'Momentum', 'Protection', 'Composition', 'Signature forms'];
const COUNTS = [5, 5, 6, 5, 5, 4];
const REL = 'https://example.test/rel/';

function fixture(): Library {
  let n = 0;
  const objects = FAMILIES.flatMap((family, f) => Array.from({ length: COUNTS[f] }, () => {
    n++;
    const id = `VSV-${String(n).padStart(3, '0')}`;
    const name = `form-${n}`;
    return {
      id, name, title: `form ${n}`, family, edition: n <= 12 ? '01' : '02', uses: ['Growth', 'Aspiration'],
      glb: `/library/glb/${id}.glb`, thumb: `/library/thumb/${id}.webp`,
      downloads: { png: `${REL}${id}_${name}.png`, glb: `${REL}${id}_${name}.glb` },
    };
  }));
  const loops = Array.from({ length: 6 }, (_, i) => {
    const stem = `VSV-10${i}_loop-${i}__spin`;
    return {
      id: `VSV-10${i}`, name: `loop-${i}`, motion: 'spin', title: `loop ${i}, spin`, seconds: 4,
      glb: `/library/glb/${stem}.glb`, thumb: `/library/thumb/${stem}.webp`,
      downloads: { glb: `${REL}${stem}.glb`, webm: `${REL}${stem}.webm`, mp4: `${REL}${stem}.mp4`, poster: `${REL}${stem}.png` },
    };
  });
  return { tag: 'test', objects, loops } as Library;
}

const realMatch = window.matchMedia;
afterEach(() => { cleanup(); window.matchMedia = realMatch; });

const objectTiles = () => within(document.getElementById('objects')!).queryAllByRole('button', { name: /^Open form/ });

describe('AssetLibraryPage', () => {
  it('keeps the four section ids and renders each section', () => {
    expect(SECTIONS).toEqual([{ id: 'objects', label: '3D objects' }, { id: 'loops', label: 'Loops' }]);
    render(<AssetLibraryPage data={fixture()} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Asset Library');
    for (const s of SECTIONS) expect(document.getElementById(s.id)).not.toBeNull();
  });

  it('filters objects by family and edition', () => {
    render(<AssetLibraryPage data={fixture()} />);
    expect(objectTiles()).toHaveLength(30);
    const momentum = screen.getByRole('button', { name: /^Momentum/ });
    expect(momentum.textContent).toContain('6');
    fireEvent.click(momentum);
    expect(momentum.getAttribute('aria-pressed')).toBe('true');
    expect(objectTiles()).toHaveLength(6);
    fireEvent.click(within(document.getElementById('objects')!).getByRole('button', { name: /^All/ }));
    fireEvent.click(screen.getByRole('tab', { name: '02' }));
    expect(objectTiles()).toHaveLength(18);
  });

  it('gives every image alt text from its title', () => {
    render(<AssetLibraryPage data={fixture()} />);
    const imgs = document.querySelectorAll('img');
    expect(imgs.length).toBeGreaterThan(0);
    imgs.forEach((img) => expect(img.getAttribute('alt')).toBeTruthy());
    expect(screen.getByAltText('form 1')).not.toBeNull();
  });

  it('opens object detail in a modal with a live stage, family, uses and downloads; traps focus; Escape closes', async () => {
    render(<AssetLibraryPage data={fixture()} />);
    const tile = objectTiles()[0];
    tile.focus();
    fireEvent.click(tile);
    const dialog = screen.getByRole('dialog', { name: 'form 1' });
    expect(dialog.classList.contains('modal')).toBe(true);
    expect(within(dialog).getByTestId('stage').getAttribute('data-src')).toBe('/library/glb/VSV-001.glb');
    expect(within(dialog).getByText('Intelligence')).not.toBeNull();
    expect(within(dialog).getByText('Growth')).not.toBeNull();
    expect(within(dialog).getByRole('link', { name: /PNG/ }).getAttribute('href')).toBe(`${REL}VSV-001_form-1.png`);
    expect(within(dialog).getByRole('link', { name: /^GLB/ }).getAttribute('href')).toBe(`${REL}VSV-001_form-1.glb`);
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'GLB in this theme' })); });
    expect(spies.download).toHaveBeenCalledWith(expect.objectContaining({ id: 'VSV-001', name: 'form-1' }), expect.anything());

    const focusables = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(focusables[0]);
    focusables[0].focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(tile);
  });

  it('uses the sheet on a phone', () => {
    window.matchMedia = ((q: string) => ({ ...realMatch(q), matches: q.includes('max-width') })) as typeof window.matchMedia;
    render(<AssetLibraryPage data={fixture()} />);
    fireEvent.click(objectTiles()[0]);
    expect(screen.getByRole('dialog').classList.contains('sheet')).toBe(true);
  });

  it('renders 6 loop stages with WebM, MP4 and GLB downloads', () => {
    render(<AssetLibraryPage data={fixture()} />);
    const loops = document.getElementById('loops')!;
    expect(within(loops).getAllByTestId('stage')).toHaveLength(6);
    expect(within(loops).getAllByRole('link', { name: /WebM/ })).toHaveLength(6);
    expect(within(loops).getAllByRole('link', { name: /MP4/ })).toHaveLength(6);
    expect(within(loops).getAllByRole('link', { name: /GLB/ })).toHaveLength(6);
  });

  it('renders no photography or video section', () => {
    render(<AssetLibraryPage data={fixture()} />);
    expect(document.getElementById('photography')).toBeNull();
    expect(document.getElementById('video')).toBeNull();
    expect(document.querySelector('video')).toBeNull();
  });
});
