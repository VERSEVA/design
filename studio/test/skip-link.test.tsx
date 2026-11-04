// WCAG 2.4.1: every route opens with a "Skip to content" link, the first focusable element
// of the shell, in the pre-rendered HTML and after hydration; activating it moves focus to
// <main> through the router's focusTarget, without touching the URL.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { App } from '../src/App';
import { renderApp } from '../src/entry-server';
import { navigate } from '../src/shell/router';
import { LIVE_ROUTES } from '../src/shell/routes-table';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary,[tabindex]:not([tabindex="-1"])';
const firstFocusable = (root: ParentNode) => root.querySelector<HTMLElement>(FOCUSABLE);

describe('skip link', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/'); });
  afterEach(() => cleanup());

  it.each(LIVE_ROUTES.map((r) => r.path))('is the first focusable element of the pre-rendered shell on %s', (p) => {
    const doc = new DOMParser().parseFromString(`<div id="studio-root">${renderApp(p)}</div>`, 'text/html');
    const first = firstFocusable(doc.querySelector('.studio')!);
    expect(first?.outerHTML).toBe('<a class="studio-skip" href="#main">Skip to content</a>');
    expect(doc.getElementById('main')?.tagName).toBe('MAIN');
  });

  it('moves focus to main with focusTarget, leaving the URL alone', async () => {
    const { container } = render(<App />);
    await act(async () => { navigate('/components'); });
    const skip = firstFocusable(container.querySelector('.studio')!)!;
    expect(skip.textContent).toBe('Skip to content');
    skip.focus();
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    await act(async () => { skip.dispatchEvent(ev); });
    const main = container.querySelector<HTMLElement>('main#main')!;
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute('tabindex')).toBe('-1');
    expect(window.location.pathname + window.location.hash).toBe('/components');
  });

  it('is visually hidden until focused, then shows with the focus ring', () => {
    const css = fs.readFileSync(path.join(__dirname, '../src/studio.css'), 'utf8').replace(/\s+/g, ' ');
    const rule = (sel: string) => css.match(new RegExp(`${sel.replace(/[.:()]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';
    expect(rule('.studio-skip:not(:focus)')).toContain('clip-path: inset(50%)');
    expect(rule('.studio-skip:focus-visible')).toContain('box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--focus)');
  });
});
