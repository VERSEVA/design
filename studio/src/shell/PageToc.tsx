// On this page: the right rail on chapter and Foundations pages at wide viewports. Scroll-spy
// marks the section under the sticky chrome with aria-current; a click scrolls and moves focus
// (router.navigate: jumpTo, focusTarget, and the --studio-scroll-pad scroll margin).
import { useEffect, useState } from 'react';
import { navigate } from './router';
import type { Route } from './routes';

/** Pages that carry the rail: Foundations and every chapter with sections. */
export const hasToc = (r: Route) => r.sections.length > 0 && (r.path === '/foundations' || (r.group === 'Chapters' && !r.parent));

/* rAF position watcher (IntersectionObserver pauses in hidden panes; see learnings). The last
   section counts as current once the page is scrolled to its end. */
export function useActiveAnchor(ids: ReadonlyArray<string>): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = 0;
      const pad = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--studio-head-h')) || 66;
      let cur: string | null = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= pad + 48) cur = id;
      }
      const end = document.documentElement.scrollHeight > window.innerHeight && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (end && ids.length) cur = ids[ids.length - 1];
      setActive((p) => (p === cur ? p : cur));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    on();
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf); };
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
