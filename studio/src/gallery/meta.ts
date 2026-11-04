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
