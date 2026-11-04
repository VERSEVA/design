// A ported chapter must be the frozen legacy page, element for element: same
// tags, attributes, copy and specimens, with legacy links mapped to studio routes
// and an id on every sidebar anchor. Editing a frozen site/*.html fails this too.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { App } from '../src/App';
import { navigate } from '../src/shell/router';
import { NATIVE_CHAPTERS, NATIVE_FROZEN } from '../src/shell/routes';
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
  /* Gallery links stay in the shell: an example opens at /gallery/<slug>, its source at
     /gallery/<slug>/code. Iframe src keeps the file, which serves as before. */
  const ex = url.pathname.match(/^\/site\/examples\/([a-z0-9-]+)\.html$/);
  if (attr === 'href' && ex) return `/gallery/${ex[1]}${url.hash}`;
  const src = url.pathname === '/site/code.html' ? url.searchParams.get('f')?.match(/^examples\/([a-z0-9-]+)\.html$/) : null;
  if (attr === 'href' && src) return `/gallery/${src[1]}/code`;
  return url.pathname.replace(/^\/site\//, '/') + url.search + url.hash;
}

const URL_ATTRS = new Set(['href', 'src']);
const IGNORED = new Set(['selected']);

function canon(node: Node, file: string, extraIds: Set<string>, pre = false): string {
  if (node.nodeType === 3) {
    const t = (node as Text).data;
    if (pre) return t;
    /* ASCII whitespace only: \s and trim() also eat U+00A0, and a legacy &nbsp; must survive the port. */
    return /[^ \t\n\r\f]/.test(t) ? t.replace(/[ \t\n\r\f]+/g, ' ') : '';
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

/* What a port may leave out of the legacy body, and why. Nothing else may differ. */
export const STRIPPED: ReadonlyArray<{ selector: string; why: string }> = [
  { selector: 'header.topbar', why: 'the studio header replaces the legacy top bar' },
  { selector: 'aside.docnav', why: 'the studio sidebar lists the same anchors; the embed hid it too' },
];

/* What a port changes on purpose, per chapter, and why: each is applied to the legacy
   body before the comparison, so the port may differ by exactly these and nothing else.
   The frozen site/*.html stays as it is. */
export const DEVIATIONS: Readonly<Record<string, ReadonlyArray<{ id: string; why: string; apply: (shell: Element) => void }>>> = {
  components: [
    {
      id: 'widgets-link',
      why: 'a labels-only link to /widgets in the hero (ruling 2026-11-04)',
      apply: (shell) => shell.querySelector('.hero')!.insertAdjacentHTML('beforeend', '<div class="chips"><a class="btn btn-secondary sm" href="/widgets">Widgets</a></div>'),
    },
    {
      id: 'table-tscroll',
      why: 'the 541px #table specimen scrolled the page sideways at 375px; it sits in the .tscroll scroller (ruling 2026-11-04)',
      apply: (shell) => {
        const spec = shell.querySelector('#table .demo > .specimen')!;
        const wrap = spec.ownerDocument.createElement('div');
        wrap.className = 'tscroll';
        spec.replaceWith(wrap);
        wrap.append(spec);
      },
    },
    {
      id: 'table-pin-min-width',
      why: 'the #table-pin specimen (a flex item) took its table\'s width and scrolled the page sideways at 375px; min-width: 0 lets the .pin.box scroll it instead (ruling 2026-11-04)',
      apply: (shell) => {
        const spec = shell.querySelector('#table-pin .demo > .specimen')!;
        spec.setAttribute('style', `${spec.getAttribute('style')};min-width:0`);
      },
    },
  ],
};

function legacyBody(file: string, slug?: string): Element {
  const doc = new DOMParser().parseFromString(fs.readFileSync(path.join(site, file), 'utf8'), 'text/html');
  const shell = doc.querySelector('.shell')!;
  for (const { selector } of STRIPPED) shell.querySelectorAll(selector).forEach((n) => n.remove());
  for (const d of (slug && DEVIATIONS[slug]) || []) d.apply(shell);
  return shell;
}

const sha256 = (file: string) => createHash('sha256').update(fs.readFileSync(path.join(site, file))).digest('hex');

describe('ported chapters', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/'); });

  it('ports at least one chapter and only known slugs', () => {
    expect(ported.length).toBeGreaterThan(0);
    for (const slug of Object.keys(NATIVE_CHAPTERS)) expect(chapters.map((c) => c.slug)).toContain(slug);
  });

  it('writes deviations only for ported chapters', () => {
    for (const slug of Object.keys(DEVIATIONS)) expect(NATIVE_CHAPTERS[slug], slug).toBeDefined();
  });

  it('opens /widgets from the Components hero without leaving the shell', async () => {
    const { container } = render(<App />);
    await act(async () => { navigate('/components'); });
    const link = container.querySelector<HTMLAnchorElement>('[data-chapter="components"] .hero a[href="/widgets"]')!;
    expect(link.textContent).toBe('Widgets');
    await act(async () => { fireEvent.click(link); });
    expect(window.location.pathname).toBe('/widgets');
    expect(container.querySelector('.studio-main h1')).not.toBeNull();
  });

  for (const c of ported) {
    describe(c.slug, () => {
      /* The markup before any chapter script runs, as the legacy HTML is before its own. */
      it('renders the frozen legacy body element for element', () => {
        const Page = NATIVE_CHAPTERS[c.slug];
        const chap = new DOMParser().parseFromString(renderToStaticMarkup(<Page />), 'text/html').querySelector('.chap')!;
        const legacy = legacyBody(c.file, c.slug);
        const extra = new Set(c.sections.map((s) => s.id).filter((id) => !legacy.querySelector(`[id="${id}"]`)));
        const want = [...legacy.childNodes].map((n) => canon(n, c.file, new Set())).join('');
        const got = [...chap.childNodes].map((n) => canon(n, c.file, extra)).join('');
        expect(got).toBe(want);
      });

      it.each((DEVIATIONS[c.slug] ?? []).map((d) => [d.id, d] as const))('changes the legacy body by its written deviation %s, so a stale entry fails', (_, d) => {
        const before = legacyBody(c.file);
        const html = before.innerHTML;
        d.apply(before);
        expect(before.innerHTML).not.toBe(html);
      });

      it('pins the frozen site/' + c.file + ' by hash, so the legacy copy cannot change under the port', () => {
        expect(NATIVE_FROZEN[c.slug], 'pages/' + c.slug + '.tsx must export FROZEN').toMatch(/^[0-9a-f]{64}$/);
        expect(sha256(c.file)).toBe(NATIVE_FROZEN[c.slug]);
      });

      it('leaves out only the written strip list', () => {
        const Page = NATIVE_CHAPTERS[c.slug];
        const { container } = render(<Page />);
        for (const { selector } of STRIPPED) expect(container.querySelector(`.chap ${selector}`), selector).toBeNull();
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

      it('lands a cold deep link on its last sidebar anchor', async () => {
        const id = c.sections[c.sections.length - 1].id;
        window.history.replaceState(null, '', `/${c.slug}#${id}`);
        const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
        render(<App />);
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        expect(spy.mock.contexts.filter((el) => (el as Element).id === id).length, id).toBe(1);
        spy.mockRestore();
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
