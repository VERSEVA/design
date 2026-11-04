// The studio-wide command bar's commands: every route (grouped as the sidebar groups them)
// and every section of every page, built from the routes table and the section ids.
import type { Command } from '../../../react/command-bar';
import { ROUTES } from './routes';
import { NAV } from './nav';
import { navigate } from './router';

export type StudioCommand = Command & { path: string };

export function studioCommands(go: (href: string) => void = navigate): StudioCommand[] {
  const label = (path: string) => ROUTES.find((r) => r.path === path)?.label ?? path;
  const out: StudioCommand[] = [];
  const seen = new Set<string>();
  for (const g of NAV) for (const i of g.items) {
    seen.add(i.path);
    out.push({ group: g.label, label: i.label, path: i.path, keywords: [label(i.path)], run: () => go(i.path) });
  }
  /* Rows the sidebar leaves out (a gallery example's code page), under their parent's group. */
  for (const r of ROUTES) {
    if (seen.has(r.path)) continue;
    const parent = r.parent ? label(r.parent) : '';
    const group = NAV.find((g) => g.items.some((i) => i.path === r.parent))?.label ?? 'Studio';
    out.push({ group, label: parent ? `${parent}: ${r.label}` : r.label, path: r.path, keywords: ['source'], run: () => go(r.path) });
  }
  for (const r of ROUTES) for (const s of r.sections) {
    const href = `${r.path}#${s.id}`;
    out.push({ group: 'Sections', label: s.label, hint: r.label, path: href, keywords: [r.label], run: () => go(href) });
  }
  return out;
}
