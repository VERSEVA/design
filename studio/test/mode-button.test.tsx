// Mode is one icon button: light, then dark, then system, then light. Its icon is drawn
// from <html data-mode> (set by the head script before first paint), so it is never wrong.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { App } from '../src/App';
import { applyTheme, initTheme } from '../src/theme';

const css = fs.readFileSync(path.resolve(__dirname, '../src/studio.css'), 'utf8');
const modeBtn = () => document.querySelector<HTMLButtonElement>('button.modebtn')!;

describe('mode button', () => {
  beforeEach(() => { localStorage.clear(); window.history.replaceState(null, '', '/'); delete document.documentElement.dataset.mode; });

  it('cycles light, dark, system and names the current and next mode', async () => {
    localStorage.setItem('verseva-theme', 'light');
    initTheme();
    render(<App />);
    await act(async () => {});
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(modeBtn().getAttribute('aria-label')!);
      await act(async () => { fireEvent.click(modeBtn()); });
    }
    expect(seen).toEqual([
      'Theme: light. Switch to dark',
      'Theme: dark. Switch to system',
      'Theme: system. Switch to light',
      'Theme: light. Switch to dark',
    ]);
    expect(localStorage.getItem('verseva-theme')).toBe('dark');
    expect(document.documentElement.dataset.mode).toBe('dark');
  });

  it('announces each change politely', async () => {
    applyTheme({ brand: '', mode: 'system' });
    render(<App />);
    await act(async () => { fireEvent.click(modeBtn()); });
    const live = screen.getByText('Theme: light');
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
  });

  it('carries all three icons and draws the one <html data-mode> names, with a 44px hit area', () => {
    render(<App />);
    for (const m of ['light', 'dark', 'system']) {
      expect(modeBtn().querySelector(`svg.mi-${m}`), m).not.toBeNull();
      expect(css).toContain(`:root[data-mode="${m}"] .modebtn .mi-${m} { display: block; }`);
    }
    expect(css).toMatch(/\.studio-head \.ibtn \{[^}]*width: 44px; height: 44px;/);
    /* no segmented control and no brand chips left in the top bar */
    expect(document.querySelector('.studio-head .seg, .studio-head .fchip')).toBeNull();
  });
});
