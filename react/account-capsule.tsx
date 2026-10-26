import * as React from 'react';
import { Menu } from './menu';
import type { MenuItemDef } from './menu';
import { initials, safeHref, withDefaults } from './console-state';

export interface AccountUser {
  name: string;
  email: string;
  /** Image or node for the avatar; initials when absent. */
  avatar?: React.ReactNode;
}

export interface AccountCapsuleProps {
  user: AccountUser;
  /** "Profile" */
  onProfile?: () => void;
  /** "Appearance" */
  onAppearance?: () => void;
  /** "Sign out", after a separator */
  onSignOut?: () => void;
  /** The gear as a button. */
  onSettings?: () => void;
  /** The gear as a link (wins over onSettings); unsafe schemes render as '#'. */
  settingsHref?: string;
  /** Default "Settings". */
  settingsLabel?: string;
  /** Built-in words; English defaults in ACCOUNT_CAPSULE_LABELS. */
  labels?: Partial<AccountCapsuleLabels>;
  className?: string;
}

export const ACCOUNT_CAPSULE_LABELS = { menu: 'Account', profile: 'Profile', appearance: 'Appearance', signOut: 'Sign out' };
export type AccountCapsuleLabels = typeof ACCOUNT_CAPSULE_LABELS;

const icon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const USER = icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
const MOON = icon(<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />);
const LOGOUT = icon(<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />);
const GEAR = icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>);

/**
 * Account capsule (sidebar foot): avatar, name and email open the account
 * menu (upward); the gear is its own tab stop. Items render only for the
 * handlers you pass. In the rail the capsule stacks and only the avatar and
 * gear show; names stay in the accessible names and the rail tips.
 */
export function AccountCapsule({ user, onProfile, onAppearance, onSignOut, onSettings, settingsHref, settingsLabel = 'Settings', labels, className }: AccountCapsuleProps) {
  const L = withDefaults(ACCOUNT_CAPSULE_LABELS, labels);
  const items: (MenuItemDef | 'separator')[] = [];
  if (onProfile) items.push({ id: 'profile', label: L.profile, icon: USER, onSelect: onProfile });
  if (onAppearance) items.push({ id: 'appearance', label: L.appearance, icon: MOON, onSelect: onAppearance });
  if (onSignOut) {
    if (items.length) items.push('separator');
    items.push({ id: 'signout', label: L.signOut, icon: LOGOUT, onSelect: onSignOut });
  }

  /* The gear sits inside the menu root, so Menu's outside-pointer close never sees it: closeMenu closes an open menu on pointerdown. */
  const gear = (closeMenu?: () => void) => settingsHref !== undefined
    ? <a className="ibtn" href={safeHref(settingsHref)} aria-label={settingsLabel} data-tip={settingsLabel} onPointerDown={closeMenu}>{GEAR}</a>
    : onSettings
      ? <button type="button" className="ibtn" aria-label={settingsLabel} data-tip={settingsLabel} onPointerDown={closeMenu} onClick={onSettings}>{GEAR}</button>
      : null;

  const face = (
    <>
      <span className="avc" aria-hidden="true">{user.avatar ?? initials(user.name)}</span>
      <span className="who"><b>{user.name}</b> <small>{user.email}</small></span>
    </>
  );

  if (!items.length) {
    return (
      <div className={className ? `menu ${className}` : 'menu'}>
        <div className="capsule">
          <div className="acct" data-tip={user.name}>{face}</div>
          {gear()}
        </div>
      </div>
    );
  }

  return (
    <Menu
      className={className}
      label={L.menu}
      listClassName="up full"
      items={items}
      renderTrigger={(p, open) => (
        <div className="capsule">
          <button {...p} className="acct" data-tip={user.name}>{face}</button>
          {gear(open ? p.onClick : undefined)}
        </div>
      )}
    />
  );
}
