import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { FrontDoorPage } from '../src/front/FrontDoorPage';
import { applyTheme } from '../src/theme';

vi.mock('../src/three/ThreeStage', () => ({
  ThreeStage: (p: { src: string; label: string; loop?: boolean; thumb?: string }) => (
    <div className="stage-mock" data-src={p.src} data-thumb={p.thumb} data-loop={String(!!p.loop)} aria-label={p.label} />
  ),
}));

describe('front door', () => {
  beforeEach(() => { localStorage.clear(); applyTheme({ brand: '', mode: 'dark' }); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('holds the hero picker with five chips', () => {
    render(<FrontDoorPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('One source. Every surface');
    const group = screen.getByRole('group', { name: 'Theme' });
    expect(group.classList.contains('picker-lg')).toBe(true);
    expect(group.querySelectorAll('button.fchip')).toHaveLength(5);
  });

  it('picking Cobalt sets data-brand', () => {
    render(<FrontDoorPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Cobalt' }));
    expect(document.documentElement.dataset.brand).toBe('cobalt');
  });

  it('shows the readout with an AA or Fail badge', () => {
    const { container } = render(<FrontDoorPage />);
    const read = container.querySelector('.readout')!;
    expect(read.textContent).toContain('--accent');
    expect(read.textContent).toContain('ink on accent');
    expect(read.textContent).toContain('text on bg');
    expect(['AA', 'Fail']).toContain(read.querySelector('.badge.ok, .badge.err')?.textContent);
  });

  it('keeps frames inert behind a single cover link each', () => {
    const { container } = render(<FrontDoorPage />);
    const frames = [...container.querySelectorAll('iframe')];
    expect(frames.map((f) => f.getAttribute('src'))).toEqual(['/examples/pulse.html', '/examples/launch.html']);
    for (const f of frames) {
      const wrap = f.parentElement!;
      expect(wrap.hasAttribute('inert')).toBe(true);
      const tile = wrap.parentElement!;
      const links = tile.querySelectorAll('a');
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute('href')).toBe(f.getAttribute('src'));
    }
  });

  it('stages the three library objects with glb, thumb and loop', () => {
    const { container } = render(<FrontDoorPage />);
    const st = [...container.querySelectorAll('.stage-mock')].map((e) => [e.getAttribute('data-src'), e.getAttribute('data-thumb'), e.getAttribute('data-loop')]);
    expect(st).toEqual([
      ['/library/glb/VSV-016_partnership-links__linked-sway.glb', '/library/thumb/VSV-016_partnership-links__linked-sway.webp', 'true'],
      ['/library/glb/VSV-001.glb', '/library/thumb/VSV-001.webp', 'false'],
      ['/library/glb/VSV-019.glb', '/library/thumb/VSV-019.webp', 'false'],
    ]);
  });

  it('lists six live tokens and one pair', () => {
    const { container } = render(<FrontDoorPage />);
    const tok = container.querySelector('.tok')!;
    expect([...tok.querySelectorAll('code')].map((c) => c.textContent)).toEqual(['--bg', '--surface', '--text-1', '--text-2', '--accent', '--data-alt']);
    expect(tok.querySelector('.pair')?.textContent).toContain('--text-2 / --surface');
  });

  it('tags tiles with badges', () => {
    const { container } = render(<FrontDoorPage />);
    expect(container.querySelectorAll('.stage .badge.tag')).toHaveLength(7);
  });

  it('renders the counts row', () => {
    const { container } = render(<FrontDoorPage />);
    const labels = [...container.querySelectorAll('.statrow .stat .lbl')].map((l) => l.textContent);
    expect(labels).toEqual(['Tokens', 'Themes', '3D objects', 'Loops', 'Gates']);
    container.querySelectorAll('.statrow .num').forEach((n) => expect(n.textContent).toMatch(/^\d+$/));
  });

  it('copy announces then reverts after 2 s', () => {
    vi.useFakeTimers();
    const { container } = render(<FrontDoorPage />);
    expect(container.querySelector('.install code')?.textContent).toBe('npm i @verseva/design');
    const btn = screen.getByRole('button', { name: 'Copy' });
    expect(btn.className).toContain('btn-secondary');
    const live = container.querySelector('[aria-live="polite"]')!;
    fireEvent.click(btn);
    expect(btn.textContent).toBe('Copied');
    expect(live.textContent).toBe('Copied');
    act(() => { vi.advanceTimersByTime(2000); });
    expect(btn.textContent).toBe('Copy');
    expect(live.textContent).toBe('');
  });
});
