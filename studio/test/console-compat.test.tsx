import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { ConsoleNav } from '../../react/console-nav';
import type { NavGroup, NavItem, ConsoleNavProps } from '../../react/console-nav';
import { Menu } from '../../react/menu';
import type { MenuItemDef, MenuProps } from '../../react/menu';
import { Tooltip } from '../../react/tooltip';

/* The 1.2.0 call sites, written exactly as 1.2.0 consumers wrote them. They must typecheck and render unchanged. */
const groups: NavGroup[] = [
  { label: 'Operate', items: [{ label: 'Overview', href: '/overview' }, { label: 'Quotes', href: '/quotes', count: 18 }, { label: 'Holds', href: '/holds', count: 2, hot: true }] },
  { label: 'Insights', items: [{ label: 'Reports', href: '/reports' }] },
];
const renderLink: ConsoleNavProps['renderLink'] = (item: NavItem, children: React.ReactNode, active: boolean) => (
  <a href={`#${item.href}`} data-router="yes" className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>{children}</a>
);
const items: MenuProps['items'] = [
  { label: 'Rename', onSelect: () => {} },
  { label: 'Duplicate', onSelect: () => {}, icon: <svg aria-hidden="true" /> },
  'separator',
  { label: 'Delete', onSelect: () => {}, danger: true } satisfies MenuItemDef,
];

describe('1.2.0 copies keep compiling and rendering', () => {
  beforeEach(() => localStorage.clear());

  it('ConsoleNav flat: sgroups, eyebrows, aria-current on the longest match', () => {
    const { container } = render(<ConsoleNav groups={groups} activeHref="/quotes/42" />);
    expect(container.querySelectorAll('.sgroup')).toHaveLength(2);
    expect(container.querySelectorAll('div.grouplabel')).toHaveLength(2);
    expect(container.querySelector('.sgroup-head')).toBeNull();
    const current = container.querySelector('a[aria-current="page"]');
    expect(current?.getAttribute('href')).toBe('/quotes');
    expect(current?.className).toBe('active');
    expect(container.querySelector('.cnt.hot')?.textContent).toBe('2');
  });

  it('ConsoleNav accordion: heads toggle hidden and persist the shut set under the storage key', () => {
    const { container } = render(<ConsoleNav groups={groups} activeHref="/overview" accordion storageKey="legacy.shut" />);
    const heads = container.querySelectorAll<HTMLButtonElement>('.sgroup-head');
    expect(heads).toHaveLength(2);
    fireEvent.click(heads[1]);
    expect(heads[1].getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#snav-insights')?.hasAttribute('hidden')).toBe(true);
    expect(localStorage.getItem('legacy.shut')).toBe('["Insights"]');
    fireEvent.click(heads[0]);
    expect(heads[0].getAttribute('aria-expanded')).toBe('true');
  });

  it('ConsoleNav three-argument renderLink still receives the children and the active flag', () => {
    const { container } = render(<ConsoleNav groups={groups} activeHref="/holds" renderLink={renderLink} />);
    expect(container.querySelectorAll('a[data-router="yes"]')).toHaveLength(4);
    expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain('Holds');
  });

  it('Menu with trigger: secondary sm button, menuitems, separator, danger', () => {
    const { container, getByRole } = render(<Menu trigger="Actions" items={items} />);
    const trigger = getByRole('button', { name: 'Actions' });
    expect(trigger.className).toBe('btn btn-secondary sm');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    fireEvent.click(trigger);
    expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
    expect(container.querySelector('[role="menuitemradio"]')).toBeNull();
    expect(container.querySelector('[role="separator"]')).not.toBeNull();
    expect(container.querySelector('.menu-item.danger')?.textContent).toBe('Delete');
  });

  it('Tooltip still describes its child', () => {
    const { getByRole } = render(<Tooltip text="Copies the link"><button type="button">Share</button></Tooltip>);
    const button = getByRole('button', { name: 'Share' });
    const tip = document.getElementById(button.getAttribute('aria-describedby')!);
    expect(tip?.textContent).toBe('Copies the link');
  });
});
