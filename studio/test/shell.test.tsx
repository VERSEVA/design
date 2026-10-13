import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from '../src/App';
import { navigate } from '../src/shell/router';

describe('studio shell', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    localStorage.clear();
  });

  it('marks the active route with aria-current', () => {
    window.history.replaceState(null, '', '/foundations');
    render(<App />);
    const side = screen.getByRole('navigation', { name: 'Studio' });
    const link = side.querySelector('a[href="/foundations"]');
    expect(link?.getAttribute('aria-current')).toBe('page');
    expect(side.querySelector('a[href="/"]')?.getAttribute('aria-current')).toBeNull();
  });

  it('lists the active page anchors in the sidebar', () => {
    window.history.replaceState(null, '', '/assets');
    render(<App />);
    const side = screen.getByRole('navigation', { name: 'Studio' });
    const anchors = [...side.querySelectorAll('a[href^="/assets#"]')].map((a) => a.getAttribute('href'));
    expect(anchors).toEqual(['/assets#objects', '/assets#loops', '/assets#photography', '/assets#video']);
  });

  it('offers a select navigator carrying pages and chapters', () => {
    render(<App />);
    const sel = screen.getByLabelText('Go to') as HTMLSelectElement;
    const values = [...sel.options].map((o) => o.value);
    expect(values).toContain('/foundations');
    expect(values).toContain('/assets');
    expect(values).toContain('/components.html');
  });

  it('focuses the page heading and sets the title after navigating', async () => {
    render(<App />);
    await act(async () => { navigate('/foundations'); });
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Foundations');
    expect(document.activeElement).toBe(h1);
    expect(document.title).toBe('Foundations · VERSEVA Design');
  });

  it('moves the mode tab with arrow keys', () => {
    render(<App />);
    const tabs = screen.getAllByRole('tab').filter((t) => ['Light', 'Dark', 'System'].includes(t.textContent ?? ''));
    const selected = () => tabs.find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;
    const start = selected();
    fireEvent.keyDown(tabs[0].parentElement!, { key: 'ArrowRight' });
    expect(selected()).not.toBe(start);
  });
});
