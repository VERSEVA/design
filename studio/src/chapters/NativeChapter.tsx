// A ported chapter: the legacy page's body as studio markup, inside the same
// stage the iframe used, so the shell, anchors and theme behave as on native
// studio pages. Render-safe: nothing here touches window or storage until mount.
//
// Port pattern (ticket 7), one PR per chapter:
//   pages/<slug>.tsx  exports Page (renders <NativeChapter slug>) and FROZEN, the
//                     sha256 of site/<file>.html it was ported from
//   pages/<slug>.css  the chapter's own <style>, every selector under [data-chapter="<slug>"]
//   native.css        site.css content rules only, shared, scoped to .chap
// What replaces the embed's behaviour lives here: deep-link scroll, link routing,
// and the inline script run after mount.
import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { navigate } from '../shell/router';
import { resolveChapterLink } from './links';
import chapters from '../data/chapters.json';
import './chapters.css';
import './native.css';

/* A chapter's inline script, ported: runs after mount against the chapter root.
   Listeners take the signal, timers register with onCleanup, so a remount
   (route change, StrictMode) leaves nothing behind. */
export type ChapterScript = (root: HTMLElement, signal: AbortSignal, onCleanup: (fn: () => void) => void) => void;

/* One delegated handler for every link in the chapter: studio paths and legacy
   chapter URLs go through the router, same-page anchors scroll, and anything
   else (files, mail, other sites, modified or new-tab clicks) stays native. */
function onChapterClick(e: MouseEvent<HTMLElement>, file: string) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element).closest?.('a');
  if (!a || !e.currentTarget.contains(a) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
  const href = a.getAttribute('href');
  if (!href) return;
  if (href.startsWith('/') && !href.startsWith('//') && !href.includes('.html')) {
    e.preventDefault();
    navigate(href);
    return;
  }
  const t = resolveChapterLink(href, window.location.origin, file);
  if (t.kind === 'route') { e.preventDefault(); navigate(t.to); }
  else if (t.kind === 'anchor') { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' }); }
}

export function NativeChapter({ slug, script, children }: { slug: string; script?: ChapterScript; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const file = chapters.find((c) => c.slug === slug)?.file ?? `${slug}.html`;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ac = new AbortController();
    const cleanups: Array<() => void> = [];
    script?.(el, ac.signal, (fn) => cleanups.push(fn));
    /* A deep link (/decks#structure) lands on its section once the script has laid the page out. */
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
    return () => { ac.abort(); cleanups.forEach((fn) => fn()); };
  }, [script]);

  return (
    <section className="chapter" data-chapter={slug}>
      <div className="chapter-stage">
        <div ref={root} className="chap" onClick={(e) => onChapterClick(e, file)}>{children}</div>
      </div>
    </section>
  );
}
