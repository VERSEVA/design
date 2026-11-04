// The 1.6.1 shell: grouped sidebar, the icon rail and its flyouts, the studio-wide command
// bar, and the On this page rail with scroll-spy.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act, within } from '@testing-library/react';
import { filterCommands } from '../../react/command-state';
import { App } from '../src/App';
import { navigate } from '../src/shell/router';
import { NAV, RAIL_KEY, SHUT_KEY } from '../src/shell/nav';
import { studioCommands } from '../src/shell/search';
import { ROUTES } from '../src/shell/routes';

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });
/* The command bar is its own chunk, loaded on first open. */
const barOpen = () => vi.waitFor(() => { if (!document.querySelector('.cmdk-input')) throw new Error('bar not open'); }, { timeout: 5000 });
const root = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  delete root.dataset.rail;
  delete root.dataset.navShut;
});

describe('sidebar, expanded', () => {
  it('has three collapsible groups, Gallery listing its examples, and no section anchors', () => {
    const { container } = render(<App />);
    const side = container.querySelector('.side-full')!;
    const heads = [...side.querySelectorAll('button.sgroup-head')];
    expect(heads.map((h) => h.textContent)).toEqual(['Studio', 'Chapters', 'Gallery']);
    const gallery = within(side.querySelector<HTMLElement>('.sgroup[data-g="gallery"]')!);
    for (const r of ROUTES.filter((x) => x.parent === '/gallery')) expect(gallery.getByRole('link', { name: r.label })).toBeTruthy();
    expect(side.querySelector('a[href*="#"]')).toBeNull();
  });

  it('keeps the counts as neutral badges', () => {
    const { container } = render(<App />);
    const cnt = container.querySelector('.side-full a[href="/foundations"] .cnt')!;
    expect(cnt.textContent).toBe(String(ROUTES.find((r) => r.path === '/foundations')!.count));
  });

  it('puts the bloom on the active item only: a code page marks its example', async () => {
    const { container } = render(<App />);
    await act(async () => { navigate('/gallery/pulse/code'); });
    const active = [...container.querySelectorAll('.side-full .snav a.active')];
    expect(active.map((a) => a.getAttribute('href'))).toEqual(['/gallery/pulse']);
  });

  it('shuts a group, persists it, and keeps the active group open', async () => {
    const { container } = render(<App />);
    const head = container.querySelector<HTMLButtonElement>('.sgroup[data-g="chapters"] .sgroup-head')!;
    expect(head.getAttribute('aria-expanded')).toBe('true');
    await act(async () => { fireEvent.click(head); });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#sg-chapters')!.hasAttribute('hidden')).toBe(true);
    expect(JSON.parse(localStorage.getItem(SHUT_KEY)!)).toEqual(['chapters']);
    expect(root.dataset.navShut).toBe('chapters');
    await act(async () => { navigate('/motion'); });
    expect(head.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('icon rail', () => {
  it('collapses to the rail and back, persists it on <html> and in storage, and keeps focus on the toggle', async () => {
    const { container } = render(<App />);
    const collapse = container.querySelector<HTMLButtonElement>('.side-full .collapse-row')!;
    collapse.focus();
    await act(async () => { fireEvent.click(collapse); });
    expect(root.dataset.rail).toBe('collapsed');
    expect(localStorage.getItem(RAIL_KEY)).toBe('1');
    const expand = container.querySelector<HTMLButtonElement>('.side-rail .collapse-row')!;
    expect(document.activeElement).toBe(expand);
    expect(expand.getAttribute('aria-label')).toBe('Expand sidebar');
    await act(async () => { fireEvent.click(expand); });
    expect(root.dataset.rail).toBeUndefined();
    expect(localStorage.getItem(RAIL_KEY)).toBeNull();
    expect(document.activeElement).toBe(collapse);
  });

  it('has one icon per top-level Studio page and one per other group, each with a label', () => {
    const { container } = render(<App />);
    const rail = container.querySelector('.side-rail')!;
    const studio = NAV.find((g) => g.id === 'studio')!.items.map((i) => i.label);
    expect([...rail.querySelectorAll('a.railbtn')].map((a) => a.getAttribute('aria-label'))).toEqual(studio);
    expect([...rail.querySelectorAll('.railset button.railbtn')].map((b) => b.getAttribute('aria-label'))).toEqual(['Chapters', 'Gallery']);
    for (const el of rail.querySelectorAll('.railbtn')) expect(el.querySelector('svg')).not.toBeNull();
  });

  it('shows a tooltip on focus', async () => {
    const { container } = render(<App />);
    const a = container.querySelector<HTMLAnchorElement>('.side-rail a.railbtn[aria-label="Foundations"]')!;
    await act(async () => { fireEvent.focus(a); });
    const tip = container.querySelector('.railtip')!;
    expect(tip.hasAttribute('hidden')).toBe(false);
    expect(tip.textContent).toBe('Foundations');
  });

  it('flyout: focus shows it, arrows move, Enter follows, Esc returns focus', async () => {
    const { container } = render(<App />);
    const btn = container.querySelector<HTMLButtonElement>('.side-rail button.railbtn[aria-label="Chapters"]')!;
    const fly = container.querySelector<HTMLElement>(`#${btn.getAttribute('aria-controls')}`)!;
    expect(fly.hasAttribute('hidden')).toBe(true);
    btn.focus();
    await act(async () => { fireEvent.focus(btn); });
    expect(fly.hasAttribute('hidden')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const links = [...fly.querySelectorAll<HTMLAnchorElement>('a')];
    expect(links.map((l) => l.textContent)).toEqual(NAV.find((g) => g.id === 'chapters')!.items.map((i) => i.label));
    await act(async () => { fireEvent.keyDown(btn, { key: 'ArrowRight' }); });
    expect(document.activeElement).toBe(links[0]);
    await act(async () => { fireEvent.keyDown(links[0], { key: 'ArrowDown' }); });
    expect(document.activeElement).toBe(links[1]);
    await act(async () => { fireEvent.keyDown(links[1], { key: 'ArrowUp' }); fireEvent.keyDown(links[0], { key: 'ArrowUp' }); });
    expect(document.activeElement).toBe(links[links.length - 1]);
    await act(async () => { fireEvent.keyDown(links[links.length - 1], { key: 'Escape' }); });
    expect(document.activeElement).toBe(btn);
    expect(fly.hasAttribute('hidden')).toBe(true);
    await act(async () => { fireEvent.keyDown(btn, { key: 'Enter' }); });
    expect(document.activeElement).toBe(links[0]);
    await act(async () => { fireEvent.click(links[0], { button: 0 }); });
    expect(window.location.pathname).toBe(links[0].getAttribute('href'));
    expect(fly.hasAttribute('hidden')).toBe(true);
  });
});

describe('command bar', () => {
  it('covers every route and every chapter and page section', () => {
    const cmds = studioCommands(() => {});
    const labels = new Set(cmds.map((c) => c.label));
    for (const r of ROUTES) expect(cmds.some((c) => c.path === r.path), r.path).toBe(true);
    for (const r of ROUTES) for (const s of r.sections) expect(cmds.some((c) => c.path === `${r.path}#${s.id}`), `${r.path}#${s.id}`).toBe(true);
    expect(labels.has('Foundations')).toBe(true);
    expect(filterCommands(cmds, 'loops').map((c) => c.path)).toContain('/assets#loops');
    expect(filterCommands(cmds, 'pulse code').map((c) => c.path)).toContain('/gallery/pulse/code');
  });

  it('opens on Ctrl K, finds a section on another page, lands on it with focus', async () => {
    const { container } = render(<App />);
    await act(async () => { fireEvent.keyDown(document, { key: 'k', ctrlKey: true }); });
    await barOpen();
    const input = container.querySelector<HTMLInputElement>('.cmdk-input')!;
    /* the bar focuses its field in an effect after the chunk mounts it */
    await vi.waitFor(() => expect(document.activeElement).toBe(input), { timeout: 5000 });
    await act(async () => { fireEvent.change(input, { target: { value: 'motion foundations' } }); });
    /* the commands are their own chunk, loaded after mount */
    await vi.waitFor(() => { if (!container.querySelector('.cmdk-opt')) throw new Error('no options yet'); }, { timeout: 5000 });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    await tick();
    expect(window.location.pathname + window.location.hash).toBe('/foundations#motion');
    expect(container.querySelector('.cmdk')).toBeNull();
    expect(document.activeElement).toBe(document.getElementById('motion'));
  });

  it('opens on a chapter page that shows open dialog specimens, and Ctrl K again closes it', async () => {
    window.history.replaceState(null, '', '/components');
    const { container } = render(<App />);
    expect(document.querySelector('[aria-modal="true"]:not([hidden])')).not.toBeNull();
    await act(async () => { fireEvent.keyDown(document, { key: 'k', ctrlKey: true }); });
    await barOpen();
    expect(container.querySelectorAll('.cmdk')).toHaveLength(1);
    await act(async () => { fireEvent.keyDown(document, { key: 'k', metaKey: true }); });
    expect(container.querySelector('.cmdk')).toBeNull();
  });

  it('the top bar trigger and the phone icon button open the same bar', async () => {
    const { container } = render(<App />);
    await act(async () => { fireEvent.click(container.querySelector('.studio-head .cmdk-trigger')!); });
    await barOpen();
    expect(container.querySelectorAll('.cmdk')).toHaveLength(1);
    await act(async () => { fireEvent.keyDown(container.querySelector('.cmdk')!, { key: 'Escape' }); });
    await act(async () => { fireEvent.click(container.querySelector('.studio-head button.searchbtn')!); });
    await barOpen();
    expect(container.querySelectorAll('.cmdk')).toHaveLength(1);
  });
});

describe('On this page', () => {
  it('lists the page sections on chapter and Foundations pages only', async () => {
    const { container } = render(<App />);
    expect(container.querySelector('.pagetoc')).toBeNull();
    await act(async () => { navigate('/foundations'); });
    const toc = container.querySelector('nav.pagetoc')!;
    expect(toc.getAttribute('aria-label')).toBe('On this page');
    const f = ROUTES.find((r) => r.path === '/foundations')!;
    expect([...toc.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(f.sections.map((s) => `/foundations#${s.id}`));
    await act(async () => { navigate('/motion'); });
    expect(container.querySelector('nav.pagetoc')).not.toBeNull();
    await act(async () => { navigate('/assets'); });
    expect(container.querySelector('nav.pagetoc')).toBeNull();
  });

  it('scroll-spy sets aria-current on the visible section', async () => {
    window.history.replaceState(null, '', '/foundations');
    const { container } = render(<App />);
    const f = ROUTES.find((r) => r.path === '/foundations')!;
    const target = f.sections[2].id;
    const tops = new Map(f.sections.map((s, i) => [s.id, i <= 2 ? -100 + i : 900]));
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const top = tops.get(this.id) ?? 0;
      return { top, bottom: top + 10, left: 0, right: 0, width: 0, height: 10, x: 0, y: top, toJSON() {} } as DOMRect;
    });
    await act(async () => { window.dispatchEvent(new Event('scroll')); });
    await tick();
    const current = [...container.querySelectorAll('.pagetoc a[aria-current="location"]')].map((a) => a.getAttribute('href'));
    expect(current).toEqual([`/foundations#${target}`]);
    vi.restoreAllMocks();
  });

  it('scroll-spy keeps the first tile of a shared bento row, and the hash target inside that row', async () => {
    window.history.replaceState(null, '', '/components');
    const { container } = render(<App />);
    /* Install and Spacing utilities share the top row (a sub-pixel apart); Button and Field the next. */
    const tops = new Map<string, number>([['install', -40], ['spacing', -39.6], ['button', 400], ['field', 400]]);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const top = tops.get(this.id) ?? 900;
      return { top, bottom: top + 10, left: 0, right: 0, width: 0, height: 10, x: 0, y: top, toJSON() {} } as DOMRect;
    });
    const marked = async () => {
      await act(async () => { window.dispatchEvent(new Event('scroll')); });
      await tick();
      return [...container.querySelectorAll('.pagetoc a[aria-current="location"]')].map((a) => a.getAttribute('href'));
    };
    expect(await marked()).toEqual(['/components#install']);
    await act(async () => { navigate('/components#spacing'); });
    expect(await marked()).toEqual(['/components#spacing']);
    /* A hash outside the winning row does not pull the mark. */
    tops.set('install', -500); tops.set('spacing', -499.6); tops.set('button', -40); tops.set('field', -40);
    expect(await marked()).toEqual(['/components#button']);
    vi.restoreAllMocks();
  });

  it('scroll-spy marks the hash target on a page too short for any section to reach the line', async () => {
    window.history.replaceState(null, '', '/decks');
    const { container } = render(<App />);
    /* Decks at 1440x900: both tiles share the first row, below the line, and the page cannot scroll. */
    const tops = new Map<string, number>([['slide-anatomy', 213], ['structure', 213]]);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const top = tops.get(this.id) ?? 900;
      return { top, bottom: top + 10, left: 0, right: 0, width: 0, height: 10, x: 0, y: top, toJSON() {} } as DOMRect;
    });
    const marked = async () => {
      await act(async () => { window.dispatchEvent(new Event('scroll')); });
      await tick();
      return [...container.querySelectorAll('.pagetoc a[aria-current="location"]')].map((a) => a.getAttribute('href'));
    };
    expect(await marked()).toEqual(['/decks#slide-anatomy']);
    await act(async () => { navigate('/decks#structure'); });
    expect(await marked()).toEqual(['/decks#structure']);
    /* A hash below the fold does not pull the mark. */
    tops.set('structure', 2000);
    expect(await marked()).toEqual(['/decks#slide-anatomy']);
    vi.restoreAllMocks();
  });

  it('a click moves focus to the section', async () => {
    window.history.replaceState(null, '', '/foundations');
    const { container } = render(<App />);
    await tick();
    fireEvent.click(container.querySelector('.pagetoc a[href="/foundations#motion"]')!, { button: 0 });
    await tick();
    expect(document.activeElement).toBe(document.getElementById('motion'));
  });
});
