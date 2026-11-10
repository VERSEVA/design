import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import * as React from 'react';
import { Tabs } from '../../react/tabs';
import type { TabItem } from '../../react/tabs';

const ITEMS: TabItem[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'usage', label: 'Usage' },
  { value: 'billing', label: 'Billing' },
];

/* A consumer wired the way the panelId doc comment says: one role="tabpanel" per tab. */
function Harness({ initial = 'overview' }: { initial?: string }) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      <Tabs items={ITEMS} value={value} onChange={setValue} panelId="sec" aria-label="Sections" />
      {ITEMS.map((i) => (
        <div
          key={i.value}
          id={`sec-${i.value}`}
          role="tabpanel"
          aria-labelledby={`sec-${i.value}-tab`}
          hidden={i.value !== value}
        >
          {i.label} body
        </div>
      ))}
    </>
  );
}

const tabs = () => screen.getAllByRole('tab');
const selected = () => tabs().filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent);

describe('Tabs', () => {
  it('marks only the selected tab aria-selected and in the tab order', () => {
    render(<Harness initial="usage" />);
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs().map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('shows the matching tabpanel and hides the others', () => {
    render(<Harness initial="usage" />);
    expect(screen.getAllByRole('tabpanel').map((p) => p.textContent)).toEqual(['Usage body']);
    fireEvent.click(screen.getByRole('tab', { name: 'Billing' }));
    expect(selected()).toEqual(['Billing']);
    expect(screen.getAllByRole('tabpanel').map((p) => p.textContent)).toEqual(['Billing body']);
  });

  it('moves selection and focus with arrow keys, wrapping, and Home/End', () => {
    render(<Harness />);
    const list = screen.getByRole('tablist', { name: 'Sections' });
    tabs()[0].focus();
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selected()).toEqual(['Usage']);
    expect(document.activeElement).toBe(tabs()[1]);
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selected()).toEqual(['Overview']);
    expect(document.activeElement).toBe(tabs()[0]);
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(selected()).toEqual(['Billing']);
    expect(document.activeElement).toBe(tabs()[2]);
    fireEvent.keyDown(list, { key: 'Home' });
    expect(selected()).toEqual(['Overview']);
    fireEvent.keyDown(list, { key: 'End' });
    expect(selected()).toEqual(['Billing']);
    expect(screen.getByRole('tabpanel').textContent).toBe('Billing body');
  });

  it('ignores other keys', () => {
    render(<Harness />);
    const list = screen.getByRole('tablist');
    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    list.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(selected()).toEqual(['Overview']);
  });

  it('names each tab and panel accessibly through aria-controls and aria-labelledby', () => {
    render(<Harness />);
    for (const item of ITEMS) {
      const tab = screen.getByRole('tab', { name: item.label });
      const panel = document.getElementById(tab.getAttribute('aria-controls')!)!;
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
    }
    expect(screen.getByRole('tabpanel', { name: 'Overview' }).textContent).toBe('Overview body');
  });

  it('omits aria-controls and tab ids when no panelId is given', () => {
    render(<Tabs items={ITEMS} value="overview" onChange={() => {}} />);
    for (const tab of tabs()) {
      expect(tab.hasAttribute('aria-controls')).toBe(false);
      expect(tab.hasAttribute('id')).toBe(false);
    }
  });
});
