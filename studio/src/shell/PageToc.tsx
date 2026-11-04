// On this page: the right rail on chapter and Foundations pages at wide viewports. Scroll-spy
// marks the section under the sticky chrome with aria-current; a click scrolls and moves focus
// (router.navigate: jumpTo, focusTarget, and the --studio-scroll-pad scroll margin).
import { useEffect, useState } from 'react';
import { navigate, onNavigate } from './router';
import type { Route } from './routes';

/** Pages that carry the rail: Foundations and every chapter with sections. */
export const hasToc = (r: Route) => r.sections.length > 0 && (r.path === '/foundations' || (r.group === 'Chapters' && !r.parent));

/* rAF position watcher (IntersectionObserver pauses in hidden panes; see learnings). The last
   section counts as current once the page is scrolled to its end. Sections that are tiles in one
   bento row share a top: the first in the row holds, a later one wins only from >=1px lower, and
   the location.hash target wins inside its row (and at the page end, or before any section reaches
   the line, while it is on screen). */
const hashId = () => {
  const raw = window.location.hash.slice(1);
  try { return decodeURIComponent(raw); } catch { return raw; }
};

export function useActiveAnchor(ids: ReadonlyArray<string>): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = 0;
      const pad = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--studio-head-h')) || 66;
      const line = pad + 48;
      let cur: string | null = ids[0] ?? null;
      let curTop = -Infinity;
      const tops = new Map<string, number>();
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        tops.set(id, top);
        if (top <= line && top >= curTop + 1) { cur = id; curTop = top; }
      }
      const hash = hashId();
      const hashTop = tops.get(hash);
      if (hashTop !== undefined && Math.abs(hashTop - curTop) < 1) cur = hash;
      /* Nothing has reached the line yet (a page too short to scroll): the hash target on screen wins. */
      if (hashTop !== undefined && curTop === -Infinity && hashTop < window.innerHeight) cur = hash;
      const end = document.documentElement.scrollHeight > window.innerHeight && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (end && ids.length) cur = hashTop !== undefined && hashTop >= curTop - 1 && hashTop < window.innerHeight ? hash : ids[ids.length - 1];
      setActive((p) => (p === cur ? p : cur));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    /* A click on a tile in the row already in view changes the hash without a scroll. */
    const off = onNavigate(on);
    on();
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); off(); if (raf) cancelAnimationFrame(raf); };
  }, [ids]);
  return active;
}

export function PageToc({ route }: { route: Route }) {
  const active = useActiveAnchor(route.sections.map((s) => s.id));
  return (
    <nav className="pagetoc" aria-label="On this page">
      <span className="grouplabel">On this page</span>
      <div className="toc">
        {route.sections.map((s) => {
          const href = `${route.path}#${s.id}`;
          return (
            <a key={s.id} href={href} className={active === s.id ? 'on' : undefined} aria-current={active === s.id ? 'location' : undefined}
              onClick={(e) => {
                if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                navigate(href);
              }}>
              {s.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
