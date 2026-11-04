// Client-side navigation keeps the whole head in step with the route: title, description,
// canonical, social tags and JSON-LD; an unknown path gets the not-found head.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { App } from '../src/App';
import { navigate } from '../src/shell/router';
import { LIVE_ROUTES } from '../src/shell/routes-table';

const SITE = 'https://design.verseva.com';
const attr = (sel: string, a: string) => document.head.querySelector(sel)?.getAttribute(a) ?? null;
const ld = () => {
  const s = document.head.querySelectorAll('script[type="application/ld+json"]');
  expect(s.length).toBeLessThanOrEqual(1);
  return s[0] ? JSON.parse(s[0].textContent!) : null;
};

describe('head on client navigation', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/'); document.head.innerHTML = ''; });

  it('updates canonical, og, twitter and JSON-LD on every route', async () => {
    render(<App />);
    for (const r of [...LIVE_ROUTES].reverse()) {
      await act(async () => { navigate(r.path); });
      const url = r.path === '/' ? `${SITE}/` : `${SITE}${r.path}`;
      expect(document.title).toBe(r.title);
      expect(attr('link[rel="canonical"]', 'href')).toBe(url);
      expect(attr('meta[property="og:url"]', 'content')).toBe(url);
      expect(attr('meta[property="og:title"]', 'content')).toBe(r.title);
      expect(attr('meta[property="og:description"]', 'content')).toBe(r.description);
      expect(attr('meta[name="twitter:title"]', 'content')).toBe(r.title);
      expect(attr('meta[name="twitter:description"]', 'content')).toBe(r.description);
      const items = ld()['@graph'].find((g: { '@type': string }) => g['@type'] === 'BreadcrumbList').itemListElement;
      expect(items[items.length - 1].item).toBe(url);
      expect(ld()['@graph'].some((g: { '@type': string }) => g['@type'] === 'WebSite')).toBe(r.path === '/');
      expect(attr('meta[name="robots"]', 'content')).toBeNull();
    }
    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(document.head.querySelectorAll('meta[property="og:url"]').length).toBe(1);
  });

  it('gives an unknown path the not-found head: noindex, no canonical, no JSON-LD', async () => {
    render(<App />);
    await act(async () => { navigate('/gallery/x'); });
    expect(document.title).toBe('Page not found: VERSEVA Design');
    expect(attr('meta[name="robots"]', 'content')).toBe('noindex');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(ld()).toBeNull();
    await act(async () => { navigate('/motion'); });
    expect(attr('meta[name="robots"]', 'content')).toBeNull();
    expect(attr('link[rel="canonical"]', 'href')).toBe(`${SITE}/motion`);
  });
});
