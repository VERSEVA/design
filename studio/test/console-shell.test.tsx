import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import * as React from 'react';
import axe from 'axe-core';
import { Menu } from '../../react/menu';
import { ConsoleNav } from '../../react/console-nav';
import type { NavGroup } from '../../react/console-nav';
import { OrgSwitcher } from '../../react/org-switcher';
import type { Org } from '../../react/org-switcher';
import { AccountCapsule } from '../../react/account-capsule';
import { ConsoleTopbar, ConsoleSearch } from '../../react/console-topbar';
import type { NotificationItem } from '../../react/console-topbar';
import { WhatsNew, PlatformMark, useWhatsNew } from '../../react/whats-new';
import type { Release } from '../../react/whats-new';
import { ConsoleShell } from '../../react/console-shell';

const ICON = <svg aria-hidden="true"><path d="M0 0h1" /></svg>;

beforeEach(() => localStorage.clear());

describe('Menu additions', () => {
  it('checked items are radios with a tick, hints render, disabled items are skipped, focus starts on the checked item', () => {
    const { getByRole, container } = render(
      <Menu
        trigger="Org"
        label="Organizations"
        items={[
          { label: 'Alpha', onSelect: () => {}, checked: false, hint: 'Admin' },
          { label: 'Beta', onSelect: () => {}, checked: true },
          { label: 'Gamma', onSelect: () => {}, disabled: true },
          { label: 'Delta', onSelect: () => {} },
        ]}
      />
    );
    fireEvent.click(getByRole('button', { name: 'Org' }));
    const menu = getByRole('menu', { name: 'Organizations' });
    expect(menu.querySelectorAll('[role="menuitemradio"]')).toHaveLength(2);
    expect(menu.querySelectorAll('.tick')).toHaveLength(2);
    expect(menu.querySelector('.mhint')?.textContent).toBe('Admin');
    const beta = getByRole('menuitemradio', { name: 'Beta' });
    expect(beta.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(beta);
    fireEvent.keyDown(beta, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toBe('Delta');
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement?.textContent).toContain('Alpha');
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement?.textContent).toBe('Delta');
    expect(container.querySelector('.menu-list')?.id).toBe(getByRole('button', { name: 'Org' }).getAttribute('aria-controls'));
  });

  it('renderTrigger, align end, listClassName, onOpenChange; Escape returns focus; select refocuses before onSelect', () => {
    const order: string[] = [];
    const onOpenChange = vi.fn();
    const { getByRole, container } = render(
      <Menu
        align="end"
        listClassName="up full"
        onOpenChange={onOpenChange}
        items={[{ label: 'Profile', onSelect: () => order.push(`select:${(document.activeElement as HTMLElement).className}`) }]}
        renderTrigger={(p, open) => <button {...p} className="ibtn" aria-label="Account">{open ? 'open' : 'shut'}</button>}
      />
    );
    expect(container.firstElementChild?.className).toBe('menu end');
    const trigger = getByRole('button', { name: 'Account' });
    fireEvent.click(trigger);
    expect(trigger.textContent).toBe('open');
    expect(container.querySelector('.menu-list')?.className).toBe('menu-list up full');
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    fireEvent.click(trigger);
    fireEvent.click(getByRole('menuitem', { name: 'Profile' }));
    expect(order).toEqual(['select:ibtn']);
    expect(getByRole('button', { name: 'Account' }).getAttribute('aria-expanded')).toBe('false');
  });
});

const groups: NavGroup[] = [
  { label: 'Operate', items: [
    { label: 'Overview', href: '#overview', icon: ICON },
    { label: 'Quotes', href: '#quotes', icon: ICON, count: 18 },
    { label: 'Holds', href: '#holds', count: 2, hot: true },
  ] },
  { label: 'Relations', items: [{ label: 'Clients', href: '#clients', icon: ICON }] },
];

describe('ConsoleNav collapsed and icons', () => {
  it('rail: no heads, every group open, labels in .nl, one-letter .ni for icon-less items', () => {
    localStorage.setItem('verseva.nav.shut', '["Relations"]');
    const { container } = render(<ConsoleNav groups={groups} activeHref="#overview" accordion collapsed />);
    expect(container.querySelector('.sgroup-head')).toBeNull();
    expect([...container.querySelectorAll('.sgroup')].every((g) => g.getAttribute('data-open') === 'true')).toBe(true);
    expect([...container.querySelectorAll('.snav')].some((n) => n.hasAttribute('hidden'))).toBe(false);
    expect([...container.querySelectorAll('.nl')].map((n) => n.textContent)).toEqual(['Overview', 'Quotes', 'Holds', 'Clients']);
    const ni = container.querySelector('a[href="#holds"] .ni');
    expect(ni?.textContent).toBe('H');
    expect(ni?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('.ni')).toHaveLength(1);
    expect(localStorage.getItem('verseva.nav.shut')).toBe('["Relations"]');
  });

  it('expanded with icons={false} drops icons; the rail always shows them', () => {
    const { container, rerender } = render(<ConsoleNav groups={groups} activeHref="#overview" icons={false} />);
    expect(container.querySelector('.snav svg')).toBeNull();
    expect(container.querySelector('.ni')).toBeNull();
    rerender(<ConsoleNav groups={groups} activeHref="#overview" icons={false} collapsed />);
    expect(container.querySelectorAll('.snav svg')).toHaveLength(3);
  });
});

const orgs: Org[] = [
  { id: 'nw', name: 'Northwind Labs', role: 'Owner', logo: ICON },
  { id: 'kc', name: 'Kestrel Co', role: 'Admin' },
  { id: 'os', name: 'Orbit Studio', role: 'Member' },
];

describe('OrgSwitcher', () => {
  it('names the current org and role, checks it, hints other roles, lists only handled actions', () => {
    const onSwitch = vi.fn();
    const { getByRole, container } = render(<OrgSwitcher orgs={orgs} currentId="nw" onSwitch={onSwitch} onSettings={() => {}} onCreate={() => {}} />);
    const trigger = getByRole('button', { name: 'Northwind Labs Owner' });
    expect(trigger.className).toBe('switcher');
    expect(trigger.getAttribute('data-tip')).toBe('Northwind Labs');
    fireEvent.click(trigger);
    expect(getByRole('menuitemradio', { name: 'Northwind Labs' }).getAttribute('aria-checked')).toBe('true');
    expect(getByRole('menuitemradio', { name: 'Kestrel Co Admin' }).getAttribute('aria-checked')).toBe('false');
    expect(container.querySelector('.menu-item .otile.init')?.textContent).toBe('KC');
    const labels = [...container.querySelectorAll('[role="menuitem"]')].map((n) => n.textContent);
    expect(labels).toEqual(['Organization settings', 'New organization']);
    const list = container.querySelector('.menu-list')!;
    expect([...list.children].map((n) => (n.getAttribute('role') === 'separator' ? '|' : 'i')).join('')).toBe('iii|i|i');
    fireEvent.click(getByRole('menuitemradio', { name: 'Orbit Studio Member' }));
    expect(onSwitch).toHaveBeenCalledWith('os');
  });

  it('falls back to the first org, uses initials, marks wordmarks, renders nothing without orgs', () => {
    const { getByRole, container, rerender } = render(<OrgSwitcher orgs={orgs.slice(1)} currentId="missing" onSwitch={() => {}} />);
    expect(getByRole('button', { name: 'Kestrel Co Admin' }).querySelector('.otile.init')?.textContent).toBe('KC');
    expect(container.querySelector('[role="separator"]')).toBeNull();
    rerender(<OrgSwitcher orgs={[{ ...orgs[0], wordmark: <svg aria-hidden="true" /> }]} currentId="nw" onSwitch={() => {}} />);
    expect(container.querySelector('.switcher')?.className).toBe('switcher word');
    expect(container.querySelector('.oword')).not.toBeNull();
    rerender(<OrgSwitcher orgs={[]} currentId="nw" onSwitch={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('labels rename the menu and its actions', () => {
    const { getByRole } = render(<OrgSwitcher orgs={orgs} currentId="nw" onSwitch={() => {}} onSettings={() => {}} labels={{ menu: 'Workspaces', settings: 'Workspace settings' }} />);
    fireEvent.click(getByRole('button', { name: 'Northwind Labs Owner' }));
    expect(getByRole('menu', { name: 'Workspaces' })).toBeTruthy();
    expect(getByRole('menuitem', { name: 'Workspace settings' })).toBeTruthy();
  });
});

const user = { name: 'Kai Webb', email: 'kai@northwind.example' };

describe('AccountCapsule', () => {
  it('menu opens upward with only handled items; the gear is its own named control', () => {
    const { getByRole, container } = render(<AccountCapsule user={user} onProfile={() => {}} onSignOut={() => {}} settingsHref="/settings" />);
    const acct = getByRole('button', { name: 'Kai Webb kai@northwind.example' });
    expect(container.querySelector('.avc')?.textContent).toBe('KW');
    expect(getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('/settings');
    fireEvent.click(acct);
    expect(getByRole('menu', { name: 'Account' }).className).toBe('menu-list up full');
    expect([...container.querySelectorAll('[role="menuitem"]')].map((n) => n.textContent)).toEqual(['Profile', 'Sign out']);
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(1);
  });

  it('no gear without a handler; a button gear with one', () => {
    const onSettings = vi.fn();
    const { queryByRole, getByRole, rerender } = render(<AccountCapsule user={user} onSignOut={() => {}} />);
    expect(queryByRole('button', { name: 'Settings' })).toBeNull();
    rerender(<AccountCapsule user={user} onSignOut={() => {}} onSettings={onSettings} settingsLabel="Preferences" />);
    fireEvent.click(getByRole('button', { name: 'Preferences' }));
    expect(onSettings).toHaveBeenCalled();
  });

  it('labels rename the menu and items; the gear closes an open account menu', () => {
    const onSettings = vi.fn();
    const { getByRole, container } = render(<AccountCapsule user={user} onProfile={() => {}} onSignOut={() => {}} onSettings={onSettings} labels={{ menu: 'You', signOut: 'Log out' }} />);
    const acct = getByRole('button', { name: 'Kai Webb kai@northwind.example' });
    fireEvent.click(acct);
    expect(getByRole('menu', { name: 'You' })).toBeTruthy();
    expect(getByRole('menuitem', { name: 'Log out' })).toBeTruthy();
    const gear = getByRole('button', { name: 'Settings' });
    fireEvent.pointerDown(gear);
    fireEvent.click(gear);
    expect(container.querySelector('.menu-list')?.hasAttribute('hidden')).toBe(true);
    expect(acct.getAttribute('aria-expanded')).toBe('false');
    expect(onSettings).toHaveBeenCalled();
  });
});

const notes: NotificationItem[] = [
  { id: 'n1', text: 'Q-2081 verified by M. Reyes', at: '2 min ago', unread: true },
  { id: 'n2', text: 'Machine M-14 placed on hold', at: '1 hour ago', unread: true },
  { id: 'n3', text: 'Harbor Botanics replied to Q-2080', at: '3 hours ago', unread: true },
  { id: 'n4', text: 'You were added to Kestrel Co', at: 'Yesterday', unread: false },
];

describe('ConsoleTopbar', () => {
  it('bell names the unread count, badges it, opens a labelled dialog, Escape returns focus to the bell', () => {
    const { getByRole, container } = render(<ConsoleTopbar crumbs={[{ label: 'Operate', href: '#o' }, { label: 'Overview' }]} notifications={notes} onMarkAllRead={() => {}} />);
    expect(getByRole('navigation', { name: 'Breadcrumb' }).querySelector('[aria-current="page"]')?.textContent).toBe('Overview');
    const bell = getByRole('button', { name: 'Notifications, 3 unread' });
    expect(bell.querySelector('.num')?.textContent).toBe('3');
    fireEvent.click(bell);
    const panel = getByRole('dialog', { name: 'Notifications' });
    expect(panel.hasAttribute('hidden')).toBe(false);
    expect(document.activeElement).toBe(getByRole('button', { name: 'Mark all read' }));
    expect(container.querySelectorAll('.notif.unread')).toHaveLength(3);
    expect(container.querySelectorAll('.notif .sr-only')).toHaveLength(3);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(bell);
  });

  it('99+ badge, Mark all read disabled at zero, empty state, no bell without notifications', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ id: `n${i}`, text: `Item ${i}`, at: 'now', unread: true }));
    const { getByRole, queryByRole, container, rerender } = render(<ConsoleTopbar crumbs={[{ label: 'Overview' }]} notifications={many} />);
    expect(getByRole('button', { name: 'Notifications, 120 unread' }).querySelector('.num')?.textContent).toBe('99+');
    rerender(<ConsoleTopbar crumbs={[{ label: 'Overview' }]} notifications={[]} onMarkAllRead={() => {}} />);
    const bell = getByRole('button', { name: 'Notifications' });
    expect(bell.querySelector('.num')).toBeNull();
    fireEvent.click(bell);
    expect((getByRole('button', { name: 'Mark all read' }) as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('.panel-empty')?.textContent).toBe('No notifications');
    rerender(<ConsoleTopbar crumbs={[{ label: 'Overview' }]} />);
    expect(queryByRole('button', { name: /Notifications/ })).toBeNull();
    expect(queryByRole('button', { name: /Guides/ })).toBeNull();
  });

  it("guides button carries the What's new dot; the item shows the version and opens", () => {
    const onOpen = vi.fn();
    const { getByRole, container } = render(
      <ConsoleTopbar crumbs={[{ label: 'Overview' }]} guides={[{ label: 'Documentation', onSelect: () => {} }, { label: 'Keyboard shortcuts', kbd: '?', onSelect: () => {} }]} whatsNew={{ version: '0.3.0', unread: true, onOpen }} />
    );
    const guides = getByRole('button', { name: "Guides, What's new unread" });
    expect(guides.querySelector('.dot')).not.toBeNull();
    fireEvent.click(guides);
    const item = getByRole('menuitem', { name: "What's new v0.3.0 Unread" });
    expect(container.querySelector('.mhint .ver')?.textContent).toBe('v0.3.0');
    expect(container.querySelector('.mhint kbd')?.textContent).toBe('?');
    fireEvent.click(item);
    expect(onOpen).toHaveBeenCalled();
    expect(document.activeElement).toBe(guides);
  });

  it('ConsoleSearch: Ctrl+K focuses the input from anywhere; Enter submits', () => {
    const onSubmit = vi.fn();
    const { getByRole } = render(<ConsoleSearch placeholder="Search quotes, clients" onSubmit={onSubmit} />);
    const input = getByRole('searchbox', { name: 'Search' }) as HTMLInputElement;
    expect(input.getAttribute('aria-keyshortcuts')).toBe('Meta+K Control+K');
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'Q-2081' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('Q-2081');
  });

  it('labels rename the bell, panel, crumbs and guides; an error replaces the list and offers Try again', () => {
    const onRetry = vi.fn();
    const { getByRole, container } = render(
      <ConsoleTopbar
        crumbs={[{ label: 'Overview' }]}
        notifications={notes}
        notificationsError="Notifications did not load"
        onNotificationsRetry={onRetry}
        guides={[{ label: 'Documentation', onSelect: () => {} }]}
        labels={{ notifications: 'Alerts', notificationsUnread: (n) => `Alerts, ${n} new`, guides: 'Help', breadcrumb: 'Path' }}
      />
    );
    expect(getByRole('navigation', { name: 'Path' })).toBeTruthy();
    expect(getByRole('button', { name: 'Help' })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Alerts, 3 new' }));
    expect(getByRole('dialog', { name: 'Alerts' })).toBeTruthy();
    expect(container.querySelector('.notifs')).toBeNull();
    expect(container.querySelector('.panel-empty span')?.textContent).toBe('Notifications did not load');
    fireEvent.click(getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('a list of plain rows is a named, keyboard-scrollable tab stop; a list of row buttons is not', () => {
    const { container, rerender } = render(<ConsoleTopbar crumbs={[{ label: 'Overview' }]} notifications={notes} />);
    fireEvent.click(container.querySelector('[aria-haspopup="dialog"]')!);
    expect(container.querySelector('.notifs')?.getAttribute('tabindex')).toBe('0');
    expect(container.querySelector('.notifs')?.getAttribute('aria-label')).toBe('Notifications');
    rerender(<ConsoleTopbar crumbs={[{ label: 'Overview' }]} notifications={notes} onNotificationOpen={() => {}} />);
    expect(container.querySelector('.notifs')?.hasAttribute('tabindex')).toBe(false);
  });
});

const releases: Release[] = [
  { version: '0.2.0', date: '2026-09-30', changes: [{ kind: 'fixed', text: 'Rounding on quote totals' }, { kind: 'new', text: 'Quote desk' }] },
  { version: '0.4.0', date: '2026-11-30', changes: [{ kind: 'new', text: 'Staged ahead of deploy' }] },
  { version: '0.3.0', date: '2026-10-23', changes: [{ kind: 'improved', text: 'Sidebar collapses to a rail' }, { kind: 'new', text: 'Machine holds with a reason' }] },
];
const platform = { label: 'Quarry', version: '0.3.0', mark: ICON };

describe('WhatsNew', () => {
  it('closed renders nothing', () => {
    const { container } = render(<WhatsNew open={false} onClose={() => {}} version="0.3.0" releases={releases} />);
    expect(container.innerHTML).toBe('');
  });

  it("dialog labelled What's new; newest first; future release hidden; first visit brightens only the newest", () => {
    const { getByRole, container } = render(<WhatsNew open onClose={() => {}} version="0.3.0" releases={releases} lastSeen={null} />);
    const dialog = getByRole('dialog', { name: "What's new" });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect([...container.querySelectorAll('.relhead h5')].map((n) => n.textContent)).toEqual(['v0.3.0', 'v0.2.0']);
    expect(container.querySelector('.rel:not(.seen) h5')?.textContent).toBe('v0.3.0');
    expect(container.querySelector('.rel.seen h5')?.textContent).toBe('v0.2.0');
    const first = container.querySelector('.rel');
    expect([...first!.querySelectorAll('.badge')].map((b) => `${b.className}:${b.textContent}`)).toEqual(['badge bloom:New', 'badge neutral:Improved']);
    expect([...container.querySelectorAll('.rel.seen .badge')].every((b) => b.className === 'badge neutral')).toBe(true);
    expect(first!.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-23');
    expect(first!.querySelector('time')?.textContent).toBe('Oct 23, 2026');
    expect(document.activeElement).toBe(getByRole('button', { name: 'Close' }));
  });

  it('no releases shows the empty state', () => {
    const { container } = render(<WhatsNew open onClose={() => {}} version="0.3.0" releases={[]} />);
    expect(container.querySelector('.empty')?.textContent).toBe('No release notes');
  });

  it('PlatformMark names label, version and the action', () => {
    const onOpen = vi.fn();
    const { getByRole } = render(<PlatformMark platform={platform} onOpen={onOpen} />);
    const b = getByRole('button', { name: "Quarry v0.3.0, What's new" });
    expect(b.getAttribute('data-tip')).toBe('Quarry v0.3.0');
    expect(b.querySelector('.v')?.textContent).toBe('v0.3.0');
    fireEvent.click(b);
    expect(onOpen).toHaveBeenCalled();
  });

  it('labels, an error with Try again, and a named, focusable scrolling body', () => {
    const onRetry = vi.fn();
    const { getByRole, container } = render(
      <WhatsNew open onClose={() => {}} version="0.3.0" releases={releases} error="Release notes did not load" onRetry={onRetry} labels={{ close: 'Done', retry: 'Reload', body: 'Notes' }} />
    );
    expect(document.activeElement).toBe(getByRole('button', { name: 'Done' }));
    expect(getByRole('region', { name: 'Notes' }).getAttribute('tabindex')).toBe('0');
    expect(container.querySelector('.rel')).toBeNull();
    expect(container.querySelector('.empty span')?.textContent).toBe('Release notes did not load');
    fireEvent.click(getByRole('button', { name: 'Reload' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('PlatformMark focuses itself before opening, so the drawer can return focus to it', () => {
    let focusedAtOpen: Element | null = null;
    const { getByRole } = render(<PlatformMark platform={platform} onOpen={() => { focusedAtOpen = document.activeElement; }} labels={{ action: 'Release notes' }} />);
    const b = getByRole('button', { name: 'Quarry v0.3.0, Release notes' });
    fireEvent.click(b);
    expect(focusedAtOpen).toBe(b);
  });
});

async function noViolations(node: Element) {
  const res = await axe.run(node, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([]);
}

function Shell({ defaultCollapsed, storageKey }: { defaultCollapsed?: boolean; storageKey?: string | null }) {
  const wn = useWhatsNew({ version: platform.version });
  return (
    <>
      <ConsoleShell
        defaultCollapsed={defaultCollapsed}
        storageKey={storageKey}
        head={<OrgSwitcher orgs={orgs} currentId="nw" onSwitch={() => {}} onSettings={() => {}} onCreate={() => {}} />}
        nav={(s) => <ConsoleNav groups={groups} activeHref="#overview" collapsed={s.collapsed} />}
        foot={<><AccountCapsule user={user} onProfile={() => {}} onSignOut={() => {}} onSettings={() => {}} /><PlatformMark platform={platform} onOpen={wn.openDrawer} /></>}
        topbar={
          <ConsoleTopbar
            crumbs={[{ label: 'Operate', href: '#operate' }, { label: 'Overview' }]}
            search={<ConsoleSearch placeholder="Search quotes, clients" />}
            notifications={notes}
            onNotificationOpen={() => {}}
            onMarkAllRead={() => {}}
            guides={[{ label: 'Guides', onSelect: () => {} }, { label: 'Keyboard shortcuts', kbd: '?', onSelect: () => {} }]}
            whatsNew={{ version: platform.version, unread: wn.unread, onOpen: wn.openDrawer }}
          />
        }
      >
        <h1>Overview</h1>
        <input aria-label="Filter" />
      </ConsoleShell>
      <WhatsNew open={wn.open} onClose={wn.close} version={platform.version} releases={releases} lastSeen={wn.lastSeen} />
    </>
  );
}

describe('ConsoleShell', () => {
  it('useWhatsNew: unread until opened, writes the seen key, Escape closes and returns focus to the opener', () => {
    const { getByRole, queryByRole } = render(<Shell />);
    const guides = getByRole('button', { name: "Guides, What's new unread" });
    fireEvent.click(guides);
    fireEvent.click(getByRole('menuitem', { name: "What's new v0.3.0 Unread" }));
    expect(localStorage.getItem('verseva.whatsnew.seen')).toBe('0.3.0');
    expect(getByRole('dialog', { name: "What's new" })).toBeTruthy();
    expect(getByRole('button', { name: 'Guides' }).querySelector('.dot')).toBeNull();
    expect(document.activeElement).toBe(getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(queryByRole('dialog', { name: "What's new" })).toBeNull();
    expect(document.activeElement).toBe(getByRole('button', { name: 'Guides' }));
  });

  it('a seen version is not unread on the next visit', () => {
    localStorage.setItem('verseva.whatsnew.seen', '0.3.0');
    const { getByRole } = render(<Shell />);
    expect(getByRole('button', { name: 'Guides' }).querySelector('.dot')).toBeNull();
  });

  it('[ toggles the rail and persists it; ignored inside an input; the row label flips', () => {
    const { container, getByRole } = render(<Shell />);
    const side = container.querySelector('.cside')!;
    expect(side.hasAttribute('data-collapsed')).toBe(false);
    const row = getByRole('button', { name: 'Collapse sidebar' });
    expect(row.getAttribute('aria-controls')).toBe(side.id);
    expect(row.getAttribute('aria-keyshortcuts')).toBe('[');
    fireEvent.keyDown(document.body, { key: '[' });
    expect(side.getAttribute('data-collapsed')).toBe('');
    expect(localStorage.getItem('verseva.shell.collapsed')).toBe('1');
    expect(getByRole('button', { name: 'Expand sidebar' })).toBe(row);
    fireEvent.keyDown(getByRole('textbox', { name: 'Filter' }), { key: '[' });
    expect(side.hasAttribute('data-collapsed')).toBe(true);
    fireEvent.click(row);
    expect(side.hasAttribute('data-collapsed')).toBe(false);
    expect(localStorage.getItem('verseva.shell.collapsed')).toBe('0');
  });

  it('restores the rail from storage; storageKey null writes nothing', () => {
    localStorage.setItem('verseva.shell.collapsed', '1');
    const first = render(<Shell />);
    expect(first.container.querySelector('.cside')?.hasAttribute('data-collapsed')).toBe(true);
    first.unmount();
    localStorage.clear();
    const second = render(<Shell storageKey={null} />);
    fireEvent.keyDown(document.body, { key: '[' });
    expect(second.container.querySelector('.cside')?.hasAttribute('data-collapsed')).toBe(true);
    expect(localStorage.getItem('verseva.shell.collapsed')).toBeNull();
  });

  it('skip link targets main; the sidebar is a named region', () => {
    const { getByRole } = render(<Shell />);
    expect(getByRole('link', { name: 'Skip to content' }).getAttribute('href')).toBe('#main');
    expect(getByRole('main').id).toBe('main');
    expect(getByRole('region', { name: 'Sidebar' })).toBeTruthy();
  });

  it('rail tip shows on keyboard focus with the label and count, hides on blur and Escape, never when expanded', () => {
    const { container } = render(<Shell defaultCollapsed />);
    const tip = container.querySelector<HTMLElement>('.railtip')!;
    expect(tip.getAttribute('aria-hidden')).toBe('true');
    const quotes = container.querySelector<HTMLElement>('a[href="#quotes"]')!;
    act(() => { quotes.focus(); });
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toBe('Quotes · 18');
    expect(tip.style.getPropertyValue('--rt-x')).toBe('12px');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(tip.hidden).toBe(true);
    const sw = container.querySelector<HTMLElement>('.switcher')!;
    act(() => { sw.focus(); });
    expect(tip.textContent).toBe('Northwind Labs');
    act(() => { sw.blur(); });
    expect(tip.hidden).toBe(true);
    fireEvent.pointerOver(container.querySelector('a[href="#holds"]')!);
    expect(tip.textContent).toBe('Holds · 2');
    fireEvent.click(container.querySelector('.collapse-row')!);
    expect(tip.hidden).toBe(true);
    act(() => { quotes.focus(); });
    expect(tip.hidden).toBe(true);
  });

  it('axe: expanded, rail, notifications open and drawer open have zero WCAG A/AA violations', async () => {
    const { container, getByRole } = render(<Shell />);
    await noViolations(container);
    fireEvent.click(getByRole('button', { name: /Notifications/ }));
    await noViolations(container);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    fireEvent.click(getByRole('button', { name: 'Collapse sidebar' }));
    await noViolations(container);
    fireEvent.click(getByRole('button', { name: "Quarry v0.3.0, What's new" }));
    await noViolations(container);
  });

  it('Ctrl+K and [ do nothing while the drawer is open; [ does nothing while the sidebar is hidden', () => {
    const { container, getByRole } = render(<Shell />);
    const side = container.querySelector<HTMLElement>('.cside')!;
    fireEvent.click(getByRole('button', { name: "Quarry v0.3.0, What's new" }));
    const close = getByRole('button', { name: 'Close' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document.activeElement!, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document.activeElement!, { key: '[' });
    expect(side.hasAttribute('data-collapsed')).toBe(false);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    side.style.display = 'none';
    fireEvent.keyDown(document.body, { key: '[' });
    expect(side.hasAttribute('data-collapsed')).toBe(false);
  });

  it('the collapse name and rail tip follow collapseLabel and labels', () => {
    const { container } = render(<ConsoleShell collapseLabel="Fold" labels={{ expandSidebar: 'Unfold sidebar' }} nav={<span />}>x</ConsoleShell>);
    const row = container.querySelector('.collapse-row')!;
    expect(row.getAttribute('aria-label')).toBe('Fold');
    expect(row.getAttribute('data-tip')).toBe('Unfold sidebar');
    fireEvent.click(row);
    expect(row.getAttribute('aria-label')).toBe('Unfold sidebar');
  });
});

describe('WhatsNew focus trap', () => {
  it('Tab from the last focusable wraps to the first; Shift+Tab from the first wraps to the last; the scrolling body is inside the trap', () => {
    const { getByRole, container } = render(<WhatsNew open onClose={() => {}} version="0.3.0" releases={releases} />);
    const close = getByRole('button', { name: 'Close' });
    const body = container.querySelector<HTMLElement>('.drawer-bd')!;
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(body);
    fireEvent.keyDown(body, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
  });

  it('with Try again the retry button is the last stop; focus outside the drawer is pulled back to the first', () => {
    const { getByRole } = render(
      <>
        <button type="button">Outside</button>
        <WhatsNew open onClose={() => {}} version="0.3.0" releases={releases} error="Did not load" onRetry={() => {}} />
      </>
    );
    const close = getByRole('button', { name: 'Close' });
    const retry = getByRole('button', { name: 'Try again' });
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(retry);
    fireEvent.keyDown(retry, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    const outside = getByRole('button', { name: 'Outside' });
    act(() => { outside.focus(); });
    fireEvent.keyDown(outside, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
  });
});

describe('ConsoleShell controlled mode', () => {
  it('ignores storage on mount, never writes storage, fires onCollapsedChange from the row and the [ key, leaves data-collapsed to the parent', () => {
    localStorage.setItem('verseva.shell.collapsed', '1');
    const getSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    const onCollapsedChange = vi.fn();
    try {
      const { container, rerender } = render(<ConsoleShell collapsed={false} onCollapsedChange={onCollapsedChange} nav={<span />}>x</ConsoleShell>);
      const side = container.querySelector<HTMLElement>('.cside')!;
      expect(side.hasAttribute('data-collapsed')).toBe(false);
      expect(getSpy.mock.calls.filter(([k]) => k === 'verseva.shell.collapsed')).toHaveLength(0);
      fireEvent.click(container.querySelector('.collapse-row')!);
      expect(onCollapsedChange).toHaveBeenLastCalledWith(true);
      expect(side.hasAttribute('data-collapsed')).toBe(false);
      fireEvent.keyDown(document.body, { key: '[' });
      expect(onCollapsedChange).toHaveBeenCalledTimes(2);
      expect(onCollapsedChange).toHaveBeenLastCalledWith(true);
      expect(side.hasAttribute('data-collapsed')).toBe(false);
      rerender(<ConsoleShell collapsed onCollapsedChange={onCollapsedChange} nav={<span />}>x</ConsoleShell>);
      expect(side.getAttribute('data-collapsed')).toBe('');
      fireEvent.keyDown(document.body, { key: '[' });
      expect(onCollapsedChange).toHaveBeenLastCalledWith(false);
      expect(side.getAttribute('data-collapsed')).toBe('');
      expect(setSpy).not.toHaveBeenCalled();
      expect(getSpy.mock.calls.filter(([k]) => k === 'verseva.shell.collapsed')).toHaveLength(0);
      expect(localStorage.getItem('verseva.shell.collapsed')).toBe('1');
    } finally {
      getSpy.mockRestore();
      setSpy.mockRestore();
    }
  });
});

describe('Unsafe hrefs and undefined labels', () => {
  it('a javascript: crumb, settings link and nav item render as #', () => {
    const evil = 'javascript:alert(1)';
    const top = render(<ConsoleTopbar crumbs={[{ label: 'Operate', href: evil }, { label: 'Overview' }]} />);
    expect(top.getByRole('link', { name: 'Operate' }).getAttribute('href')).toBe('#');
    top.unmount();
    const cap = render(<AccountCapsule user={user} settingsHref={` ${evil}`} />);
    expect(cap.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('#');
    cap.unmount();
    const nav = render(<ConsoleNav groups={[{ label: 'Operate', items: [{ label: 'Bad', href: evil }, { label: 'Good', href: '/good' }] }]} activeHref="/good" />);
    expect(nav.getByRole('link', { name: 'Bad' }).getAttribute('href')).toBe('#');
    expect(nav.getByRole('link', { name: 'Good' }).getAttribute('href')).toBe('/good');
  });

  it('a labels key set to undefined keeps the default', () => {
    const { getByRole } = render(<ConsoleTopbar crumbs={[{ label: 'Overview' }]} notifications={notes} labels={{ notificationsUnread: undefined, breadcrumb: undefined }} />);
    expect(getByRole('button', { name: 'Notifications, 3 unread' })).toBeTruthy();
    expect(getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
  });
});
