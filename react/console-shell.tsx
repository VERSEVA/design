import * as React from 'react';
import { COLLAPSE_KEY, COLLAPSE_SHORTCUT, isCollapseShortcut, railTipPosition, readCollapsed, safeStorage, writeCollapsed } from './console-state';
import { cx } from './cx';

const useIsoLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

/** True while an aria-modal dialog (What's new or any app modal) is open: page shortcuts stand down. */
function inOpenModal(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]:not([hidden])') !== null;
}

export interface ConsoleShellLabels { collapseSidebar: string; expandSidebar: string }

export interface ShellState { collapsed: boolean; setCollapsed: (next: boolean) => void; toggle: () => void }
export type ShellSlot = React.ReactNode | ((state: ShellState) => React.ReactNode);

export interface ConsoleShellProps {
  /** Sidebar head, usually <OrgSwitcher/>. */
  head?: ShellSlot;
  /** Usually <ConsoleNav collapsed={state.collapsed}/>. */
  nav: ShellSlot;
  /** Sidebar foot under the collapse row, usually <AccountCapsule/> and <PlatformMark/>. */
  foot?: ShellSlot;
  /** Usually <ConsoleTopbar/>. */
  topbar?: React.ReactNode;
  /** Page content, rendered in main.cbody. */
  children: React.ReactNode;
  /** Controlled rail state. */
  collapsed?: boolean;
  /** Uncontrolled initial state when nothing is stored. Default false. */
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Default 'verseva.shell.collapsed'; null disables persistence. Controlled mode (collapsed given) neither reads nor writes storage. */
  storageKey?: string | null;
  /** Default '['; null disables the key. */
  shortcut?: string | null;
  /** Visible collapse row text. Default "Collapse". */
  collapseLabel?: string;
  /** aria-label on the sidebar region. Default "Sidebar". */
  sidebarLabel?: string;
  /** Default "Skip to content"; null renders no skip link. */
  skipLabel?: string | null;
  /** Default "main". */
  mainId?: string;
  /** Collapse row names. Default: "Collapse sidebar" (or collapseLabel when it is changed) and "Expand sidebar" (also the rail tip). */
  labels?: Partial<ConsoleShellLabels>;
  className?: string;
}

const PANEL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16" /></svg>
);

function navLabel(a: Element): string {
  const label = (a.querySelector('.nl')?.textContent ?? a.textContent ?? '').trim();
  const count = a.querySelector('.cnt')?.textContent?.trim();
  return count ? `${label} · ${count}` : label;
}

/**
 * Rail labels: one delegated .railtip inside the container, positioned fixed
 * beside the hovered or focused rail control (data-tip, or the nav label and
 * count). Shows on hover AND keyboard focus; Escape, blur, nav scroll and
 * expanding hide it. aria-hidden: the names already live in the controls.
 */
export function useRailTips(container: React.RefObject<HTMLElement | null>, enabled: boolean): void {
  React.useEffect(() => {
    const root = container.current;
    const tip = root?.querySelector<HTMLElement>('.railtip');
    if (!root || !tip) return;
    const hide = () => { tip.hidden = true; };
    if (!enabled) { hide(); return; }

    const anchorOf = (t: EventTarget | null): HTMLElement | null => {
      if (!(t instanceof Element)) return null;
      const a = t.closest<HTMLElement>('[data-tip], .snav a');
      return a && root.contains(a) && a.closest('.cside[data-collapsed]') ? a : null;
    };
    const show = (a: HTMLElement) => {
      const text = a.getAttribute('data-tip') || navLabel(a);
      if (!text) { hide(); return; }
      tip.textContent = text;
      const { x, y } = railTipPosition(a.getBoundingClientRect());
      tip.style.setProperty('--rt-x', `${x}px`);
      tip.style.setProperty('--rt-y', `${y}px`);
      tip.hidden = false;
    };

    const onOver = (e: PointerEvent) => { const a = anchorOf(e.target); if (a) show(a); };
    const onOut = (e: PointerEvent) => {
      const to = e.relatedTarget;
      if (to instanceof Node && tip.contains(to)) return;
      const from = anchorOf(e.target);
      if (from && to instanceof Node && from.contains(to)) return;
      hide();
    };
    const onFocusIn = (e: FocusEvent) => { const a = anchorOf(e.target); if (a) show(a); else hide(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    const nav = root.querySelector('.cside-nav');

    root.addEventListener('pointerover', onOver);
    root.addEventListener('pointerout', onOut);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', hide);
    document.addEventListener('keydown', onKey);
    nav?.addEventListener('scroll', hide, { passive: true });
    return () => {
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('pointerout', onOut);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', hide);
      document.removeEventListener('keydown', onKey);
      nav?.removeEventListener('scroll', hide);
      hide();
    };
  }, [container, enabled]);
}

/**
 * Console shell layout: the glass sidebar (head, nav, collapse row, foot), the
 * top bar and main. The sidebar snaps to the 72px rail on the collapse row or
 * the [ key (ignored while typing); the state persists in localStorage, read
 * before paint after mount so server renders stay stable.
 */
export function ConsoleShell({
  head, nav, foot, topbar, children, collapsed: controlled, defaultCollapsed = false, onCollapsedChange,
  storageKey = COLLAPSE_KEY, shortcut = COLLAPSE_SHORTCUT, collapseLabel = 'Collapse', sidebarLabel = 'Sidebar',
  skipLabel = 'Skip to content', mainId = 'main', labels, className,
}: ConsoleShellProps) {
  const [own, setOwn] = React.useState(defaultCollapsed);
  const isControlled = controlled !== undefined;
  const collapsed = isControlled ? controlled : own;
  const sideId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const sideRef = React.useRef<HTMLDivElement>(null);
  const readKey = React.useRef<string | null | undefined>(undefined);
  const collapseName = labels?.collapseSidebar ?? (collapseLabel === 'Collapse' ? 'Collapse sidebar' : collapseLabel);
  const expandName = labels?.expandSidebar ?? 'Expand sidebar';

  useIsoLayoutEffect(() => {
    if (isControlled || storageKey === null) { readKey.current = undefined; return; }
    // Read once per key; later changes come from setCollapsed.
    if (readKey.current === storageKey) return;
    readKey.current = storageKey;
    setOwn(readCollapsed(safeStorage(), storageKey, defaultCollapsed));
  }, [isControlled, storageKey, defaultCollapsed]);

  const setCollapsed = React.useCallback((next: boolean) => {
    if (!isControlled) {
      setOwn(next);
      if (storageKey !== null) writeCollapsed(safeStorage(), next, storageKey);
    }
    onCollapsedChange?.(next);
  }, [isControlled, storageKey, onCollapsedChange]);

  const toggle = React.useCallback(() => setCollapsed(!collapsed), [setCollapsed, collapsed]);

  React.useEffect(() => {
    if (shortcut === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isCollapseShortcut(e, shortcut) || inOpenModal()) return;
      const side = sideRef.current;
      if (side && getComputedStyle(side).display === 'none') return;
      e.preventDefault();
      toggle();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcut, toggle]);

  useRailTips(rootRef, collapsed);

  const state: ShellState = { collapsed, setCollapsed, toggle };
  const slot = (s: ShellSlot | undefined) => (typeof s === 'function' ? s(state) : s);

  return (
    <div className={cx('cshell', className)} ref={rootRef}>
      {skipLabel !== null && <a className="skip" href={`#${mainId}`}>{skipLabel}</a>}
      <div className="cside" id={sideId} ref={sideRef} role="region" aria-label={sidebarLabel} data-collapsed={collapsed ? '' : undefined}>
        {slot(head)}
        <div className="cside-nav">{slot(nav)}</div>
        <div className="cside-ft">
          <button
            type="button"
            className="collapse-row"
            aria-controls={sideId}
            aria-keyshortcuts={shortcut ?? undefined}
            aria-label={collapsed ? expandName : collapseName}
            data-tip={expandName}
            onClick={toggle}
          >
            {PANEL}
            <span>{collapseLabel}</span>
            {shortcut !== null && <kbd aria-hidden="true">{shortcut}</kbd>}
          </button>
          {slot(foot)}
        </div>
      </div>
      <div className="cmain">
        {topbar}
        <main className="cbody" id={mainId} tabIndex={-1}>{children}</main>
      </div>
      <div className="railtip" aria-hidden="true" hidden />
    </div>
  );
}
