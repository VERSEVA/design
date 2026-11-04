import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

  it('lists no page anchors in the sidebar (the On this page rail and the command bar carry them)', () => {
    window.history.replaceState(null, '', '/assets');
    render(<App />);
    const side = screen.getByRole('navigation', { name: 'Studio' });
    expect(side.querySelector('a[href^="/assets#"]')).toBeNull();
  });

  it('offers a select navigator carrying pages and chapters', () => {
    render(<App />);
    const sel = screen.getByLabelText('Go to') as HTMLSelectElement;
    const values = [...sel.options].map((o) => o.value);
    expect(values).toContain('/foundations');
    expect(values).toContain('/assets');
    expect(values).toContain('/components');
    expect(values).toContain('/gallery');
  });

  it('focuses the page heading and sets the title after navigating', async () => {
    render(<App />);
    await act(async () => { navigate('/foundations'); });
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Foundations');
    expect(document.activeElement).toBe(h1);
    expect(document.title).toBe('Foundations: color, type, radius and motion tokens');
  });

});
