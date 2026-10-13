import type React from 'react';
import { FrontDoorPage, SECTIONS as FRONT } from '../front/FrontDoorPage';
import { FoundationsPage, SECTIONS as FOUNDATIONS } from '../foundations/FoundationsPage';
import { AssetLibraryPage, SECTIONS as ASSETS } from '../library/AssetLibraryPage';
import tokens from '../data/tokens.json';
import library from '../data/library.json';

export interface Section { id: string; label: string }
export interface Route { path: string; label: string; title: string; sections: ReadonlyArray<Section>; count: number | null; Page: () => React.ReactElement }

const libCount = library.objects.length + library.loops.length;

export const ROUTES: ReadonlyArray<Route> = [
  { path: '/', label: 'Overview', title: 'VERSEVA Design', sections: FRONT, count: null, Page: FrontDoorPage },
  { path: '/foundations', label: 'Foundations', title: 'Foundations', sections: FOUNDATIONS, count: tokens.length || null, Page: FoundationsPage },
  { path: '/assets', label: 'Asset Library', title: 'Asset Library', sections: ASSETS, count: libCount || null, Page: AssetLibraryPage },
];

export const CHAPTERS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/components.html', label: 'Components' },
  { href: '/web-ui.html', label: 'Web UI' },
  { href: '/data-viz.html', label: 'Data viz' },
  { href: '/motion.html', label: 'Motion' },
  { href: '/decks.html', label: 'Decks' },
  { href: '/docs-pdf.html', label: 'Docs and PDF' },
  { href: '/distribute.html', label: 'Distribute' },
  { href: '/examples.html', label: 'Gallery' },
];

export const routeFor = (path: string) => ROUTES.find((r) => r.path === path) ?? ROUTES[0];
