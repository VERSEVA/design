import * as React from 'react';
import { Menu } from './menu';
import type { MenuItemDef } from './menu';
import { initials, withDefaults } from './console-state';
import { cx } from './cx';

export interface Org {
  id: string;
  name: string;
  /** Your role in this org, shown under the name. */
  role: string;
  /** Square mark for the tile; initials when absent. */
  logo?: React.ReactNode;
  /** Wide wordmark; replaces the tile and name in the expanded trigger. */
  wordmark?: React.ReactNode;
}

export interface OrgSwitcherProps {
  orgs: Org[];
  currentId: string;
  onSwitch: (id: string) => void;
  /** "Organization settings" */
  onSettings?: () => void;
  /** "Members and roles" */
  onMembers?: () => void;
  /** "Billing" */
  onBilling?: () => void;
  /** "Invite people" */
  onInvite?: () => void;
  /** "New organization", after a separator */
  onCreate?: () => void;
  /** Built-in words; English defaults in ORG_SWITCHER_LABELS. */
  labels?: Partial<OrgSwitcherLabels>;
  className?: string;
}

export const ORG_SWITCHER_LABELS = {
  menu: 'Organizations',
  settings: 'Organization settings',
  members: 'Members and roles',
  billing: 'Billing',
  invite: 'Invite people',
  create: 'New organization',
};
export type OrgSwitcherLabels = typeof ORG_SWITCHER_LABELS;

const icon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const CHEV = (
  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></svg>
);
const BUILDING = icon(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" /></>);
const USERS = icon(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>);
const CARD = icon(<><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></>);
const USER_PLUS = icon(<><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6" /></>);
const PLUS = icon(<path d="M12 5v14M5 12h14" />);

function Tile({ org }: { org: Org }) {
  return org.logo
    ? <span className="otile" aria-hidden="true">{org.logo}</span>
    : <span className="otile init" aria-hidden="true">{initials(org.name)}</span>;
}

/**
 * Org switcher (top of the console sidebar): logo or initials, the org name
 * and your role; the menu checks the current org and lists only the actions
 * whose handlers you pass. In the rail only the tile shows; the name stays in
 * the accessible name and the rail tip.
 */
export function OrgSwitcher({ orgs, currentId, onSwitch, onSettings, onMembers, onBilling, onInvite, onCreate, labels, className }: OrgSwitcherProps) {
  if (!orgs.length) return null;
  const L = withDefaults(ORG_SWITCHER_LABELS, labels);
  const current = orgs.find((o) => o.id === currentId) ?? orgs[0];

  const items: (MenuItemDef | 'separator')[] = orgs.map((o) => ({
    id: `org:${o.id}`,
    label: o.name,
    icon: <Tile org={o} />,
    checked: o.id === current.id,
    hint: o.id === current.id ? undefined : o.role,
    onSelect: () => onSwitch(o.id),
  }));
  const actions: MenuItemDef[] = [];
  if (onSettings) actions.push({ id: 'action:settings', label: L.settings, icon: BUILDING, onSelect: onSettings });
  if (onMembers) actions.push({ id: 'action:members', label: L.members, icon: USERS, onSelect: onMembers });
  if (onBilling) actions.push({ id: 'action:billing', label: L.billing, icon: CARD, onSelect: onBilling });
  if (onInvite) actions.push({ id: 'action:invite', label: L.invite, icon: USER_PLUS, onSelect: onInvite });
  if (actions.length) items.push('separator', ...actions);
  if (onCreate) items.push('separator', { id: 'action:create', label: L.create, icon: PLUS, onSelect: onCreate });

  const word = current.wordmark != null;

  return (
    <Menu
      className={className}
      label={L.menu}
      listClassName="full"
      items={items}
      renderTrigger={(p) => (
        <button {...p} className={cx('switcher', word && 'word')} data-tip={current.name}>
          <Tile org={current} />
          {word && <span className="oword" aria-hidden="true">{current.wordmark}</span>}
          <span className="oname">{current.name} <small>{current.role}</small></span>
          {CHEV}
        </button>
      )}
    />
  );
}
