// The sidebar: expanded (three collapsible groups) or the icon rail (one icon per Studio page
// and per other group, a flyout for each group). Both render; <html data-rail> picks which
// shows, set by the head script before first paint, so hydration moves nothing.
import { useEffect, useId, useRef, useState } from 'react';
import { NOT_FOUND, ROUTES, routeFor, topOf, GROUPS } from './routes';
import { navigate, onStudioLink } from './router';
import { NAV, groupOf, navActive, readShut, setRail, writeShut, type GroupId, type NavGroup } from './nav';
import { ChevronIcon, GROUP_ICONS, PAGE_ICONS, SidebarIcon } from './icons';
import { useHydrated } from '../theme';

type Tip = { text: string; x: number; y: number } | null;

function Item({ path, label, count, active, current }: { path: string; label: string; count: number | null; active: boolean; current: boolean }) {
  return (
    <div className="snav-page">
      <a href={path} onClick={onStudioLink} className={active ? 'active' : undefined} aria-current={active ? (current ? 'page' : 'true') : undefined}>
        <span className="nl">{label}</span>
        {count !== null && <span className="cnt">{count}</span>}
      </a>
    </div>
  );
}

function SideFull({ path, onToggle }: { path: string; onToggle: () => void }) {
  const active = navActive(path);
  const activeGroup = groupOf(active);
  const hydrated = useHydrated();
  const [shut, setShut] = useState<GroupId[]>([]);
  useEffect(() => { setShut(readShut()); }, []);
  const toggle = (id: GroupId) => {
    const next = shut.includes(id) ? shut.filter((x) => x !== id) : [...shut, id];
    setShut(next);
    writeShut(next);
  };
  return (
    <div className="side-full">
      {NAV.map((g) => {
        /* The group holding the active item is always open; before hydration the head script's data-nav-shut draws the rest. */
        const open = !hydrated || g.id === activeGroup || !shut.includes(g.id);
        return (
          <nav key={g.id} aria-label={g.label} className="sgroup" data-g={g.id} data-open={open}>
            <button type="button" className="sgroup-head" aria-expanded={open} aria-controls={`sg-${g.id}`} onClick={() => toggle(g.id)}>
              <span className="grouplabel">{g.label}</span>
              <ChevronIcon />
            </button>
            <div className="snav" id={`sg-${g.id}`} hidden={!open}>
              {g.items.map((i) => <Item key={i.path} {...i} active={i.path === active} current={i.path === path} />)}
            </div>
          </nav>
        );
      })}
      <button type="button" className="collapse-row" onClick={onToggle}>
        <SidebarIcon />
        <span>Collapse sidebar</span>
      </button>
    </div>
  );
}

function RailGroup({ g, active, onTip }: { g: NavGroup; active: string | null; onTip: (t: Tip) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const fly = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Focus handed back to the button (Esc, ArrowLeft) must not reopen the flyout. */
  const quiet = useRef(false);
  const id = useId();
  const Icon = GROUP_ICONS[g.id];
  const holds = g.items.some((i) => i.path === active);
  const links = () => [...(fly.current?.querySelectorAll<HTMLAnchorElement>('a') ?? [])];

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ x: r.right + 8, y: r.top });
    onTip(null);
    setOpen(true);
  };
  const hide = () => { if (timer.current) clearTimeout(timer.current); setOpen(false); };
  const hideSoon = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 160); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /* Moving focus in waits for the flyout to be shown (an effect after the render that unhides it). */
  const [req, setReq] = useState<{ i: number; n: number } | null>(null);
  useEffect(() => { if (req && open) links()[req.i]?.focus(); }, [req, open]);
  const enter = (i: number) => { show(); setReq((r) => ({ i, n: (r?.n ?? 0) + 1 })); };
  const onBtnKey = (e: React.KeyboardEvent) => {
    if (['ArrowRight', 'ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); enter(0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); enter(g.items.length - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); hide(); }
  };
  const onFlyKey = (e: React.KeyboardEvent) => {
    const all = links();
    const i = all.indexOf(document.activeElement as HTMLAnchorElement);
    const go = (n: number) => { e.preventDefault(); all[(n + all.length) % all.length]?.focus(); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(all.length - 1);
    else if (e.key === 'Escape' || e.key === 'ArrowLeft') { e.preventDefault(); hide(); quiet.current = true; btn.current?.focus(); quiet.current = false; }
  };
  /* Focus leaving the button and its flyout closes it. */
  const onBlur = (e: React.FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && (btn.current?.contains(to) || fly.current?.contains(to))) return;
    hideSoon();
  };

  return (
    <div className="railgroup" onPointerEnter={show} onPointerLeave={hideSoon} onBlur={onBlur}>
      <button
        ref={btn}
        type="button"
        className={`railbtn${holds ? ' active' : ''}`}
        aria-label={g.label}
        aria-expanded={open}
        aria-controls={id}
        onFocus={() => { if (!quiet.current) show(); }}
        onKeyDown={onBtnKey}
        onClick={() => (open ? hide() : show())}
      >
        <Icon />
      </button>
      <div
        ref={fly}
        id={id}
        className="railfly"
        role="group"
        aria-label={g.label}
        hidden={!open}
        style={{ '--rt-x': `${pos.x}px`, '--rt-y': `${pos.y}px` } as React.CSSProperties}
        onKeyDown={onFlyKey}
      >
        <span className="grouplabel">{g.label}</span>
        <div className="snav">
          {g.items.map((i) => (
            <a key={i.path} href={i.path} className={i.path === active ? 'active' : undefined} aria-current={i.path === active ? 'page' : undefined} onClick={(e) => { onStudioLink(e); hide(); }}>
              <span className="nl">{i.label}</span>
              {i.count !== null && <span className="cnt">{i.count}</span>}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function SideRail({ path, onToggle, onTip }: { path: string; onToggle: () => void; onTip: (t: Tip) => void }) {
  const active = navActive(path);
  const tipFor = (text: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onTip({ text, x: r.right + 8, y: r.top + r.height / 2 });
  };
  const studio = NAV.find((g) => g.id === 'studio')!;
  return (
    <div className="side-rail">
      <nav aria-label="Pages" className="railset">
        {studio.items.map((i) => {
          const Icon = PAGE_ICONS[i.path];
          const on = i.path === active;
          return (
            <a key={i.path} href={i.path} onClick={onStudioLink} className={`railbtn${on ? ' active' : ''}`} aria-label={i.label} aria-current={on ? (i.path === path ? 'page' : 'true') : undefined}
              onPointerEnter={tipFor(i.label)} onPointerLeave={() => onTip(null)} onFocus={tipFor(i.label)} onBlur={() => onTip(null)}>
              {Icon ? <Icon /> : null}
            </a>
          );
        })}
      </nav>
      <nav aria-label="Groups" className="railset">
        {NAV.filter((g) => g.id !== 'studio').map((g) => <RailGroup key={g.id} g={g} active={active} onTip={onTip} />)}
      </nav>
      <button type="button" className="collapse-row railbtn" aria-label="Expand sidebar" onClick={onToggle}
        onPointerEnter={tipFor('Expand sidebar')} onPointerLeave={() => onTip(null)} onFocus={tipFor('Expand sidebar')} onBlur={() => onTip(null)}>
        <SidebarIcon />
      </button>
    </div>
  );
}

export function StudioSidebar({ path }: { path: string }) {
  const side = useRef<HTMLElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const toggle = (toRail: boolean) => {
    setTip(null);
    setRail(toRail);
    /* The pressed toggle hides with its view; focus moves to the other view's toggle. */
    side.current?.querySelector<HTMLButtonElement>(toRail ? '.side-rail .collapse-row' : '.side-full .collapse-row')?.focus();
  };
  return (
    <aside className="studio-side" ref={side}>
      <SideFull path={path} onToggle={() => toggle(true)} />
      <SideRail path={path} onToggle={() => toggle(false)} onTip={setTip} />
      <span className="railtip" role="tooltip" hidden={!tip} style={tip ? ({ '--rt-x': `${tip.x}px`, '--rt-y': `${tip.y}px` } as React.CSSProperties) : undefined}>{tip?.text}</span>
    </aside>
  );
}

export function StudioSelect({ path }: { path: string }) {
  const route = routeFor(path);
  const go = (v: string) => navigate(v);
  return (
    <label className="studio-select">
      <span className="sr-only">Go to</span>
      <select value={route === NOT_FOUND ? '' : topOf(path)} onChange={(e) => go(e.target.value)} aria-label="Go to">
        {route === NOT_FOUND && <option value="" disabled hidden>Go to</option>}
        {GROUPS.map((g) => (
          <optgroup key={g} label={g}>
            {ROUTES.filter((r) => r.group === g && !r.parent).map((r) => <option key={r.path} value={r.path}>{r.label}</option>)}
          </optgroup>
        ))}
        {route.sections.length > 0 && (
          <optgroup label={route.label}>
            {route.sections.map((s) => <option key={s.id} value={`${route.path}#${s.id}`}>{s.label}</option>)}
          </optgroup>
        )}
      </select>
    </label>
  );
}
