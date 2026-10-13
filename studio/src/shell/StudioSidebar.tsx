import { useEffect, useState } from 'react';
import { CHAPTERS, ROUTES, routeFor } from './routes';
import { navigate, onStudioLink } from './router';

/* rAF position watcher (IntersectionObserver pauses in hidden panes; see learnings). */
function useActiveAnchor(ids: ReadonlyArray<string>): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      let cur: string | null = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) cur = id;
      }
      setActive((p) => (p === cur ? p : cur));
      raf = 0;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('scroll', on, { passive: true });
    on();
    return () => { window.removeEventListener('scroll', on); if (raf) cancelAnimationFrame(raf); };
  }, [ids]);
  return active;
}

export function StudioSidebar({ path }: { path: string }) {
  const route = routeFor(path);
  const active = useActiveAnchor(route.sections.map((s) => s.id));
  return (
    <aside className="studio-side">
      <nav aria-label="Studio" className="sgroup">
        <span className="grouplabel">Studio</span>
        <div className="snav">
          {ROUTES.map((r) => (
            <div key={r.path} className="snav-page">
              <a href={r.path} onClick={onStudioLink} className={r.path === path ? 'active' : undefined} aria-current={r.path === path ? 'page' : undefined}>
                <span>{r.label}</span>
                {r.count !== null && <span className="cnt">{r.count}</span>}
              </a>
              {r.path === path && r.sections.length > 0 && (
                <div className="snav anchors">
                  {r.sections.map((s) => (
                    <a key={s.id} href={`${r.path}#${s.id}`} onClick={onStudioLink} className={active === s.id ? 'on' : undefined} aria-current={active === s.id ? 'location' : undefined}>{s.label}</a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>
      <nav aria-label="Chapters" className="sgroup">
        <span className="grouplabel">Chapters</span>
        <div className="snav">
          {CHAPTERS.map((c) => <a key={c.href} href={c.href}>{c.label}</a>)}
        </div>
      </nav>
    </aside>
  );
}

export function StudioSelect({ path }: { path: string }) {
  const route = routeFor(path);
  const go = (v: string) => { if (v.endsWith('.html')) window.location.href = v; else navigate(v); };
  return (
    <label className="studio-select">
      <span className="sr-only">Go to</span>
      <select value={path} onChange={(e) => go(e.target.value)} aria-label="Go to">
        <optgroup label="Studio">
          {ROUTES.map((r) => <option key={r.path} value={r.path}>{r.label}</option>)}
        </optgroup>
        {route.sections.length > 0 && (
          <optgroup label={route.label}>
            {route.sections.map((s) => <option key={s.id} value={`${route.path}#${s.id}`}>{s.label}</option>)}
          </optgroup>
        )}
        <optgroup label="Chapters">
          {CHAPTERS.map((c) => <option key={c.href} value={c.href}>{c.label}</option>)}
        </optgroup>
      </select>
    </label>
  );
}
