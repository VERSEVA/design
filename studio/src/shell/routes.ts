import React from 'react';
import { FrontDoorPage, SECTIONS as FRONT } from '../front/FrontDoorPage';
import { FoundationsPage, SECTIONS as FOUNDATIONS } from '../foundations/FoundationsPage';
import { AssetLibraryPage, SECTIONS as ASSETS } from '../library/AssetLibraryPage';
import { ChapterPage } from '../chapters/ChapterPage';
import tokens from '../data/tokens.json';
import library from '../data/library.json';
import chapters from '../data/chapters.json';

export interface Section { id: string; label: string }
export type Group = 'Studio' | 'Chapters';
export interface Route { path: string; label: string; title: string; group: Group; sections: ReadonlyArray<Section>; count: number | null; Page: () => React.ReactElement }

const libCount = library.objects.length + library.loops.length;

const STUDIO: ReadonlyArray<Route> = [
  { path: '/', label: 'Overview', title: 'VERSEVA Design', group: 'Studio', sections: FRONT, count: null, Page: FrontDoorPage },
  { path: '/foundations', label: 'Foundations', title: 'Foundations', group: 'Studio', sections: FOUNDATIONS, count: tokens.length || null, Page: FoundationsPage },
  { path: '/assets', label: 'Asset Library', title: 'Asset Library', group: 'Studio', sections: ASSETS, count: libCount || null, Page: AssetLibraryPage },
];

/* The legacy chapters, folded in: same shell, same URL scheme, anchors from their h2s. */
const CHAPTER_ROUTES: ReadonlyArray<Route> = chapters.map((c) => ({
  path: `/${c.slug}`,
  label: c.label,
  title: c.label,
  group: 'Chapters' as const,
  sections: c.sections,
  count: null,
  Page: () => React.createElement(ChapterPage, { chapter: c }),
}));

export const ROUTES: ReadonlyArray<Route> = [...STUDIO, ...CHAPTER_ROUTES];
export const GROUPS: ReadonlyArray<Group> = ['Studio', 'Chapters'];

export const routeFor = (path: string) => ROUTES.find((r) => r.path === path) ?? ROUTES[0];
