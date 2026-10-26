import * as React from 'react';
import { Menu } from './menu';
import type { MenuItemDef } from './menu';
import { badgeCount, displayVersion, isSearchShortcut, safeHref, shortcutLabel, unreadCount, withDefaults } from './console-state';
import { cx } from './cx';

export interface Crumb { label: string; href?: string }

/** Named NotificationItem so it never shadows the DOM Notification type. */
export interface NotificationItem {
  id: string;
  text: React.ReactNode;
  /** Display time, e.g. "2 min ago". */
  at: string;
  unread: boolean;
  avatar?: React.ReactNode;
}

export interface GuideItem { label: string; onSelect: () => void; icon?: React.ReactNode; kbd?: string }

export interface ConsoleTopbarProps {
  /** The last crumb is the current page. */
  crumbs: Crumb[];
  /** Usually <ConsoleSearch/>. */
  search?: React.ReactNode;
  /** undefined hides the bell. */
  notifications?: NotificationItem[];
  /** Three skeleton rows in the panel. */
  notificationsLoading?: boolean;
  /** Replaces the list with this message (after loading). */
  notificationsError?: React.ReactNode;
  /** "Try again" under the error when given. */
  onNotificationsRetry?: () => void;
  /** Rows become buttons when given. */
  onNotificationOpen?: (id: string) => void;
  /** "Mark all read", disabled at 0 unread. */
  onMarkAllRead?: () => void;
  /** "View all" footer when given. */
  onViewAllNotifications?: () => void;
  /** undefined with no whatsNew hides the guides button. */
  guides?: GuideItem[];
  whatsNew?: { version: string; unread: boolean; onOpen: () => void };
  /** Extra actions before the bell. */
  end?: React.ReactNode;
  renderLink?: (crumb: Crumb, children: React.ReactNode) => React.ReactNode;
  /** Built-in words; English defaults in CONSOLE_TOPBAR_LABELS. */
  labels?: Partial<ConsoleTopbarLabels>;
  className?: string;
}

export const CONSOLE_TOPBAR_LABELS = {
  breadcrumb: 'Breadcrumb',
  notifications: 'Notifications',
  notificationsUnread: (n: number) => `Notifications, ${n} unread`,
  markAllRead: 'Mark all read',
  noNotifications: 'No notifications',
  viewAll: 'View all',
  loading: 'Loading',
  unread: 'Unread',
  retry: 'Try again',
  guides: 'Guides',
  guidesUnread: "Guides, What's new unread",
  whatsNew: "What's new",
};
export type ConsoleTopbarLabels = typeof CONSOLE_TOPBAR_LABELS;

/** True while an aria-modal dialog (What's new or any app modal) is open: page shortcuts stand down. */
function inOpenModal(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]:not([hidden])') !== null;
}

export interface ConsoleSearchProps {
  placeholder: string;
  /** aria-label, default "Search". */
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Enter. */
  onSubmit?: (value: string) => void;
  /** Default true: Meta+K / Ctrl+K focuses and selects. */
  shortcut?: boolean;
}

const icon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const SEARCH = icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
const BELL = icon(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>);
const HELP = icon(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7M12 17h.01" /></>);
const SPARKLE = icon(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />);

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || '');
}

/** The top bar search: Meta+K / Ctrl+K focuses it from anywhere. The kbd label settles after mount (SSR-stable). */
export function ConsoleSearch({ placeholder, label = 'Search', value, defaultValue, onChange, onSubmit, shortcut = true }: ConsoleSearchProps) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [apple, setApple] = React.useState(false);

  React.useEffect(() => { setApple(isApplePlatform()); }, []);

  React.useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isSearchShortcut(e) || inOpenModal()) return;
      e.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcut]);

  return (
    <div className="searchbox">
      {SEARCH}
      <input
        ref={ref}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        aria-keyshortcuts={shortcut ? 'Meta+K Control+K' : undefined}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) { e.preventDefault(); onSubmit(e.currentTarget.value); }
        }}
      />
      {shortcut && <kbd aria-hidden="true">{shortcutLabel(apple)}</kbd>}
    </div>
  );
}

interface NotificationsProps {
  items: NotificationItem[];
  loading: boolean;
  error?: React.ReactNode;
  onRetry?: () => void;
  onOpen?: (id: string) => void;
  onMarkAllRead?: () => void;
  onViewAll?: () => void;
  L: ConsoleTopbarLabels;
}

/** Bell + a non-modal dialog panel. Escape returns focus to the bell; Tab out or an outside pointer closes. */
function Notifications({ items, loading, error, onRetry, onOpen, onMarkAllRead, onViewAll, L }: NotificationsProps) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  const titleId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const bellRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const unread = unreadCount(items);
  const badge = badgeCount(unread);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) bellRef.current?.focus();
  };

  React.useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('.panel-hd button:not(:disabled)')
      ?? panel?.querySelector<HTMLElement>('.notifs button, .notifs a, .panel-empty button');
    (first ?? panel)?.focus();
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const row = (n: NotificationItem) => {
    const inner = (
      <>
        <span className="avc" aria-hidden="true">{n.avatar ?? BELL}</span>
        <span className="tx">{n.text}{' '}<span className="metaline"><time>{n.at}</time></span></span>
        {n.unread && <>{' '}<span className="sr-only">{L.unread}</span><span className="udot" aria-hidden="true" /></>}
      </>
    );
    const cls = cx('notif', n.unread && 'unread');
    return onOpen
      ? <button type="button" className={cls} onClick={() => { close(true); onOpen(n.id); }}>{inner}</button>
      : <div className={cls}>{inner}</div>;
  };

  return (
    <div
      className="menu end"
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) { e.preventDefault(); close(true); }
      }}
      onBlur={(e) => {
        const to = e.relatedTarget;
        if (open && to instanceof Node && !rootRef.current?.contains(to)) setOpen(false);
      }}
    >
      <button
        ref={bellRef}
        type="button"
        className="ibtn"
        aria-label={unread ? L.notificationsUnread(unread) : L.notifications}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {BELL}
        {badge && <span className="num" aria-hidden="true">{badge}</span>}
      </button>
      <div className="menu-list panel" id={panelId} role="dialog" aria-labelledby={titleId} tabIndex={-1} hidden={!open} ref={panelRef}>
        <div className="panel-hd">
          <h4 id={titleId}>{L.notifications}</h4>
          {onMarkAllRead && (
            <button type="button" disabled={unread === 0} onClick={() => { onMarkAllRead(); panelRef.current?.focus(); }}>
              {L.markAllRead}
            </button>
          )}
        </div>
        {loading ? (
          <div className="notifs" aria-busy="true">
            <span className="sr-only">{L.loading}</span>
            {[0, 1, 2].map((i) => <div className="notif" key={i} aria-hidden="true"><span className="skel" /></div>)}
          </div>
        ) : error ? (
          <div className="panel-empty">
            <span>{error}</span>
            {onRetry && <button type="button" className="btn btn-secondary sm" onClick={onRetry}>{L.retry}</button>}
          </div>
        ) : items.length ? (
          /* Plain rows have no tab stop of their own, so the list takes one and the keyboard can scroll it. */
          <ul className="notifs" tabIndex={onOpen ? undefined : 0} aria-label={onOpen ? undefined : L.notifications}>
            {items.map((n) => <li key={n.id}>{row(n)}</li>)}
          </ul>
        ) : (
          <div className="panel-empty">{L.noNotifications}</div>
        )}
        {onViewAll && <button type="button" className="panel-ft" onClick={() => { close(true); onViewAll(); }}>{L.viewAll}</button>}
      </div>
    </div>
  );
}

/**
 * Console top bar: breadcrumb, a search slot, notifications with an unread
 * count, and the guides menu (What's new with the version and an unread dot,
 * then your guide links). Data comes in as props; nothing is fetched here.
 */
export function ConsoleTopbar({
  crumbs, search, notifications, notificationsLoading = false, notificationsError, onNotificationsRetry, onNotificationOpen, onMarkAllRead,
  onViewAllNotifications, guides, whatsNew, end, renderLink, labels, className,
}: ConsoleTopbarProps) {
  const L = withDefaults(CONSOLE_TOPBAR_LABELS, labels);
  const last = crumbs.length - 1;

  const guideItems: (MenuItemDef | 'separator')[] = [];
  if (whatsNew) {
    guideItems.push({
      id: 'whats-new',
      label: L.whatsNew,
      icon: SPARKLE,
      hint: (
        <>
          <span className="ver">{displayVersion(whatsNew.version)}</span>
          {whatsNew.unread && <><span className="newdot" aria-hidden="true" />{' '}<span className="sr-only">{L.unread}</span></>}
        </>
      ),
      onSelect: whatsNew.onOpen,
    });
    if (guides?.length) guideItems.push('separator');
  }
  for (const g of guides ?? []) {
    guideItems.push({ id: `guide:${g.label}`, label: g.label, icon: g.icon, hint: g.kbd ? <kbd>{g.kbd}</kbd> : undefined, onSelect: g.onSelect });
  }

  return (
    <header className={cx('tbar', className)}>
      <nav className="crumbs" aria-label={L.breadcrumb}>
        {crumbs.map((c, i) => (
          <React.Fragment key={`${i}:${c.label}`}>
            {i > 0 && <span className="sep" aria-hidden="true">/</span>}
            {i === last || !c.href
              ? <span aria-current={i === last ? 'page' : undefined}>{c.label}</span>
              : renderLink ? renderLink(c, c.label) : <a href={safeHref(c.href)}>{c.label}</a>}
          </React.Fragment>
        ))}
      </nav>
      {search}
      <div className="tbar-end">
        {end}
        {notifications && (
          <Notifications
            items={notifications}
            loading={notificationsLoading}
            error={notificationsError}
            onRetry={onNotificationsRetry}
            L={L}
            onOpen={onNotificationOpen}
            onMarkAllRead={onMarkAllRead}
            onViewAll={onViewAllNotifications}
          />
        )}
        {guideItems.length > 0 && (
          <Menu
            label={L.guides}
            align="end"
            items={guideItems}
            renderTrigger={(p) => (
              <button {...p} className="ibtn" aria-label={whatsNew?.unread ? L.guidesUnread : L.guides}>
                {HELP}
                {whatsNew?.unread && <span className="dot" aria-hidden="true" />}
              </button>
            )}
          />
        )}
      </div>
    </header>
  );
}
