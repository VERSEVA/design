import * as React from 'react';

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  count?: number;
  hot?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface ConsoleNavProps {
  groups: NavGroup[];
  /** The current location; one item is active by exact or prefix match. */
  activeHref: string;
  /** false = the flat variant (grouped rows, non-interactive eyebrows). */
  accordion?: boolean;
  /** Persisted SHUT-group labels (shut, not open: later-added groups default open). */
  storageKey?: string;
  /** Swap in your router's Link; defaults to a plain anchor. */
  renderLink?: (item: NavItem, children: React.ReactNode, active: boolean) => React.ReactNode;
}

/**
 * Console navigation, both variants (law 12). Accordion mechanics ported from
 * the Spectre rail: collapse is the HTML hidden attribute (never a height
 * animation), the only motion is the chevron, and the group holding the
 * active item always refuses to collapse.
 */
export function ConsoleNav({ groups, activeHref, accordion = false, storageKey = 'verseva.nav.shut', renderLink }: ConsoleNavProps) {
  const [shut, setShut] = React.useState<ReadonlySet<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const matches = (href: string) => activeHref === href || activeHref.startsWith(`${href}/`);
  const best = groups
    .flatMap((g) => g.items.map((i) => i.href))
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];
  const holdsActive = (g: NavGroup) => g.items.some((i) => i.href === best);

  const toggle = (label: string) => {
    const next = new Set(shut);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    setShut(next);
    try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* session-only */ }
  };

  const link = (item: NavItem) => {
    const active = item.href === best;
    const children = (
      <>
        {item.icon}
        {item.label}
        {item.count !== undefined && <span className={item.hot ? 'cnt hot' : 'cnt'}>{item.count}</span>}
      </>
    );
    if (renderLink) return <React.Fragment key={item.href}>{renderLink(item, children, active)}</React.Fragment>;
    return (
      <a key={item.href} href={item.href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
        {children}
      </a>
    );
  };

  return (
    <>
      {groups.map((g) => {
        const open = !accordion || !shut.has(g.label) || holdsActive(g);
        const id = `snav-${g.label.replace(/\W+/g, '-').toLowerCase()}`;
        return (
          <div className="sgroup" key={g.label} data-open={open}>
            {accordion ? (
              <button type="button" className="sgroup-head" aria-expanded={open} aria-controls={id} onClick={() => toggle(g.label)}>
                <span className="grouplabel">{g.label}</span>
                <svg className="sgroup-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            ) : (
              <div className="grouplabel">{g.label}</div>
            )}
            <nav className="snav" id={id} aria-label={g.label} hidden={!open}>
              {g.items.map(link)}
            </nav>
          </div>
        );
      })}
    </>
  );
}
