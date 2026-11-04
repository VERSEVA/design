// NativeChapter: what replaces the iframe embed's behaviour for a ported chapter.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { App } from '../src/App';
import { NativeChapter, type ChapterScript } from '../src/chapters/NativeChapter';
import { chapterThemeWipe } from '../src/chapters/themeWipe';
import { applyTheme, getTheme } from '../src/theme';

const links = (
  <>
    <section id="here"><h2>Here</h2></section>
    <a id="route" href="/motion">route</a>
    <a id="legacy" href="motion.html#tokens">legacy</a>
    <a id="anchor" href="#here">anchor</a>
    <a id="mail" href="mailto:a@b.test">mail</a>
    <a id="file" href="/examples/pulse.html">file</a>
    <a id="data" href="/r/x.json">data</a>
    <a id="blank" href="/motion" target="_blank">blank</a>
    <a id="out" href="https://github.com/verseva/design">out</a>
    <span id="plain">plain</span>
  </>
);

describe('NativeChapter', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/decks'); });

  it('scrolls a deep link to its section once on mount', async () => {
    window.history.replaceState(null, '', '/decks#structure');
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<App />);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const hits = spy.mock.contexts.filter((el) => (el as Element).id === 'structure');
    expect(hits.length).toBe(1);
    spy.mockRestore();
  });

  it('survives a malformed deep link (/decks#%): the studio stays mounted and nothing scrolls', async () => {
    window.history.replaceState(null, '', '/decks#%');
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { container } = render(<App />);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(container.querySelector('[data-chapter="decks"] .chap')).not.toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('routes in-chapter links through the studio router, leaving modified and foreign clicks native', () => {
    const { container } = render(<NativeChapter slug="decks">{links}</NativeChapter>);
    /* Record whether the chapter took the click, then stop jsdom's (unimplemented) navigation. */
    let taken = false;
    const record = (e: Event) => { taken = e.defaultPrevented; e.preventDefault(); };
    window.addEventListener('click', record);
    const click = (id: string, init: MouseEventInit = {}) => { fireEvent.click(container.querySelector(`#${id}`)!, { button: 0, ...init }); return !taken; };
    expect(click('route')).toBe(false);
    expect(window.location.pathname).toBe('/motion');
    window.history.replaceState(null, '', '/decks');
    expect(click('legacy')).toBe(false);
    expect(window.location.pathname + window.location.hash).toBe('/motion#tokens');
    window.history.replaceState(null, '', '/decks');
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    expect(click('anchor')).toBe(false);
    expect(spy.mock.contexts.map((el) => (el as Element).id)).toEqual(['here']);
    spy.mockRestore();
    for (const id of ['mail', 'file', 'data', 'blank', 'out', 'plain']) expect(click(id), id).toBe(true);
    expect(click('route', { metaKey: true })).toBe(true);
    expect(click('route', { ctrlKey: true })).toBe(true);
    expect(click('route', { shiftKey: true })).toBe(true);
    expect(click('route', { button: 1 })).toBe(true);
    expect(window.location.pathname).toBe('/decks');
    window.removeEventListener('click', record);
  });

  it('an in-page anchor moves focus to its target as well as scrolling (WCAG 2.4.1), making it focusable when needed', () => {
    const { container } = render(
      <NativeChapter slug="decks">
        <a id="skip" href="#plain-target">Skip</a>
        <div id="plain-target"><p>content</p></div>
        <a id="skip2" href="#own-target">Skip</a>
        <div id="own-target" tabIndex={-1} />
        <a id="skip3" href="#btn-target">Skip</a>
        <button id="btn-target" type="button">already focusable</button>
      </NativeChapter>,
    );
    const target = container.querySelector<HTMLElement>('#plain-target')!;
    fireEvent.click(container.querySelector('#skip')!, { button: 0 });
    expect(target.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(target);
    fireEvent.click(container.querySelector('#skip2')!, { button: 0 });
    expect(document.activeElement?.id).toBe('own-target');
    fireEvent.click(container.querySelector('#skip3')!, { button: 0 });
    expect(document.activeElement?.id).toBe('btn-target');
    expect(container.querySelector('#btn-target')!.hasAttribute('tabindex')).toBe(false);
  });

  it('the skip-link specimens (#sh-main, #shr-main) move focus into their content region', async () => {
    window.history.replaceState(null, '', '/components');
    const { container } = render(<App />);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    for (const id of ['sh-main', 'shr-main']) {
      const skip = container.querySelector<HTMLAnchorElement>(`.chap a.skip[href="#${id}"]`)!;
      expect(skip, id).not.toBeNull();
      fireEvent.click(skip, { button: 0 });
      expect(document.activeElement?.id, id).toBe(id);
    }
  });

  it('runs a chapter script after mount and leaves no listener, timer or cleanup behind on unmount', () => {
    vi.useFakeTimers();
    const onWin = vi.fn();
    const onRoot = vi.fn();
    const tick = vi.fn();
    const cleaned = vi.fn();
    let seen: AbortSignal | null = null;
    const script: ChapterScript = (root, signal, onCleanup) => {
      seen = signal;
      window.addEventListener('resize', onWin, { signal });
      root.addEventListener('click', onRoot, { signal });
      const t = setInterval(tick, 100);
      onCleanup(() => clearInterval(t));
      onCleanup(cleaned);
    };
    const { container, unmount } = render(<NativeChapter slug="decks" script={script}><span id="t">t</span></NativeChapter>);
    const root = container.querySelector('.chap')!;
    window.dispatchEvent(new Event('resize'));
    fireEvent.click(container.querySelector('#t')!);
    vi.advanceTimersByTime(250);
    expect([onWin.mock.calls.length, onRoot.mock.calls.length, tick.mock.calls.length]).toEqual([1, 1, 2]);
    unmount();
    window.dispatchEvent(new Event('resize'));
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(500);
    expect([onWin.mock.calls.length, onRoot.mock.calls.length, tick.mock.calls.length]).toEqual([1, 1, 2]);
    expect(seen!.aborted).toBe(true);
    expect(cleaned).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('gives ported scripts the theme wipe theme.js gave the legacy pages: it flips the studio mode', () => {
    applyTheme({ brand: '', mode: 'dark' });
    chapterThemeWipe({ clientX: 10, clientY: 10 });
    expect(getTheme().mode).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    chapterThemeWipe(null);
    expect(getTheme().mode).toBe('dark');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
