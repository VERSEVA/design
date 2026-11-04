import React from 'react';
import { FrontDoorPage, SECTIONS as FRONT } from '../front/FrontDoorPage';
import { FoundationsPage, SECTIONS as FOUNDATIONS } from '../foundations/FoundationsPage';
import { AssetLibraryPage, SECTIONS as ASSETS } from '../library/AssetLibraryPage';
import { ChapterPage } from '../chapters/ChapterPage';
import { GROUPS, LIVE_ROUTES, type Group, type RouteMeta } from './routes-table';
import tokens from '../data/tokens.json';
import library from '../data/library.json';
import chapters from '../data/chapters.json';

export { GROUPS, type Group };
export interface Section { id: string; label: string }
export interface Route extends RouteMeta { sections: ReadonlyArray<Section>; count: number | null; Page: () => React.ReactElement }
type View = Pick<Route, 'sections' | 'count' | 'Page'>;

const libCount = library.objects.length + library.loops.length;

const STUDIO_VIEWS: Record<string, View> = {
  '/': { sections: FRONT, count: null, Page: FrontDoorPage },
  '/foundations': { sections: FOUNDATIONS, count: tokens.length || null, Page: FoundationsPage },
  '/assets': { sections: ASSETS, count: libCount || null, Page: AssetLibraryPage },
};

/* Ported chapters: one module per chapter at chapters/pages/<slug>.tsx, exporting Page
   and FROZEN (the sha256 of the site/*.html it was ported from; see NativeChapter.tsx). */
const PORTED = import.meta.glob<{ Page: () => React.ReactElement; FROZEN?: string }>('../chapters/pages/*.tsx', { eager: true });
const slugOf = (file: string) => file.replace(/^.*\/|\.tsx$/g, '');
export const NATIVE_CHAPTERS: Readonly<Record<string, () => React.ReactElement>> = Object.fromEntries(
  Object.entries(PORTED).map(([file, mod]) => [slugOf(file), mod.Page]),
);
export const NATIVE_FROZEN: Readonly<Record<string, string | undefined>> = Object.fromEntries(
  Object.entries(PORTED).map(([file, mod]) => [slugOf(file), mod.FROZEN]),
);

/* The legacy chapters, folded in: same shell, same URL scheme, anchors from their h2s.
   A ported chapter renders its own page; any other keeps the iframe embed as the fallback. */
const CHAPTER_VIEWS: Record<string, View> = Object.fromEntries(chapters.map((c) => [`/${c.slug}`, {
  sections: c.sections,
  count: null,
  Page: NATIVE_CHAPTERS[c.slug] ?? (() => React.createElement(ChapterPage, { chapter: c })),
}]));

function viewFor(m: RouteMeta): View {
  const v = STUDIO_VIEWS[m.path] ?? CHAPTER_VIEWS[m.path];
  if (!v) throw new Error(`routes: no page for ${m.path}`);
  return v;
}

export const ROUTES: ReadonlyArray<Route> = LIVE_ROUTES.map((m) => ({ ...m, ...viewFor(m) }));

export const routeFor = (path: string) => ROUTES.find((r) => r.path === path) ?? ROUTES[0];
