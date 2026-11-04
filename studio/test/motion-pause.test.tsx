// WCAG 2.2.2: the header's Pause motion control stops every auto-moving element on
// the site: CSS loops (marquee, beam, spinners, shimmer) on the page and in example
// frames, the smart stack's rotation, and the 3D stage (three.test.tsx).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { App } from '../src/App';
import { navigate } from '../src/shell/router';
import { setMotionPaused } from '../src/theme';
import { syncFrame } from '../src/front/frameSync';
import { DEFINITIONS } from '../src/widgets/WidgetsPage';

const html = () => document.documentElement;
const pauseSheet = (d: Document) => d.querySelector('style[data-vsv-pause]')?.textContent ?? '';

describe('Pause motion (WCAG 2.2.2)', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/'); localStorage.clear(); });
  afterEach(() => { act(() => setMotionPaused(false)); vi.useRealTimers(); });

  it('the header control marks the page paused and stops every CSS animation, then resumes', () => {
    const { getByRole } = render(<App />);
    const btn = getByRole('button', { name: 'Pause motion' });
    expect(html().dataset.motion).toBeUndefined();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(html().dataset.motion).toBe('paused');
    expect(pauseSheet(document)).toMatch(/\[data-motion="paused"\][^{]*\*[^{]*::before[^{]*::after[^{]*\{[^}]*animation:\s*none\s*!important/);
    fireEvent.click(btn);
    expect(html().dataset.motion).toBeUndefined();
  });

  it('example frames pause with the page, on load and on every toggle', () => {
    const f = document.createElement('iframe');
    document.body.appendChild(f);
    syncFrame(f);
    const d = f.contentDocument!;
    expect(d.documentElement.dataset.motion).toBeUndefined();
    act(() => setMotionPaused(true));
    syncFrame(f);
    expect(d.documentElement.dataset.motion).toBe('paused');
    expect(pauseSheet(d)).toMatch(/animation:\s*none\s*!important/);
    act(() => setMotionPaused(false));
    syncFrame(f);
    expect(d.documentElement.dataset.motion).toBeUndefined();
    f.remove();
  });

  it('a toggle reaches frames already on the page (the vsv-motion event)', () => {
    const seen: string[] = [];
    const on = () => seen.push(html().dataset.motion ?? 'running');
    window.addEventListener('vsv-motion', on);
    act(() => setMotionPaused(true));
    act(() => setMotionPaused(false));
    window.removeEventListener('vsv-motion', on);
    expect(seen).toEqual(['paused', 'running']);
  });

  it('the Live now smart stack stops rotating while motion is paused', () => {
    vi.useFakeTimers();
    const live = DEFINITIONS.find((d) => d.kind === 'live')!;
    const cur = (c: HTMLElement) => c.querySelector('.wstack-page[data-pos="cur"]')?.textContent;
    const { container } = render(<>{live.render('m', { editing: false } as never)}</>);
    const first = cur(container);
    act(() => setMotionPaused(true));
    act(() => { vi.advanceTimersByTime(7_000); });
    expect(cur(container)).toBe(first);
    act(() => setMotionPaused(false));
    act(() => { vi.advanceTimersByTime(6_000); });
    expect(cur(container)).not.toBe(first);
  });

  it('reduced motion keeps its behaviour: the control reads pressed and no page attribute is written', async () => {
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...mm(q), matches: q.includes('reduce') })) as typeof window.matchMedia;
    try {
      const { getByRole } = render(<App />);
      await act(async () => { navigate('/foundations'); });
      expect(getByRole('button', { name: 'Pause motion' }).getAttribute('aria-pressed')).toBe('true');
      expect(html().dataset.motion).toBeUndefined();
    } finally {
      window.matchMedia = mm;
    }
  });
});
