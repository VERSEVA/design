import * as React from 'react';
import {
  SEEN_KEY, changeTone, displayVersion, formatReleaseDate, isFresh, isUnread, kindLabel,
  readSeen, safeStorage, sortChanges, visibleReleases, withDefaults, writeSeen,
} from './console-state';
import type { ChangeKind, Release, ReleaseChange } from './console-state';
import { cx } from './cx';

export type { ChangeKind, Release, ReleaseChange };

export interface Platform {
  /** Inline svg or img, currentColor. */
  mark: React.ReactNode;
  /** From your build, e.g. "0.3.0". */
  version: string;
  label: string;
}

export interface WhatsNewProps {
  open: boolean;
  onClose: () => void;
  /** platform.version */
  version: string;
  releases: Release[];
  /** From useWhatsNew: the last-seen snapshot taken when the drawer opened. */
  lastSeen?: string | null;
  /** Skeleton rows. */
  loading?: boolean;
  /** Replaces the releases with this message (after loading). */
  error?: React.ReactNode;
  /** "Try again" under the error when given. */
  onRetry?: () => void;
  /** Default "What's new". */
  title?: string;
  /** Built-in words; English defaults in WHATS_NEW_LABELS. */
  labels?: Partial<WhatsNewLabels>;
  /** Date formatting, default 'en-US'. */
  locale?: string;
  className?: string;
}

export interface PlatformMarkProps { platform: Platform; onOpen: () => void; labels?: Partial<PlatformMarkLabels>; className?: string }

export const WHATS_NEW_LABELS = {
  close: 'Close',
  body: 'Release notes',
  empty: 'No release notes',
  loading: 'Loading',
  retry: 'Try again',
  /** Change kind words; kindLabel's English when absent. */
  kinds: {} as Partial<Record<ChangeKind, string>>,
};
export type WhatsNewLabels = typeof WHATS_NEW_LABELS;
export const PLATFORM_MARK_LABELS = { action: "What's new" };
export type PlatformMarkLabels = typeof PLATFORM_MARK_LABELS;

/**
 * Unread state for What's new. Storage is read after mount (SSR-stable);
 * openDrawer snapshots last-seen, writes the current version, and opens.
 */
export function useWhatsNew(opts: { version: string; storageKey?: string }): {
  unread: boolean;
  open: boolean;
  lastSeen: string | null;
  openDrawer: () => void;
  close: () => void;
} {
  const { version, storageKey = SEEN_KEY } = opts;
  const [stored, setStored] = React.useState<{ value: string | null } | undefined>(undefined);
  const [open, setOpen] = React.useState(false);
  const [lastSeen, setLastSeen] = React.useState<string | null>(null);

  React.useEffect(() => {
    setStored({ value: readSeen(safeStorage(), storageKey) });
  }, [storageKey]);

  const openDrawer = React.useCallback(() => {
    const store = safeStorage();
    setLastSeen(readSeen(store, storageKey));
    writeSeen(store, version, storageKey);
    setStored({ value: version });
    setOpen(true);
  }, [storageKey, version]);

  const close = React.useCallback(() => setOpen(false), []);

  return { unread: stored !== undefined && isUnread(stored.value, version), open, lastSeen, openDrawer, close };
}

const X = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
);
const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

/**
 * What's new: a right sheet over a scrim. Releases at or below the current
 * version, newest first; releases newer than the last-seen snapshot render
 * bright, older ones quiet. Focus moves to Close, Tab cycles inside, and
 * Escape, Close or the scrim return focus to whatever opened it.
 */
export function WhatsNew({ open, onClose, version, releases, lastSeen = null, loading = false, error, onRetry, title = "What's new", labels, locale, className }: WhatsNewProps) {
  const L = withDefaults(WHATS_NEW_LABELS, labels);
  const titleId = React.useId();
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => { onCloseRef.current = onClose; });

  React.useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
      const drawer = drawerRef.current;
      if (e.key !== 'Tab' || !drawer) return;
      const nodes = [...drawer.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!drawer.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, [open]);

  if (!open) return null;

  const shown = visibleReleases(releases, version);
  const newest = shown[0]?.version ?? version;

  return (
    <>
      <div className="scrim" aria-hidden="true" onClick={onClose} />
      <div className={cx('drawer', className)} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={drawerRef}>
        <div className="drawer-hd">
          <h4 id={titleId}>{title}</h4>
          <span className="vchip">{displayVersion(version)}</span>
          <button ref={closeRef} type="button" className="ibtn" aria-label={L.close} onClick={onClose}>{X}</button>
        </div>
        {/* A named tab stop so the keyboard can scroll a long list (WCAG 2.1.1); the focus trap includes it. */}
        <div className="drawer-bd" tabIndex={0} role="region" aria-label={L.body}>
          {loading ? (
            <div className="rel" aria-busy="true">
              <span className="sr-only">{L.loading}</span>
              {[0, 1, 2].map((i) => <div className="chg" key={i} aria-hidden="true"><span className="skel" /></div>)}
            </div>
          ) : error ? (
            <div className="empty">
              <span>{error}</span>
              {onRetry && <button type="button" className="btn btn-secondary sm" onClick={onRetry}>{L.retry}</button>}
            </div>
          ) : shown.length ? shown.map((r) => {
            const fresh = isFresh(r.version, lastSeen, newest);
            const v = displayVersion(r.version);
            return (
              <section key={r.version} className={cx('rel', !fresh && 'seen')} aria-label={v}>
                <div className="relhead">
                  <h5>{v}</h5>
                  <time dateTime={r.date}>{formatReleaseDate(r.date, locale)}</time>
                </div>
                <ul className="chgs">
                  {sortChanges(r.changes).map((c, i) => (
                    <li className="chg" key={`${i}:${c.text}`}>
                      <span className="k"><span className={cx('badge', changeTone(c.kind, fresh))}>{L.kinds?.[c.kind] ?? kindLabel(c.kind)}</span></span>
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          }) : (
            <div className="empty">{L.empty}</div>
          )}
        </div>
      </div>
    </>
  );
}

/** Platform mark + version in the sidebar foot; opens What's new. */
export function PlatformMark({ platform, onOpen, labels, className }: PlatformMarkProps) {
  const L = withDefaults(PLATFORM_MARK_LABELS, labels);
  const v = displayVersion(platform.version);
  return (
    /* Focus first: Safari does not focus a button on click, and the drawer returns focus to whatever had it at open. */
    <button type="button" className={cx('platform', className)} aria-label={`${platform.label} ${v}, ${L.action}`} data-tip={`${platform.label} ${v}`} onClick={(e) => { e.currentTarget.focus(); onOpen(); }}>
      <span className="pmark" aria-hidden="true">{platform.mark}</span>
      <span className="v">{v}</span>
    </button>
  );
}
