import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { FoundationsPage, SECTIONS } from '../src/foundations/FoundationsPage';
import tokens from '../src/data/tokens.json';

const size = (...families: string[]) => tokens.filter((t) => families.includes(t.family)).length;

const EXPECT: Record<string, number> = {
  color: size('canvas', 'accent'),
  status: size('status'),
  data: size('data'),
  material: size('material'),
  radius: size('radius', 'spacing', 'layout'),
  type: size('type'),
  motion: size('motion'),
};

function applyDark() {
  const root = document.documentElement;
  root.removeAttribute('style');
  for (const t of tokens) root.style.setProperty(t.name, t.dark);
}

async function flipTheme() {
  await act(async () => {
    window.dispatchEvent(new Event('vsv-theme'));
    await new Promise((r) => setTimeout(r, 60));
  });
}

describe('foundations page', () => {
  beforeEach(applyDark);

  it('renders every final section id as a section with an h2', () => {
    const { container } = render(<FoundationsPage />);
    for (const { id } of SECTIONS) {
      const el = container.querySelector(`section#${id}.section`);
      expect(el, id).not.toBeNull();
      expect(el!.querySelector('h2'), id).not.toBeNull();
    }
  });

  it('renders one specimen per token of each section family', () => {
    const { container } = render(<FoundationsPage />);
    for (const [id, n] of Object.entries(EXPECT)) {
      expect(n, id).toBeGreaterThan(0);
      expect(container.querySelectorAll(`#${id} [data-token]`).length, id).toBe(n);
    }
    expect(container.querySelectorAll('[data-token]').length).toBe(80);
  });

  it('draws one curve per ease token with a replay control', () => {
    const { container, getByRole } = render(<FoundationsPage />);
    const eases = tokens.filter((t) => t.name.startsWith('--ease-'));
    expect(eases).toHaveLength(6);
    expect(container.querySelectorAll('#motion svg path[data-ease]').length).toBe(6);
    expect(getByRole('button', { name: 'Replay' })).toBeTruthy();
  });

  it('reads token values live and re-reads on vsv-theme', async () => {
    const { container } = render(<FoundationsPage />);
    const bg = () => container.querySelector('[data-token="--bg"]')!.textContent;
    expect(bg()).toContain('#0B0D10');
    document.documentElement.style.setProperty('--bg', 'rgb(1, 2, 3)');
    await flipTheme();
    expect(bg()).toContain('rgb(1, 2, 3)');
  });

  it('tables every contrast pair with ratio, floor and a status badge', async () => {
    const { container } = render(<FoundationsPage />);
    const rows = container.querySelectorAll('#contrast tbody tr');
    expect(rows).toHaveLength(22);
    const first = rows[0].textContent!;
    expect(first).toContain('17.84');
    expect(first).toContain('4.5');
    expect(container.querySelectorAll('#contrast .badge.ok')).toHaveLength(22);
    document.documentElement.style.setProperty('--text-3', 'var(--bg)');
    await flipTheme();
    expect(container.querySelectorAll('#contrast .badge.err').length).toBeGreaterThan(0);
  });

  it('carries no explanatory prose and no em dash', () => {
    const { container } = render(<FoundationsPage />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
    expect(container.textContent).not.toContain(String.fromCharCode(0x2014));
  });
});
