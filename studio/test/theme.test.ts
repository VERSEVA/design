import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyTheme, readStored, resolveMode } from '../src/theme';

const mq = (light: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({
    matches: q.includes('light') ? light : false,
    media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }) as MediaQueryList);

describe('theme state', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.brand;
    delete document.documentElement.dataset.theme;
    vi.restoreAllMocks();
  });

  it('persists and reads back brand and mode', () => {
    mq(false);
    applyTheme({ brand: 'cobalt', mode: 'light' });
    expect(readStored()).toEqual({ brand: 'cobalt', mode: 'light' });
    expect(document.documentElement.dataset.brand).toBe('cobalt');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('reads the legacy site values', () => {
    localStorage.setItem('verseva-theme', '');
    expect(readStored().mode).toBe('dark');
    localStorage.setItem('verseva-theme', 'light');
    expect(readStored().mode).toBe('light');
  });

  it('resolves system mode from the media query', () => {
    mq(true);
    expect(resolveMode('system')).toBe('light');
    mq(false);
    expect(resolveMode('system')).toBe('dark');
  });

  it('fires vsv-theme exactly once per apply', () => {
    mq(false);
    const spy = vi.fn();
    window.addEventListener('vsv-theme', spy);
    applyTheme({ brand: '', mode: 'dark' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.brand).toBeUndefined();
    window.removeEventListener('vsv-theme', spy);
  });
});
