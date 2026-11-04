// What each gallery example shows on its tile: its bento size, the filter tags it
// answers to, and the tags its header carries as neutral badges. Keyed by slug.
import type { TileSize } from '../tiles/SpecimenTile';

export interface ExampleMeta { size: TileSize; filters: ReadonlyArray<string>; tags: ReadonlyArray<string> }

export const META: Readonly<Record<string, ExampleMeta>> = {
  'three-hero': { size: 'xl', filters: ['dark', '3d'], tags: ['three.js', 'dark', 'tokens at runtime'] },
  pulse: { size: 'm', filters: ['dark', 'data', 'console'], tags: ['viz kit', 'crosshair hover', 'dark'] },
  launch: { size: 'm', filters: ['dark', 'motion', 'landing'], tags: ['line reveal', 'theme wipe', 'rolling stats'] },
  console: { size: 'm', filters: ['dark', 'console'], tags: ['org switcher', 'rail', 'dark'] },
  'quote-tool': { size: 's', filters: ['dark', 'tool'], tags: ['live recompute', 'state machine', 'dark'] },
  store: { size: 's', filters: ['light', 'commerce'], tags: ['generated asset', 'working cart', 'light'] },
  studio: { size: 'm', filters: ['dark', 'portfolio'], tags: ['generated covers', 'tag filter', 'dark'] },
  landing: { size: 'm', filters: ['light', 'landing'], tags: ['working modal', 'validation', 'light'] },
};

/** The filter chips after All, in order: [tag, label]. */
export const FILTERS: ReadonlyArray<readonly [string, string]> = [
  ['data', 'Data'], ['motion', 'Motion'], ['dark', 'Dark'], ['light', 'Light'], ['console', 'Console'],
  ['tool', 'Tool'], ['commerce', 'Commerce'], ['portfolio', 'Portfolio'], ['3d', '3D'],
];

/* Column spans on the bento (.wgrid 4 columns, 2 under 1100px; XL takes the M span there, one row). */
const SPANS: Record<number, Record<string, number>> = { 4: { s: 1, m: 2, l: 2, xl: 4 }, 2: { s: 1, m: 2, l: 2, xl: 2 } };
const fits = (sizes: ReadonlyArray<TileSize>, cols: number) => {
  let used = 0;
  for (const s of sizes) { const w = SPANS[cols][s]; if (used + w > cols) { if (used) return false; } used = (used + w) % cols; }
  return used === 0;
};

/** The sizes for the examples a filter shows: their own when those fill every row at 4 and 2
    columns, else a reflow that does (an XL first on an odd count, then Ms in pairs). */
export function bentoSizes(slugs: ReadonlyArray<string>): TileSize[] {
  const own = slugs.map((s) => META[s].size);
  if (fits(own, 4) && fits(own, 2)) return own;
  return slugs.map((_, i) => (slugs.length % 2 && i === 0 ? 'xl' : 'm'));
}
