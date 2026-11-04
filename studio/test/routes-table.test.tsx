import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { App } from '../src/App';
import { navigate } from '../src/shell/router';
import { ROUTES } from '../src/shell/routes';
import { ROUTE_TABLE, LIVE_ROUTES, TOP_ROUTES, metaFor } from '../src/shell/routes-table';
import chapters from '../src/data/chapters.json';
import fs from 'node:fs';
import path from 'node:path';
import { CHAPTERS } from '../scripts/chapters-model.mjs';

const description = () => document.querySelector('meta[name="description"]')?.getAttribute('content');

describe('routes table', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/'); });

  it('gives every route a unique title of 60 characters or fewer and a description of 160 or fewer', () => {
    const titles = ROUTE_TABLE.map((r) => r.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(ROUTE_TABLE.map((r) => r.path)).size).toBe(ROUTE_TABLE.length);
    for (const r of ROUTE_TABLE) {
      expect(r.title.length, r.path).toBeGreaterThan(0);
      expect(r.title.length, r.path).toBeLessThanOrEqual(60);
      expect(r.description.length, r.path).toBeGreaterThan(0);
      expect(r.description.length, r.path).toBeLessThanOrEqual(160);
    }
  });

  it('keeps proposed routes out of the router', () => {
    const live = ROUTES.map((r) => r.path);
    for (const r of ROUTE_TABLE.filter((m) => m.proposed)) expect(live).not.toContain(r.path);
  });

  it('serves /widgets live with its approved title and description', () => {
    const w = ROUTE_TABLE.find((r) => r.path === '/widgets')!;
    expect(w.proposed).toBeUndefined();
    expect(w.title).toBe('Widgets: home screen widgets in four sizes');
    expect(w.description).toBe('Home screen widgets in small, medium, large and extra large, each size with its own chart. Smart stacks, edit mode and drag to reorder.');
    expect(ROUTES.map((r) => r.path)).toContain('/widgets');
  });

  it('lists the same routes in the router and the table, with a row for every chapter', () => {
    expect(ROUTES.map((r) => r.path)).toEqual(LIVE_ROUTES.map((r) => r.path));
    const chapterRows = TOP_ROUTES.filter((r) => r.group === 'Chapters').map((r) => r.path).sort();
    expect(chapterRows).toEqual(chapters.map((c) => `/${c.slug}`).sort());
  });

  it('lists the top-level routes in the sidebar, in router order; rows with a parent stay out', () => {
    const { container } = render(<App />);
    const side = container.querySelector('.studio-side')!;
    const pages = [...side.querySelectorAll('.snav-page > a')].map((a) => a.getAttribute('href'));
    expect(pages).toEqual(ROUTES.filter((r) => !r.parent).map((r) => r.path));
    const labels = [...side.querySelectorAll('.snav-page > a > span:first-child')].map((s) => s.textContent);
    expect(labels).toEqual(TOP_ROUTES.map((r) => r.label));
    expect(TOP_ROUTES.length).toBeLessThan(LIVE_ROUTES.length);
  });

  it('sets the title and meta description per route on navigation', async () => {
    render(<App />);
    expect(document.title).toBe(metaFor('/').title);
    expect(description()).toBe(metaFor('/').description);
    for (const r of LIVE_ROUTES) {
      await act(async () => { navigate(r.path); });
      expect(document.title).toBe(r.title);
      expect(description()).toBe(r.description);
    }
    expect(document.querySelectorAll('meta[name="description"]').length).toBe(1);
  });

  it('labels every chapter row as chapters-model does', () => {
    const rows = TOP_ROUTES.filter((r) => r.group === 'Chapters').map((r) => [r.path, r.label]);
    expect(rows).toEqual(CHAPTERS.map((c: { slug: string; label: string }) => [`/${c.slug}`, c.label]));
  });

  it('pre-renders the live routes instead of rewriting them in vercel.json', () => {
    const v = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf8'));
    const shell = (v.rewrites ?? []).filter((r: { destination: string }) => r.destination === '/index.html').map((r: { source: string }) => r.source);
    expect(shell).toEqual([]);
  });

  it('starts index.html on the Overview row', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toContain(`<title>${metaFor('/').title}</title>`);
    expect(html).toContain(`<meta name="description" content="${metaFor('/').description}">`);
  });
});
