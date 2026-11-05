import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import fs from 'node:fs';
import path from 'node:path';
import { App } from '../src/App';
import { navigate } from '../src/shell/router';
import { wait } from '../src/widgets/WidgetsPage';

// jsdom has no layout: matchMedia matches nothing, so grids run at one column (the phone view).
const grid = (c: HTMLElement, name: string) => c.querySelector<HTMLElement>(`.wgrid[aria-label="${name}"]`)!;
const tiles = (g: HTMLElement) => [...g.querySelectorAll<HTMLElement>('.wtile')];

describe('/widgets', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/'); localStorage.clear(); });

  async function open() {
    const r = render(<App />);
    await act(async () => { navigate('/widgets'); });
    return r;
  }

  it('is in the sidebar and renders the three sections', async () => {
    const { container } = await open();
    expect(container.querySelector('.studio-side a[href="/widgets"]')?.getAttribute('aria-current')).toBe('page');
    expect(container.querySelector('h1')?.textContent).toBe('Widgets');
    expect([...container.querySelectorAll('.studio-main h2')].map((h) => h.firstChild?.textContent?.trim())).toEqual(['Home', 'Sizes', 'States']);
  });

  it('home: six widgets, one focus widget (the only one allowed the accent), the stack, the capsule slot beside the bell', async () => {
    const { container } = await open();
    const home = grid(container, 'Home widgets');
    expect(tiles(home).map((t) => t.dataset.id)).toEqual(['live', 'revenue', 'tasks', 'runway', 'week', 'pipeline']);
    expect([...home.querySelectorAll('[data-focus]')].map((t) => (t as HTMLElement).dataset.id)).toEqual(['revenue']);
    expect(home.querySelector('.wstack')).not.toBeNull();
    const bar = container.querySelector('.wx-console .tbar')!;
    expect(bar.querySelector(':scope > .searchbox')).not.toBeNull();
    expect(bar.querySelector('.tbar-end .lact-wrap + .menu .ibtn, .tbar-end .lact-wrap ~ * .ibtn')?.getAttribute('aria-label')).toMatch(/^Notifications/);
  });

  it('sizes: revenue at S, M, L and XL; at one column L and XL show the M view', async () => {
    const { container } = await open();
    const sizes = tiles(grid(container, 'Revenue sizes'));
    expect(sizes.map((t) => t.dataset.id)).toEqual(['rev-s', 'rev-m', 'rev-l', 'rev-xl']);
    expect(sizes.map((t) => t.dataset.size)).toEqual(['s', 'm', 'm', 'm']);
  });

  it('edit mode from the Edit button: remove, Undo, Esc leaves', async () => {
    const { container, getByRole } = await open();
    const home = grid(container, 'Home widgets');
    const edit = within(container.querySelector('.wx-head') as HTMLElement).getByRole('button', { name: 'Edit' });
    fireEvent.click(edit);
    expect(edit.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(getByRole('button', { name: 'Remove Tasks' }));
    expect(tiles(home).map((t) => t.dataset.id)).not.toContain('tasks');
    fireEvent.click(getByRole('button', { name: 'Undo' }));
    expect(tiles(home).map((t) => t.dataset.id)).toContain('tasks');
    fireEvent.keyDown(home, { key: 'Escape' });
    expect(edit.getAttribute('aria-pressed')).toBe('false');
  });

  it('demo job: Start shows the capsule, Cancel removes the job', async () => {
    const { container, getByRole } = await open();
    const end = container.querySelector('.wx-console .tbar-end') as HTMLElement;
    expect(end.querySelector<HTMLElement>('.lact-wrap')?.hidden).toBe(true);
    fireEvent.click(getByRole('button', { name: 'Start job' }));
    const wrap = end.querySelector<HTMLElement>('.lact-wrap')!;
    expect(wrap.hidden).toBe(false);
    fireEvent.click(end.querySelector('.lact')!);
    fireEvent.click(within(wrap).getByRole('button', { name: 'Cancel' }));
    expect(end.querySelectorAll('.lact-item')).toHaveLength(0);
  });

  it('ask: the answer streams, then Pin to Home puts the revenue widget first on Home', async () => {
    const { container, getByRole } = await open();
    fireEvent.click(getByRole('button', { name: 'Search or ask' }));
    /* the bar is its own chunk, loaded on first open */
    const input = await waitFor(() => { const el = container.querySelector<HTMLInputElement>('.cmdk-input'); if (!el) throw new Error('bar did not open'); return el; }, { timeout: 5000 });
    /* The bar's open effect resets the answer and focuses the field: let it run before asking, or it
       can land after Enter and wipe the answer. */
    await waitFor(() => expect(document.activeElement).toBe(input));
    /* The answer streams on timers (700ms, then 60ms a word): drive them on a fake clock, not the wall clock.
       Fake only the timers: React's scheduler runs on setImmediate in jsdom, and faking that stalls effects. */
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    try {
      fireEvent.change(input, { target: { value: 'what was revenue this month?' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      const pin = getByRole('button', { name: 'Pin to Home' });
      expect(container.querySelector('.cmdk-a')?.textContent).toContain('₱1.84M');
      fireEvent.click(pin);
      const home = tiles(grid(container, 'Home widgets'));
      expect(home).toHaveLength(7);
      expect(home[0].getAttribute('aria-label')).toBe('Revenue, medium');
    } finally {
      vi.useRealTimers();
    }
  }, 15000);

  it('states: loading, error with Retry, empty grid, five activity rows, three bar states', async () => {
    const { container, getByRole } = await open();
    const le = tiles(grid(container, 'Loading and error widgets'));
    expect(le[0].getAttribute('aria-busy')).toBe('true');
    expect(within(le[1]).getByRole('alert').textContent).toContain('Revenue did not load.');
    expect(within(le[1]).getByRole('button', { name: 'Retry' })).toBeTruthy();
    const empty = grid(container, 'Empty widgets');
    expect(empty.querySelector('.wgrid-empty')?.textContent).toContain('No widgets');
    const rows = [...container.querySelectorAll<HTMLElement>('.wx-bars .tbar')];
    expect(rows.map((r) => r.querySelector('[aria-current="page"]')?.textContent)).toEqual(['Starting', 'Running', 'Done', 'Failed', 'Empty']);
    expect(rows.map((r) => r.querySelector('.lact')?.getAttribute('data-state') ?? null)).toEqual(['pending', 'running', 'done', 'error', 'empty']);
    expect(rows.map((r) => r.querySelector<HTMLElement>('.lact-wrap')!.hidden)).toEqual([false, false, false, false, true]);
    for (const name of ['No results', 'Loading', 'Error']) expect(getByRole('button', { name })).toBeTruthy();
  });

  it('home: the console specimen carries the .navshell phone nav, shown below 900px (spec: Phone)', async () => {
    const { container } = await open();
    const nav = container.querySelector<HTMLElement>('.wx-console > .navshell')!;
    expect(nav, 'no .navshell in the console specimen').not.toBeNull();
    expect(nav.tagName).toBe('NAV');
    expect(nav.previousElementSibling?.classList.contains('wx-body')).toBe(true);
    const tabs = [...nav.querySelectorAll<HTMLButtonElement>('.navmain > button.tab')];
    expect(tabs.map((t) => t.textContent)).toEqual(['Home', 'Quotes', 'Trends', 'You']);
    expect(tabs.filter((t) => t.classList.contains('on')).map((t) => t.getAttribute('aria-current'))).toEqual(['page']);
    fireEvent.click(tabs[1]);
    expect(tabs[1].classList.contains('on')).toBe(true);
    expect(tabs[0].hasAttribute('aria-current')).toBe(false);
    /* jsdom has no media queries: the rules that hold it through 899px and hide it from 900px */
    const css = fs.readFileSync(path.join(__dirname, '../src/widgets/widgets.css'), 'utf8').replace(/\s+/g, ' ');
    expect(css).toContain('@media (min-width: 768px) and (max-width: 899.98px) { .wx-console > .navshell { display: flex; } }');
    expect(css).toContain('@media (min-width: 900px) { .wx-console > .navshell { display: none; } }');
  });

  it('has no axe violations', async () => {
    const { container } = await open();
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }, 60000);

  it('the demo commands carry no key hints (no sequences are wired)', async () => {
    const { container, getByRole } = await open();
    fireEvent.click(getByRole('button', { name: 'Search or ask' }));
    await waitFor(() => { if (!container.querySelector('.cmdk [role="option"]')) throw new Error('bar did not open'); }, { timeout: 5000 });
    expect(container.querySelectorAll('.cmdk [role="option"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.cmdk .cmdk-hint')).toHaveLength(0);
  });

  it('a pending Retry timer is cleared on unmount', async () => {
    const set = vi.spyOn(globalThis, 'setTimeout');
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    try {
      const { container, unmount } = await open();
      const err = [...container.querySelectorAll<HTMLElement>('.wgrid[aria-label="Loading and error widgets"] .wtile')][1];
      set.mockClear();
      fireEvent.click(within(err).getByRole('button', { name: 'Retry' }));
      const i = set.mock.calls.findIndex((c) => c[1] === 1200);
      expect(i).toBeGreaterThanOrEqual(0);
      const id = set.mock.results[i].value;
      unmount();
      expect(clear).toHaveBeenCalledWith(id);
    } finally { set.mockRestore(); clear.mockRestore(); }
  });

  it('wait() removes its abort listener once the delay passes', async () => {
    vi.useFakeTimers();
    try {
      const ac = new AbortController();
      const remove = vi.spyOn(ac.signal, 'removeEventListener');
      const p = wait(50, ac.signal);
      vi.advanceTimersByTime(50);
      await p;
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    } finally { vi.useRealTimers(); }
  });
});
