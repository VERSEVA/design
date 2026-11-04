// The home route: hero, the two CTAs, the live widget home (L1), the neutral drift (L2) and
// the four entry tiles. Motion stops under Pause motion and under reduced motion.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import { FrontDoorPage, INSTALL, INSTALL_HREF, COPIED_HOLD_MS, JOB_TICK_MS, JOB_CYCLES } from '../src/front/FrontDoorPage';
import { applyTheme, setMotionPaused } from '../src/theme';

const CSS = fs.readFileSync(`${__dirname}/../src/front/front.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const realMatchMedia = window.matchMedia;
const reduce = (on: boolean) => {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes('prefers-reduced-motion: reduce'), media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};
const pct = (el: ParentNode) => el.querySelector('.hero-live .lact-pc')?.textContent ?? '';
const slide = (el: ParentNode) => el.querySelector('.hero-live .wstack-page[data-pos="cur"]')?.getAttribute('aria-label') ?? '';

describe('front door', () => {
  beforeEach(() => { localStorage.clear(); window.history.replaceState(null, '', '/'); applyTheme({ brand: '', mode: 'dark' }); });
  afterEach(() => { cleanup(); act(() => setMotionPaused(false)); window.matchMedia = realMatchMedia; vi.useRealTimers(); vi.restoreAllMocks(); });

  it('keeps the approved headline as the one h1', () => {
    render(<FrontDoorPage />);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe('One source. Every surface');
  });

  it('carries one primary action and a quieter Browse', () => {
    const { container } = render(<FrontDoorPage />);
    const go = screen.getByRole('link', { name: 'Get started' });
    const browse = screen.getByRole('link', { name: 'Browse' });
    expect(go.className).toContain('btn-primary');
    expect(browse.className).toContain('btn-secondary');
    expect(browse.getAttribute('href')).toBe('/components');
    expect(go.getAttribute('href')).toBe(INSTALL_HREF);
    expect(INSTALL_HREF).toBe('/components#install');
    expect(container.querySelectorAll('.btn-primary')).toHaveLength(1);
  });

  it('Get started copies the install line, says Copied, then lands on the install section', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { container } = render(<FrontDoorPage />);
    const go = screen.getByRole('link', { name: 'Get started' });
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    act(() => { go.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    expect(writeText).toHaveBeenCalledWith(INSTALL);
    expect(INSTALL).toBe('npm i @verseva/design');
    await act(async () => {});
    expect(go.textContent).toBe('Copied');
    expect(container.querySelector('.hero [aria-live="polite"]')?.textContent).toBe('Copied');
    expect(window.location.pathname).toBe('/');
    act(() => { vi.advanceTimersByTime(COPIED_HOLD_MS); });
    expect(window.location.pathname + window.location.hash).toBe('/components#install');
  });

  it('a modified click on Get started is left to the browser', () => {
    render(<FrontDoorPage />);
    const go = screen.getByRole('link', { name: 'Get started' });
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true });
    go.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('Browse routes in the shell', () => {
    render(<FrontDoorPage />);
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    screen.getByRole('link', { name: 'Browse' }).dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(window.location.pathname).toBe('/components');
  });

  it('the live hero is a real widget home: smart stack, live activity, one focus widget', () => {
    const { container } = render(<FrontDoorPage />);
    const live = container.querySelector('.hero-live')!;
    const grid = live.querySelector('.wgrid')!;
    expect(grid).toBeTruthy();
    const ids = [...grid.querySelectorAll('.wtile')].map((t) => t.getAttribute('data-id'));
    expect(ids).toEqual(['revenue', 'live', 'job']);
    expect(grid.querySelectorAll('.wtile[data-focus]')).toHaveLength(1);
    expect(grid.querySelector('.wtile[data-focus]')!.getAttribute('data-id')).toBe('revenue');
    expect(live.querySelector('.wstack .wstack-pause')).toBeTruthy();
    expect(live.querySelector('.lact')).toBeTruthy();
    expect(live.querySelector('iframe, video, img')).toBeNull();
  });

  it('nothing in the live hero takes focus on its own', () => {
    vi.useFakeTimers();
    render(<FrontDoorPage />);
    const before = document.activeElement;
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(document.activeElement).toBe(before);
  });

  it('the demo job ticks and the stack rotates while motion runs', () => {
    vi.useFakeTimers();
    const { container } = render(<FrontDoorPage />);
    const a = pct(container);
    const s = slide(container);
    act(() => { vi.advanceTimersByTime(JOB_TICK_MS * 6); });
    expect(pct(container)).not.toBe(a);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(slide(container)).not.toBe(s);
  });

  it('Pause motion stops the job and the stack, and marks the hero still', () => {
    vi.useFakeTimers();
    const { container } = render(<FrontDoorPage />);
    act(() => setMotionPaused(true));
    const hero = container.querySelector('.hero')!;
    expect(hero.hasAttribute('data-live')).toBe(false);
    const a = pct(container);
    const s = slide(container);
    act(() => { vi.advanceTimersByTime(JOB_TICK_MS * 10 + 12_000); });
    expect(pct(container)).toBe(a);
    expect(slide(container)).toBe(s);
    act(() => setMotionPaused(false));
    expect(hero.hasAttribute('data-live')).toBe(true);
  });

  it('reduced motion starts still: no drift, no sweep, no ticking', () => {
    vi.useFakeTimers();
    reduce(true);
    const { container } = render(<FrontDoorPage />);
    expect(container.querySelector('.hero')!.hasAttribute('data-live')).toBe(false);
    const a = pct(container);
    act(() => { vi.advanceTimersByTime(JOB_TICK_MS * 10); });
    expect(pct(container)).toBe(a);
  });

  it('the drift field is decorative and neutral', () => {
    const { container } = render(<FrontDoorPage />);
    const aurora = container.querySelector('.hero .aurora')!;
    expect(aurora.getAttribute('aria-hidden')).toBe('true');
    const rules = [...CSS.matchAll(/([^{}]*\.aurora[^{}]*)\{([^}]*)\}/g)].map((m) => m[2]).join('\n');
    expect(rules).not.toMatch(/--accent|--data-[0-3]|--focus/);
  });

  it('every animation is transform or opacity, runs only after mount and only without reduced motion', () => {
    const keyframes = [...CSS.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^}]*\})*)\s*\}/g)];
    expect(keyframes.length).toBeGreaterThanOrEqual(3);
    for (const [, name, body] of keyframes) {
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(['transform', 'opacity'], `${name} animates ${p}`).toContain(p);
    }
    const anim = [...CSS.matchAll(/([^{}]+)\{[^{}]*\banimation(?:-name)?\s*:\s*(?!none)[^;}]+/g)].map((m) => m[1].trim());
    expect(anim.length).toBeGreaterThanOrEqual(3);
    for (const sel of anim) expect(sel, sel).toMatch(/\[data-live\]/);
    const media = CSS.match(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{([\s\S]*)\}\s*$/m);
    expect(media, 'animations live in one no-preference block at the end of front.css').toBeTruthy();
    const outside = CSS.slice(0, CSS.indexOf(media![0]));
    expect(outside).not.toMatch(/\banimation(?:-name)?\s*:\s*(?!none)/);
    for (const v of [...media![1].matchAll(/animation\s*:([^;}]+)/g)].map((m) => m[1])) expect(v, v).toMatch(/var\(--dur-\d\)/);
  });

  it('the ambient sweep holds on hover and focus; the primary stays matte', () => {
    expect(CSS).toMatch(/\.cta-go:is\(:hover,\s*:focus-visible\)::after\s*\{[^}]*animation-play-state:\s*paused/);
    const go = [...CSS.matchAll(/([^{}]*\.cta-go[^{}]*)\{([^}]*)\}/g)].map((m) => m[2]).join('\n');
    expect(go).not.toMatch(/--accent(?!-ink)/);
    for (const s of [...go.matchAll(/box-shadow\s*:([^;}]+)/g)].map((m) => m[1])) expect(s.trim(), s).toMatch(/^inset\b/);
  });

  it('four labels-only entry tiles route in the shell', () => {
    const { container } = render(<FrontDoorPage />);
    const tiles = [...container.querySelectorAll<HTMLAnchorElement>('.entry a.wtile')];
    expect(tiles.map((t) => t.getAttribute('href'))).toEqual(['/components', '/widgets', '/foundations', '/gallery']);
    expect(tiles.map((t) => t.querySelector('.wtile-hd')?.textContent)).toEqual(['Components', 'Widgets', 'Foundations', 'Gallery']);
    for (const t of tiles) {
      expect(t.querySelector('.wtile-num')?.textContent).toMatch(/^\d+$/);
      expect(t.querySelector('p')).toBeNull();
      window.history.replaceState(null, '', '/');
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      t.dispatchEvent(ev);
      expect(ev.defaultPrevented, `${t.getAttribute('href')} reloads the page`).toBe(true);
      expect(window.location.pathname).toBe(t.getAttribute('href'));
    }
  });

  describe('honest Copied', () => {
    const click = () => {
      const go = screen.getByRole('link', { name: 'Get started' });
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      act(() => { go.dispatchEvent(ev); });
      return { go, ev };
    };
    const region = (c: HTMLElement) => c.querySelector('.hero [aria-live="polite"]')?.textContent;
    const clip = (writeText: unknown) => Object.defineProperty(navigator, 'clipboard', { value: writeText === undefined ? undefined : { writeText }, configurable: true });

    it('says Copied only once writeText resolves', async () => {
      vi.useFakeTimers();
      let done!: () => void;
      clip(vi.fn(() => new Promise<void>((r) => { done = r; })));
      const { container } = render(<FrontDoorPage />);
      const { go } = click();
      expect(go.textContent).toBe('Get started');
      expect(region(container)).toBe('');
      await act(async () => { done(); });
      expect(go.textContent).toBe('Copied');
      expect(region(container)).toBe('Copied');
      act(() => { vi.advanceTimersByTime(COPIED_HOLD_MS); });
      expect(window.location.pathname + window.location.hash).toBe(INSTALL_HREF);
    });

    for (const [name, writeText] of [
      ['clipboard denied', vi.fn(() => Promise.reject(new DOMException('denied', 'NotAllowedError')))],
      ['no navigator.clipboard', undefined],
      ['writeText throws', vi.fn(() => { throw new TypeError('not allowed'); })],
    ] as const) {
      it(`${name}: no Copied, points at the command, still lands on the install section`, async () => {
        vi.useFakeTimers();
        clip(writeText);
        const { container } = render(<FrontDoorPage />);
        const { go, ev } = click();
        await act(async () => {});
        expect(ev.defaultPrevented).toBe(true);
        expect(go.textContent).toBe('Command below');
        expect(region(container)).toBe('Command below');
        expect(container.textContent).not.toContain('Copied');
        act(() => { vi.advanceTimersByTime(COPIED_HOLD_MS); });
        expect(window.location.pathname + window.location.hash).toBe(INSTALL_HREF);
      });
    }
  });

  describe('quiet demo job', () => {
    const status = (c: HTMLElement) => [...c.querySelectorAll('.hero-live .jobcap [role="status"], .hero-live .jobcap [role="alert"]')].map((e) => e.textContent).join('');
    const cap = (c: HTMLElement) => c.querySelector<HTMLButtonElement>('.hero-live button.lact')!;
    const panelButton = (c: HTMLElement, label: string) => [...c.querySelectorAll<HTMLButtonElement>('.hero-live .lact-panel button')].find((b) => b.textContent === label);
    const REST_MS = JOB_CYCLES * 20_000;

    it('says nothing on its own, across every cycle', () => {
      vi.useFakeTimers();
      const { container } = render(<FrontDoorPage />);
      const heard: string[] = [];
      for (let t = 0; t < REST_MS; t += JOB_TICK_MS) { act(() => { vi.advanceTimersByTime(JOB_TICK_MS); }); const s = status(container); if (s) heard.push(s); }
      expect(heard).toEqual([]);
    });

    it('announces once the capsule panel is opened', () => {
      vi.useFakeTimers();
      const { container } = render(<FrontDoorPage />);
      act(() => { cap(container).click(); });
      const heard: string[] = [];
      for (let t = 0; t < 20_000; t += JOB_TICK_MS) { act(() => { vi.advanceTimersByTime(JOB_TICK_MS); }); const s = status(container); if (s) heard.push(s); }
      expect(heard.length).toBeGreaterThan(0);
    });

    it('rests after the last cycle; Restart in the panel starts it again', () => {
      vi.useFakeTimers();
      const { container } = render(<FrontDoorPage />);
      act(() => { vi.advanceTimersByTime(REST_MS); });
      expect(pct(container)).toBe('Done');
      act(() => { cap(container).click(); });
      const restart = panelButton(container, 'Restart');
      expect(restart, 'Restart in the panel').toBeTruthy();
      expect(restart!.disabled).toBe(false);
      act(() => { restart!.click(); });
      act(() => { vi.advanceTimersByTime(JOB_TICK_MS * 4); });
      expect(pct(container)).toMatch(/^\d+%$/);
    });

    it('Cancel stops the job; a Restart brings it back', () => {
      vi.useFakeTimers();
      const { container } = render(<FrontDoorPage />);
      act(() => { cap(container).click(); });
      const cancel = panelButton(container, 'Cancel');
      expect(cancel).toBeTruthy();
      expect(cancel!.className).not.toMatch(/primary/);
      act(() => { cancel!.click(); });
      act(() => { vi.advanceTimersByTime(JOB_TICK_MS * 10); });
      expect(container.querySelector('.hero-live .lact-list')).toBeNull();
      const again = [...container.querySelectorAll<HTMLButtonElement>('.hero-live .jobcap > button')].find((b) => b.textContent === 'Restart');
      expect(again, 'a Restart after Cancel').toBeTruthy();
      act(() => { again!.click(); });
      act(() => { vi.advanceTimersByTime(JOB_TICK_MS * 4); });
      expect(pct(container)).toMatch(/^\d+%$/);
    });
  });
});
