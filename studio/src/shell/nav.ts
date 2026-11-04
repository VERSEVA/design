// The sidebar's model: three groups drawn from the routes table, the item a path marks,
// and the two persisted states (the rail, the shut groups). The head script reads the
// same keys before first paint and writes them on <html> (data-rail, data-nav-shut).
import { ROUTES, type Route } from './routes';

export type GroupId = 'studio' | 'chapters' | 'gallery';
export interface NavItem { path: string; label: string; count: number | null }
export interface NavGroup { id: GroupId; label: string; items: ReadonlyArray<NavItem> }

export const RAIL_KEY = 'verseva-rail';
export const SHUT_KEY = 'verseva-nav-shut';

const item = (r: Route, label = r.label): NavItem => ({ path: r.path, label, count: r.count });
const gallery = ROUTES.find((r) => r.path === '/gallery');

export const NAV: ReadonlyArray<NavGroup> = [
  { id: 'studio', label: 'Studio', items: ROUTES.filter((r) => r.group === 'Studio' && !r.parent).map((r) => item(r)) },
  { id: 'chapters', label: 'Chapters', items: ROUTES.filter((r) => r.group === 'Chapters' && !r.parent && r.path !== '/gallery').map((r) => item(r)) },
  { id: 'gallery', label: 'Gallery', items: [...(gallery ? [item(gallery, 'All examples')] : []), ...ROUTES.filter((r) => r.parent === '/gallery').map((r) => item(r))] },
];

const ALL = NAV.flatMap((g) => g.items.map((i) => i.path));

/** The nav item a path marks: itself, or the nearest ancestor in the nav (a code page marks its example). */
export function navActive(path: string): string | null {
  let r = ROUTES.find((x) => x.path === path);
  for (let n = 0; r && n < 8; n++) {
    if (ALL.includes(r.path)) return r.path;
    r = r.parent ? ROUTES.find((x) => x.path === r!.parent) : undefined;
  }
  return null;
}

export const groupOf = (path: string | null): GroupId | null => (path ? NAV.find((g) => g.items.some((i) => i.path === path))?.id ?? null : null);

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const store = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } };

export function readShut(): GroupId[] {
  try {
    const v = JSON.parse(read(SHUT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is GroupId => NAV.some((g) => g.id === x)) : [];
  } catch { return []; }
}

export function writeShut(ids: ReadonlyArray<GroupId>) {
  store(SHUT_KEY, ids.length ? JSON.stringify(ids) : null);
  if (ids.length) document.documentElement.dataset.navShut = ids.join(' ');
  else delete document.documentElement.dataset.navShut;
}

export const isRail = () => typeof document !== 'undefined' && document.documentElement.dataset.rail === 'collapsed';

export function setRail(on: boolean) {
  store(RAIL_KEY, on ? '1' : null);
  if (on) document.documentElement.dataset.rail = 'collapsed';
  else delete document.documentElement.dataset.rail;
}
