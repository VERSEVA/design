// A ported chapter must be the frozen legacy page, element for element: same
// tags, attributes, copy and specimens, with legacy links mapped to studio routes
// and an id on every sidebar anchor. Editing a frozen site/*.html fails this too.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { App } from '../src/App';
import { navigate } from '../src/shell/router';
import { NATIVE_CHAPTERS } from '../src/shell/routes';
import chapters from '../src/data/chapters.json';

const site = path.resolve(__dirname, '../../site');
const ORIGIN = 'https://design.verseva.com';
const ported = chapters.filter((c) => NATIVE_CHAPTERS[c.slug]);

/* Where a legacy URL lives once its chapter is a studio page. */
export function portUrl(attr: string, value: string, file: string): string {
  if (value.startsWith('#')) return value;
  const url = new URL(value, `${ORIGIN}/site/${file}`);
  if (url.origin !== ORIGIN) return value;
  const name = url.pathname.split('/').pop() ?? '';
  const ch = chapters.find((c) => c.file === name && url.pathname === `/site/${name}`);
  if (attr === 'href' && ch) return `/${ch.slug}${url.hash}`;
  if (attr === 'href' && url.pathname === '/site/index.html') return `/${url.hash}`;
  return url.pathname.replace(/^\/site\//, '/') + url.search + url.hash;
}

const URL_ATTRS = new Set(['href', 'src']);
const IGNORED = new Set(['selected']);

function canon(node: Node, file: string, extraIds: Set<string>, pre = false): string {
  if (node.nodeType === 3) {
    const t = (node as Text).data;
    if (pre) return t;
    return t.trim() ? t.replace(/\s+/g, ' ') : '';
  }
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  const tag = el.localName;
  const attrs = [...el.attributes]
    .filter((a) => !IGNORED.has(a.name) && !(a.name === 'id' && extraIds.has(a.value)))
    .map((a) => {
      let v = a.value;
      if (URL_ATTRS.has(a.name)) v = portUrl(a.name, v, file);
      if (a.name === 'style') v = v.split(';').map((d) => d.trim().replace(/\s*:\s*/, ':')).filter(Boolean).sort().join(';');
      return `${a.name}=${JSON.stringify(v)}`;
    })
    .sort();
  const inPre = pre || tag === 'pre';
  const kids = [...el.childNodes].map((c) => canon(c, file, extraIds, inPre)).join('');
  return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>${kids}</${tag}>`;
}

function legacyBody(file: string): Element {
  const doc = new DOMParser().parseFromString(fs.readFileSync(path.join(site, file), 'utf8'), 'text/html');
  const shell = doc.querySelector('.shell')!;
  shell.querySelector('header.topbar')?.remove();
  return shell;
}

describe('ported chapters', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/'); });

  it('ports at least one chapter and only known slugs', () => {
    expect(ported.length).toBeGreaterThan(0);
    for (const slug of Object.keys(NATIVE_CHAPTERS)) expect(chapters.map((c) => c.slug)).toContain(slug);
  });

  for (const c of ported) {
    describe(c.slug, () => {
      it('renders the frozen legacy body element for element', () => {
        const Page = NATIVE_CHAPTERS[c.slug];
        const { container } = render(<Page />);
        const chap = container.querySelector('.chap')!;
        const legacy = legacyBody(c.file);
        const extra = new Set(c.sections.map((s) => s.id).filter((id) => !legacy.querySelector(`[id="${id}"]`)));
        const want = [...legacy.childNodes].map((n) => canon(n, c.file, new Set())).join('');
        const got = [...chap.childNodes].map((n) => canon(n, c.file, extra)).join('');
        expect(got).toBe(want);
      });

      it('carries every sidebar anchor on the heading it names, in order', () => {
        const Page = NATIVE_CHAPTERS[c.slug];
        const { container } = render(<Page />);
        const heads = [...container.querySelectorAll('h2')];
        c.sections.forEach((s, i) => {
          const el = container.querySelector(`[id="${s.id}"]`);
          expect(el, s.id).not.toBeNull();
          expect(el === heads[i] || el!.contains(heads[i]), s.id).toBe(true);
        });
      });

      it('mounts in the studio shell with no iframe embed', async () => {
        const { container } = render(<App />);
        await act(async () => { navigate(`/${c.slug}`); });
        expect(container.querySelector('.chapter-frame')).toBeNull();
        expect(container.querySelector(`[data-chapter="${c.slug}"] .chap h1`)).not.toBeNull();
      });
    });
  }

  it('keeps the iframe embed for every chapter not yet ported', async () => {
    const { container } = render(<App />);
    for (const c of chapters.filter((x) => !NATIVE_CHAPTERS[x.slug])) {
      await act(async () => { navigate(`/${c.slug}`); });
      expect(container.querySelector('.chapter-frame')?.getAttribute('src'), c.slug).toBe(`/site/${c.file}`);
    }
  });
});
