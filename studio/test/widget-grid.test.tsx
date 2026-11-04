import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import * as React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import axe from 'axe-core';
import { WidgetGrid } from '../../react/widget-grid';
import type { WidgetDefinition } from '../../react/widget-grid';
import { SmartStack } from '../../react/smart-stack';
import { Sparkline, Bars, HBars, Ring, ActivityStrip, LineChart } from '../../react/viz';
import type { LayoutItem } from '../../react/widget-state';

const DEFS: WidgetDefinition[] = [
  {
    kind: 'revenue', name: 'Revenue', sizes: ['s', 'm', 'l', 'xl'],
    render: (size) => (
      <>
        <div className="wtile-hd">Revenue</div>
        <div className="wtile-num" data-view={size}>₱1.84M</div>
        {size !== 's' && <Sparkline values={[4, 6, 5, 8, 9]} />}
        {(size === 'l' || size === 'xl') && <LineChart labels={['a', 'b', 'c']} series={[{ name: 'Now', values: [1, 3, 2] }, { name: 'Last', values: [2, 2, 1] }]} />}
      </>
    ),
  },
  { kind: 'runway', name: 'Runway', sizes: ['s', 'm'], render: (size) => <><div className="wtile-hd">Runway</div><Ring value={62} center="9.2" sub="months" /><span data-view={size} /></> },
  { kind: 'tasks', name: 'Tasks', sizes: ['s', 'm', 'l'], render: (size) => <><div className="wtile-hd">Tasks</div><a href="#t" data-view={size}>Open tasks</a></> },
  { kind: 'pipeline', name: 'Pipeline', sizes: ['m', 'l'], render: () => <><div className="wtile-hd">Pipeline</div><HBars data={[{ label: 'Lead', value: 48 }, { label: 'Won', value: 4, alt: true }]} /></> },
  { kind: 'deploys', name: 'Deploys', sizes: ['m'], render: () => <><div className="wtile-hd">Deploys</div><Bars data={[{ label: 'Mon', value: 3 }, { label: 'Tue', value: 5 }]} /></> },
  { kind: 'activity', name: 'Activity', sizes: ['m'], render: () => <><div className="wtile-hd">Activity</div><ActivityStrip levels={[0, 1, 2, 3, 2]} todayIndex={4} /></> },
];
const L3: LayoutItem[] = [{ id: 'a', kind: 'revenue', size: 's' }, { id: 'b', kind: 'runway', size: 's' }, { id: 'c', kind: 'tasks', size: 's' }];
const ALL: LayoutItem[] = DEFS.map((d, i) => ({ id: `w${i}`, kind: d.kind, size: d.sizes[d.sizes.length - 1] }));

const tiles = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('.wtile')];
const live = (c: HTMLElement) => c.querySelector('.wgrid [aria-live="polite"]')?.textContent?.trim();

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

// ---- accent budget, counted on a rendered grid ----
const CSS_SRC = fs.readFileSync(path.resolve(__dirname, '../../components.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const ACCENT = /var\(--(?:accent(?:-hover|-on|-bloom|-fill)?|data-[123])\s*[,)]/;
function rules(src: string): { sel: string; body: string }[] {
  const out: { sel: string; body: string }[] = [];
  (function walk(text: string) {
    let i = 0;
    let start = 0;
    while (i < text.length) {
      if (text[i] === '{') {
        const prelude = text.slice(start, i).trim();
        let depth = 1;
        let j = i + 1;
        while (j < text.length && depth > 0) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
        const body = text.slice(i + 1, j - 1);
        if (/^@(media|supports)/.test(prelude)) walk(body);
        else if (!prelude.startsWith('@')) for (const s of prelude.split(/,(?![^(]*\))/)) out.push({ sel: s.trim(), body });
        i = j;
        start = j;
      } else if (text[i] === '}') { i++; start = i; } else i++;
    }
  })(src);
  return out;
}
const RULES = rules(CSS_SRC);
const strip = (s: string) => s.replace(/::?(before|after|placeholder)\b/g, '').replace(/:(hover|active|focus-visible|focus|focus-within)\b/g, '');
const safeMatch = (el: Element, sel: string) => { try { return el.matches(strip(sel)); } catch { return false; } };
const ACCENT_SELS = RULES.filter((r) => ACCENT.test(r.body)).map((r) => r.sel);
const NEUTRAL_SELS = RULES.filter((r) => r.sel.startsWith('.wtile:not([data-focus])') && !ACCENT.test(r.body)).map((r) => r.sel);

/** Elements that would paint the accent: matched by an accent rule or carrying an accent attribute, and not neutralised. */
function accentTiles(c: HTMLElement): string[] {
  const hit = new Set<string>();
  for (const el of c.querySelectorAll('.wgrid *')) {
    const neutral = NEUTRAL_SELS.some((s) => safeMatch(el, s));
    const byRule = ACCENT_SELS.some((s) => safeMatch(el, s));
    const byAttr = ['stroke', 'fill', 'stop-color'].some((a) => ACCENT.test(el.getAttribute(a) ?? ''));
    const byStyle = ACCENT.test(el.getAttribute('style') ?? '');
    if (byStyle || ((byRule || byAttr) && !neutral)) {
      const t = el.closest<HTMLElement>('.wtile');
      hit.add(t?.dataset.id ?? 'outside a tile');
    }
  }
  return [...hit];
}

describe('accent budget (law 3: one accent per view)', () => {
  it('the accent rules and neutralisers were read from components.css', () => {
    expect(ACCENT_SELS.length).toBeGreaterThan(10);
    expect(NEUTRAL_SELS.length).toBeGreaterThan(10);
  });
  it('a grid with no focus widget spends no accent', () => {
    const { container } = render(<WidgetGrid definitions={DEFS} layout={ALL} columns={4} storageKey={null} />);
    expect(tiles(container)).toHaveLength(6);
    expect(accentTiles(container)).toEqual([]);
  });
  it('only the focus widget spends it, in view and in edit mode', () => {
    for (const editing of [false, true]) {
      const { container, unmount } = render(<WidgetGrid definitions={DEFS} layout={ALL} columns={4} focus="w0" editing={editing} storageKey={null} />);
      expect(accentTiles(container)).toEqual(['w0']);
      expect(container.querySelectorAll('.wtile[data-focus]')).toHaveLength(1);
      unmount();
    }
  });
  it('the counter does see the viz kit accent (control)', () => {
    const { container } = render(<div className="wgrid"><div className="wtile" data-id="x"><Sparkline values={[1, 2, 3]} /></div></div>);
    expect(accentTiles(container)).toEqual([]);
    const { container: c2 } = render(<div className="wgrid"><div className="wtile" data-id="y" data-focus=""><Sparkline values={[1, 2, 3]} /></div></div>);
    expect(accentTiles(c2)).toEqual(['y']);
  });
});

describe('WidgetGrid', () => {
  it('each tile renders the view for its fitted size: XL to L at 2 columns, to M at 1', () => {
    const one: LayoutItem[] = [{ id: 'a', kind: 'revenue', size: 'xl' }];
    for (const [cols, want] of [[4, 'xl'], [2, 'l'], [1, 'm']] as const) {
      const { container, unmount } = render(<WidgetGrid definitions={DEFS} layout={one} columns={cols} storageKey={null} />);
      const t = tiles(container)[0];
      expect(t.dataset.size).toBe(want);
      expect(t.querySelector('[data-view]')?.getAttribute('data-view')).toBe(want);
      expect(t.getAttribute('aria-label')).toBe(`Revenue, ${{ xl: 'extra large', l: 'large', m: 'medium' }[want]}`);
      unmount();
    }
  });

  it('view mode: tiles are not tab stops and carry no edit controls', () => {
    const { container } = render(<WidgetGrid definitions={DEFS} layout={L3} columns={4} storageKey={null} />);
    expect(tiles(container).every((t) => !t.hasAttribute('tabindex'))).toBe(true);
    expect(container.querySelector('.wtile-x, .wtile-edit, .wgrid-add')).toBeNull();
  });

  it('edit mode: size buttons are aria-pressed; sizes that do not fit stay visible with aria-disabled', () => {
    const onLayoutChange = vi.fn();
    const { container, getByRole } = render(<WidgetGrid definitions={DEFS} defaultLayout={[{ id: 'a', kind: 'revenue', size: 'm' }]} columns={2} editing storageKey={null} onLayoutChange={onLayoutChange} />);
    const group = getByRole('group', { name: 'Revenue size' });
    const btns = [...group.querySelectorAll('button')];
    expect(btns.map((b) => b.textContent)).toEqual(['S', 'M', 'L', 'XL']);
    expect(btns.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false']);
    expect(btns[3].getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(btns[3]);
    expect(onLayoutChange).not.toHaveBeenCalled();
    fireEvent.click(btns[2]);
    expect(onLayoutChange).toHaveBeenLastCalledWith([{ id: 'a', kind: 'revenue', size: 'l' }]);
    expect(tiles(container)[0].dataset.size).toBe('l');
    expect(live(container)).toBe('Revenue resized to large');
  });

  it('Alt+Arrow on a focused tile moves it, keeps focus and announces the position', () => {
    const { container } = render(<WidgetGrid definitions={DEFS} defaultLayout={L3} columns={4} editing storageKey={null} />);
    const a = tiles(container)[0];
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowRight', altKey: true });
    expect(tiles(container).map((t) => t.dataset.id)).toEqual(['b', 'a', 'c']);
    expect(document.activeElement).toBe(tiles(container)[1]);
    expect(live(container)).toBe('Revenue moved to position 2 of 3');
    fireEvent.keyDown(tiles(container)[1], { key: 'ArrowRight' });
    expect(tiles(container).map((t) => t.dataset.id)).toEqual(['b', 'a', 'c']);
  });

  it('Move up and Move down buttons reorder; the ends are aria-disabled', () => {
    const { container, getByRole } = render(<WidgetGrid definitions={DEFS} defaultLayout={L3} columns={4} editing storageKey={null} />);
    expect(getByRole('button', { name: 'Move Revenue up' }).getAttribute('aria-disabled')).toBe('true');
    expect(getByRole('button', { name: 'Move Tasks down' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(getByRole('button', { name: 'Move Revenue down' }));
    expect(tiles(container).map((t) => t.dataset.id)).toEqual(['b', 'a', 'c']);
    expect(live(container)).toBe('Revenue moved to position 2 of 3');
  });

  it('remove: focus moves to the next widget, Undo in the toast restores it', () => {
    const { container, getByRole } = render(<WidgetGrid definitions={DEFS} defaultLayout={L3} columns={4} editing storageKey={null} />);
    fireEvent.click(getByRole('button', { name: 'Remove Runway' }));
    expect(tiles(container).map((t) => t.dataset.id)).toEqual(['a', 'c']);
    expect(document.activeElement).toBe(tiles(container)[1]);
    expect(live(container)).toBe('Runway removed');
    fireEvent.click(getByRole('button', { name: 'Undo' }));
    expect(tiles(container).map((t) => t.dataset.id)).toEqual(['a', 'b', 'c']);
    expect(document.activeElement).toBe(tiles(container)[1]);
    expect(live(container)).toBe('Runway restored');
  });

  it('the Undo toast leaves after a few seconds', () => {
    vi.useFakeTimers();
    const { getByRole, queryByRole } = render(<WidgetGrid definitions={DEFS} defaultLayout={L3} columns={4} editing storageKey={null} />);
    fireEvent.click(getByRole('button', { name: 'Remove Runway' }));
    expect(queryByRole('button', { name: 'Undo' })).not.toBeNull();
    act(() => { vi.advanceTimersByTime(6100); });
    expect(queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('Esc leaves edit mode; long-press enters it', () => {
    vi.useFakeTimers();
    const onEditingChange = vi.fn();
    const { container } = render(<WidgetGrid definitions={DEFS} defaultLayout={L3} columns={4} storageKey={null} onEditingChange={onEditingChange} />);
    const grid = container.querySelector('.wgrid')!;
    fireEvent.pointerDown(tiles(container)[0], { button: 0, clientX: 10, clientY: 10 });
    act(() => { vi.advanceTimersByTime(600); });
    expect(grid.hasAttribute('data-editing')).toBe(true);
    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(grid.hasAttribute('data-editing')).toBe(false);
    fireEvent.pointerDown(tiles(container)[2].querySelector('a')!, { button: 0 });
    act(() => { vi.advanceTimersByTime(600); });
    expect(grid.hasAttribute('data-editing')).toBe(false);
  });

  it('empty grid: label and Add widget; the gallery adds the widget and closes', () => {
    const { container, getByRole, queryByRole } = render(<WidgetGrid definitions={DEFS} defaultLayout={[]} columns={2} storageKey={null} />);
    expect(container.querySelector('.wgrid-empty')?.textContent).toBe('No widgetsAdd widget');
    const open = getByRole('button', { name: 'Add widget' });
    open.focus();
    fireEvent.click(open);
    const dialog = getByRole('dialog', { name: 'Add widget' });
    expect(document.activeElement).toBe(getByRole('button', { name: 'Close' }));
    expect(getByRole('button', { name: 'Add Revenue, extra large' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(getByRole('button', { name: 'Add Revenue, extra large' }));
    expect(dialog.isConnected).toBe(true);
    fireEvent.click(getByRole('button', { name: 'Add Revenue, medium' }));
    expect(queryByRole('dialog')).toBeNull();
    expect(tiles(container).map((t) => [t.dataset.size, t.getAttribute('aria-label')])).toEqual([['m', 'Revenue, medium']]);
    expect(live(container)).toBe('Revenue added');
  });

  it('gallery: Esc closes it and returns focus to the trigger without leaving edit mode', () => {
    const { container, getByRole, queryByRole } = render(<WidgetGrid definitions={DEFS} defaultLayout={L3} columns={4} defaultEditing storageKey={null} />);
    const add = container.querySelector<HTMLButtonElement>('.wgrid-add')!;
    add.focus();
    fireEvent.click(add);
    expect(getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(add);
    expect(container.querySelector('.wgrid')!.hasAttribute('data-editing')).toBe(true);
  });

  it('persists to verseva.widgets.layout and reads it back after mount', () => {
    localStorage.setItem('verseva.widgets.layout', JSON.stringify([{ id: 'z', kind: 'runway', size: 'm' }, { id: 'q', kind: 'gone', size: 's' }]));
    const { container, getByRole } = render(<WidgetGrid definitions={DEFS} defaultLayout={L3} columns={4} editing />);
    expect(tiles(container).map((t) => t.dataset.id)).toEqual(['z']);
    fireEvent.click(getByRole('button', { name: 'Remove Runway' }));
    expect(localStorage.getItem('verseva.widgets.layout')).toBe('[]');
  });

  it('loading renders a skeleton at the size; error renders the line and Retry', () => {
    const onRetry = vi.fn();
    const { container, getByRole } = render(
      <WidgetGrid definitions={DEFS} layout={L3} columns={4} storageKey={null} status={{ a: { loading: true }, b: { error: 'Could not load runway' } }} onRetry={onRetry} />,
    );
    const [a, b] = tiles(container);
    expect(a.getAttribute('aria-busy')).toBe('true');
    expect(a.querySelector('.wtile-skel .skel')).not.toBeNull();
    expect(b.querySelector('[role="alert"]')?.textContent).toContain('Could not load runway');
    fireEvent.click(getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledWith('b');
  });

  it('axe: view, edit and gallery have zero WCAG A/AA violations', async () => {
    const { container, getByRole } = render(<main><WidgetGrid definitions={DEFS} layout={ALL} columns={4} focus="w0" storageKey={null} /></main>);
    await noViolations(container);
    const { container: c2 } = render(<main><WidgetGrid definitions={DEFS} defaultLayout={L3} columns={4} defaultEditing storageKey={null} /></main>);
    await noViolations(c2);
    fireEvent.click(c2.querySelector('.wgrid-add')!);
    await noViolations(document.body);
    expect(getByRole).toBeTruthy();
  });
});

describe('SmartStack', () => {
  const pages = [
    { label: 'Agents', content: <b>3 agents</b> },
    { label: 'Deploys', content: <b>1 deploy</b> },
    { label: 'Approvals', content: <b>4 approvals</b> },
  ];
  const cur = (c: HTMLElement) => c.querySelector('.wstack-page[data-pos="cur"]')?.textContent;

  it('rotates on a timer, pauses on hover and through the visible pause button', () => {
    vi.useFakeTimers();
    const { container, getByRole } = render(<SmartStack pages={pages} label="Live now" interval={1000} />);
    expect(cur(container)).toBe('3 agents');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(cur(container)).toBe('1 deploy');
    fireEvent.mouseEnter(container.querySelector('.wstack')!);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(cur(container)).toBe('1 deploy');
    fireEvent.mouseLeave(container.querySelector('.wstack')!);
    fireEvent.click(getByRole('button', { name: 'Pause rotation' }));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(cur(container)).toBe('1 deploy');
    expect(getByRole('button', { name: 'Resume rotation' })).toBeTruthy();
  });

  it('pauses while focus is inside and while paused from outside', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<SmartStack pages={pages} label="Live now" interval={1000} paused />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(cur(container)).toBe('3 agents');
    rerender(<SmartStack pages={pages} label="Live now" interval={1000} />);
    fireEvent.focus(container.querySelector('.wstack-dot')!);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(cur(container)).toBe('3 agents');
  });

  it('dots jump, mark the current page and hidden pages are inert', () => {
    const { container, getByRole } = render(<SmartStack pages={pages} label="Live now" />);
    fireEvent.click(getByRole('button', { name: 'Show Approvals' }));
    expect(cur(container)).toBe('4 approvals');
    expect(getByRole('button', { name: 'Show Approvals' }).getAttribute('aria-current')).toBe('true');
    const hidden = [...container.querySelectorAll('.wstack-page:not([data-pos="cur"])')];
    expect(hidden.every((p) => p.hasAttribute('inert') && p.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('reduced motion: no timer and no pause button', () => {
    vi.useFakeTimers();
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...mm(q), matches: q.includes('reduce') })) as typeof window.matchMedia;
    try {
      const { container, queryByRole } = render(<SmartStack pages={pages} label="Live now" interval={1000} />);
      act(() => { vi.advanceTimersByTime(3000); });
      expect(cur(container)).toBe('3 agents');
      expect(queryByRole('button', { name: 'Pause rotation' })).toBeNull();
    } finally {
      window.matchMedia = mm;
    }
  });
});

async function noViolations(node: Element) {
  const res = await axe.run(node, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([]);
}
