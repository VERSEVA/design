import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { Menu, type MenuItemDef } from '../../react/menu';

const noop = () => {};
const items: (MenuItemDef | 'separator')[] = [
  { label: 'Rename', onSelect: noop },
  { label: 'Archive', onSelect: noop, disabled: true },
  'separator',
  { label: 'Duplicate', onSelect: noop },
  { label: 'Delete', onSelect: noop, danger: true },
];

const trigger = () => screen.getByRole('button', { name: 'Actions' });
const item = (name: string) => screen.getByRole('menuitem', { name, hidden: true });
const focused = (el: HTMLElement) => waitFor(() => expect(document.activeElement).toBe(el));
const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k });

describe('Menu', () => {
  it('trigger carries aria-haspopup=menu and aria-controls pointing at the role=menu list', () => {
    render(<Menu trigger="Actions" items={items} label="Row actions" />);
    const t = trigger();
    expect(t.getAttribute('aria-haspopup')).toBe('menu');
    const list = screen.getByRole('menu', { hidden: true });
    expect(list.id).toBeTruthy();
    expect(t.getAttribute('aria-controls')).toBe(list.id);
    expect(list.getAttribute('aria-label')).toBe('Row actions');
  });

  it('aria-expanded toggles with the open state and the list hides when closed', async () => {
    render(<Menu trigger="Actions" items={items} />);
    const t = trigger();
    const list = screen.getByRole('menu', { hidden: true });
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(list.hidden).toBe(true);
    fireEvent.click(t);
    expect(t.getAttribute('aria-expanded')).toBe('true');
    expect(list.hidden).toBe(false);
    fireEvent.click(t);
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(list.hidden).toBe(true);
  });

  it('ArrowDown/ArrowUp move focus between enabled items, skip disabled ones, and wrap', async () => {
    render(<Menu trigger="Actions" items={items} />);
    fireEvent.click(trigger());
    await focused(item('Rename'));
    key('ArrowDown');
    await focused(item('Duplicate'));
    key('ArrowDown');
    await focused(item('Delete'));
    key('ArrowDown');
    await focused(item('Rename'));
    key('ArrowUp');
    await focused(item('Delete'));
    key('ArrowUp');
    await focused(item('Duplicate'));
    key('ArrowUp');
    await focused(item('Rename'));
    expect(item('Archive').hasAttribute('disabled')).toBe(true);
  });

  it('Escape closes the menu and returns focus to the trigger', async () => {
    render(<Menu trigger="Actions" items={items} />);
    const t = trigger();
    fireEvent.click(t);
    await focused(item('Rename'));
    key('ArrowDown');
    await focused(item('Duplicate'));
    key('Escape');
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('menu', { hidden: true }).hidden).toBe(true);
    await focused(t);
  });

  it('items with a checked prop render role=menuitemradio with matching aria-checked; others stay menuitem', async () => {
    const onSelect = vi.fn();
    render(
      <Menu
        trigger="Actions"
        items={[
          { label: 'Light', onSelect, checked: false },
          { label: 'Dark', onSelect, checked: true },
          { label: 'Settings', onSelect },
        ]}
      />,
    );
    const radios = screen.getAllByRole('menuitemradio', { hidden: true });
    expect(radios.map((r) => [r.textContent, r.getAttribute('aria-checked')])).toEqual([
      ['Light', 'false'],
      ['Dark', 'true'],
    ]);
    const plain = item('Settings');
    expect(plain.hasAttribute('aria-checked')).toBe(false);
    fireEvent.click(trigger());
    await focused(screen.getByRole('menuitemradio', { name: 'Dark' }));
  });
});
