// A lazily loaded part that fails to load never blanks the studio: the color panel and the
// command bar each show a labels-only error with Retry, Retry clears the cached import and
// tries again, and a failed search commands chunk is retried too.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { App } from '../src/App';
import { applyTheme } from '../src/theme';
import { colorPanelChunk } from '../src/shell/ColorPopover';
import { commandBarChunk } from '../src/shell/LazyCommandBar';
import { searchChunk } from '../src/shell/StudioHeader';

const fail = () => Promise.reject(new Error('Failed to fetch dynamically imported module'));
const saved = { color: colorPanelChunk.load, bar: commandBarChunk.load, search: searchChunk.load };
const wait = (fn: () => unknown) => vi.waitFor(() => { if (!fn()) throw new Error('not yet'); }, { timeout: 5000 });

beforeEach(() => {
  localStorage.clear(); window.history.replaceState(null, '', '/'); applyTheme({ brand: '', mode: 'dark' });
  for (const c of [colorPanelChunk, commandBarChunk, searchChunk]) c.reset();
});
afterEach(() => {
  colorPanelChunk.load = saved.color; commandBarChunk.load = saved.bar; searchChunk.load = saved.search;
  for (const c of [colorPanelChunk, commandBarChunk, searchChunk]) c.reset();
});

describe('a failed chunk', () => {
  it('color panel: the studio stays, an error with Retry shows, and Retry imports again', async () => {
    const load = vi.fn(fail);
    colorPanelChunk.load = load;
    const { container } = render(<App />);
    await act(async () => { fireEvent.click(container.querySelector('button.accentdot')!); });
    await wait(() => container.querySelector('.colorpop .chunkerr'));
    expect(container.querySelector('.studio-head')).not.toBeNull();
    expect(container.querySelector('main h1')).not.toBeNull();
    const retry = [...container.querySelectorAll<HTMLButtonElement>('.colorpop button')].find((b) => b.textContent === 'Retry')!;
    expect(container.querySelector('.colorpop')!.textContent).toBe('Color panel did not loadRetry');
    expect(document.activeElement).toBe(retry);
    colorPanelChunk.load = saved.color;
    await act(async () => { fireEvent.click(retry); });
    await wait(() => container.querySelector('.colorpop [role="radio"]'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('command bar: the studio stays, the bar frame shows an error with Retry, and Retry imports again', async () => {
    const load = vi.fn(fail);
    commandBarChunk.load = load;
    const { container } = render(<App />);
    await act(async () => { fireEvent.keyDown(document, { key: 'k', ctrlKey: true }); });
    await wait(() => container.querySelector('.cmdk .chunkerr'));
    expect(container.querySelector('main h1')).not.toBeNull();
    expect(container.querySelector('.cmdk')!.getAttribute('aria-modal')).toBe('true');
    commandBarChunk.load = saved.bar;
    await act(async () => { fireEvent.click([...container.querySelectorAll<HTMLButtonElement>('.cmdk button')].find((b) => b.textContent === 'Retry')!); });
    await wait(() => container.querySelector('.cmdk-input'));
    await wait(() => container.querySelector('.cmdk-opt'));
  });

  it('search commands: an empty bar is never shown; the error and Retry are, and the next intent refetches', async () => {
    const load = vi.fn(fail);
    searchChunk.load = load;
    const { container } = render(<App />);
    await act(async () => { fireEvent.keyDown(document, { key: 'k', ctrlKey: true }); });
    await wait(() => container.querySelector('.cmdk .chunkerr'));
    expect(container.querySelector('.cmdk-opt')).toBeNull();
    searchChunk.load = saved.search;
    await act(async () => { fireEvent.click([...container.querySelectorAll<HTMLButtonElement>('.cmdk button')].find((b) => b.textContent === 'Retry')!); });
    await wait(() => container.querySelector('.cmdk-opt'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a failed search chunk is fetched again on the next intent, not stuck', async () => {
    const load = vi.fn(fail);
    searchChunk.load = load;
    const { container } = render(<App />);
    await act(async () => { fireEvent.pointerOver(container.querySelector('.studio-head')!); });
    await wait(() => load.mock.calls.length === 1);
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    await act(async () => { fireEvent.pointerOver(container.querySelector('.studio-head')!); });
    await wait(() => load.mock.calls.length === 2);
  });
});
