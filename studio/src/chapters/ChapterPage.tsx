// A legacy chapter, folded into the studio shell: the page renders inside the
// studio at full height (no inner scroll), its own top bar hidden, the studio
// theme synced in, links routed through the studio, and one marker per h2 so the
// sidebar anchors and scrollspy work exactly as on native studio pages.
import { useEffect, useRef } from 'react';
import { syncFrame } from '../front/frameSync';
import { navigate } from '../shell/router';
import { resolveChapterLink } from './links';
import './chapters.css';

export interface Chapter { slug: string; file: string; label: string; sections: ReadonlyArray<{ id: string; label: string }> }

const FOLD_CSS = '.topbar,.docnav{display:none!important}.docgrid{grid-template-columns:minmax(0,1fr)!important}html,body{overflow:hidden!important;background:transparent!important}';

export function ChapterPage({ chapter }: { chapter: Chapter }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const markers = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const f = frame.current;
    if (!f) return;
    let ro: ResizeObserver | null = null;
    let scrolledToHash = false;

    const layout = () => {
      const d = f.contentDocument;
      const host = markers.current;
      if (!d?.body || !host) return;
      f.style.height = `${d.documentElement.scrollHeight}px`;
      const heads = [...d.querySelectorAll('h2')];
      host.replaceChildren(...chapter.sections.flatMap((s, i) => {
        const h = heads[i];
        if (!h) return [];
        const m = document.createElement('div');
        m.id = s.id;
        m.className = 'chapter-marker';
        m.style.top = `${Math.max(0, h.getBoundingClientRect().top + (d.defaultView?.scrollY ?? 0) - 24)}px`;
        return [m];
      }));
      if (!scrolledToHash && window.location.hash) {
        scrolledToHash = true;
        document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView();
      }
    };

    const onLoad = () => {
      const d = f.contentDocument;
      if (!d) return;
      if (!d.querySelector('style[data-vsv-fold]')) {
        const st = d.createElement('style');
        st.dataset.vsvFold = '';
        st.textContent = FOLD_CSS;
        d.head.appendChild(st);
      }
      syncFrame(f);
      syncNested();
      d.addEventListener('click', (e) => {
        const a = (e.target as Element | null)?.closest?.('a');
        if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
        const href = a.getAttribute('href');
        if (!href) return;
        const t = resolveChapterLink(href, window.location.origin, chapter.file);
        if (t.kind === 'native') return;
        e.preventDefault();
        if (t.kind === 'route') navigate(t.to);
        else if (t.kind === 'anchor') document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' });
        else window.location.href = t.href;
      });
      ro?.disconnect();
      ro = new ResizeObserver(layout);
      ro.observe(d.body);
      layout();
    };

    /* The gallery nests live example frames one level down; keep them on the theme too. */
    const syncNested = () => {
      const d = f.contentDocument;
      if (!d) return;
      for (const inner of d.querySelectorAll('iframe')) {
        syncFrame(inner);
        if (!inner.dataset.vsvSync) { inner.dataset.vsvSync = ''; inner.addEventListener('load', () => syncFrame(inner)); }
      }
    };
    const onTheme = () => { syncFrame(f); syncNested(); };
    f.addEventListener('load', onLoad);
    window.addEventListener('vsv-theme', onTheme);
    window.addEventListener('resize', layout);
    if (f.contentDocument?.readyState === 'complete' && f.contentDocument.body?.childElementCount) onLoad();
    return () => {
      f.removeEventListener('load', onLoad);
      window.removeEventListener('vsv-theme', onTheme);
      window.removeEventListener('resize', layout);
      ro?.disconnect();
    };
  }, [chapter]);

  return (
    <section className="chapter">
      <h1 className="sr-only">{chapter.label}</h1>
      <div className="chapter-stage">
        <div ref={markers} className="chapter-markers" aria-hidden="true" />
        <iframe ref={frame} key={chapter.slug} src={`/site/${chapter.file}`} title={chapter.label} className="chapter-frame" scrolling="no" />
      </div>
    </section>
  );
}
