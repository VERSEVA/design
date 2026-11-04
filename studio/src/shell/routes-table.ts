// The one routes table: path, label, group, title and description for every studio route.
// The router, the sidebar and the per-route head read it; the pre-render and sitemap will too.
import table from '../data/routes.json';

export type Group = 'Studio' | 'Chapters';
export interface RouteMeta {
  path: string;
  label: string;
  group: Group;
  title: string;
  description: string;
  /** The route this one sits under (breadcrumb and sidebar); top-level rows have none. */
  parent?: string;
  /** In the table, not yet live: kept out of the router, the sidebar and the sitemap. */
  proposed?: boolean;
}

export const ROUTE_TABLE: ReadonlyArray<RouteMeta> = table as ReadonlyArray<RouteMeta>;
export const LIVE_ROUTES: ReadonlyArray<RouteMeta> = ROUTE_TABLE.filter((r) => !r.proposed);
/** Rows the sidebar and the route picker list: the ones with no parent. */
export const TOP_ROUTES: ReadonlyArray<RouteMeta> = LIVE_ROUTES.filter((r) => !r.parent);
export const GROUPS: ReadonlyArray<Group> = ['Studio', 'Chapters'];

export function metaFor(path: string): RouteMeta {
  const r = LIVE_ROUTES.find((m) => m.path === path);
  if (!r) throw new Error(`routes table: no live route for ${path}`);
  return r;
}

/** The top-level row a path sits under: itself, or the last ancestor up its parent chain. */
export function topOf(path: string): string {
  let r = LIVE_ROUTES.find((m) => m.path === path);
  for (let n = 0; r?.parent && n < 8; n++) r = LIVE_ROUTES.find((m) => m.path === r!.parent);
  return r?.path ?? path;
}
