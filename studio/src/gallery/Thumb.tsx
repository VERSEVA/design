// A gallery tile's live thumbnail: the example file in a frame, laid out at 1280px wide and
// scaled to its box. Inert and aria-hidden, no pointer events: the tile's links are the
// controls. Lazy: a frame loads only while its box is on screen and a slot is free, and at
// most MAX_LIVE frames are live at once (fewer on phones). Still by default: the example's
// CSS animations sit at their end state and its animation-frame loop is held; the
// thumbnail plays only while its tile is hovered or holds focus, and never while Pause
// motion is on or reduced motion is set. Theme and brand follow the studio as on every frame.
import { useEffect, useRef, useState } from 'react';
import { syncFrame } from '../front/frameSync';
import { usePauseMotion } from '../theme';

export const PHONE = '(max-width: 559.98px)';
export const MAX_LIVE = { wide: 6, phone: 3 } as const;
/* The width an example is laid out at before it is scaled to its box. */
const LAYOUT_W = 1280;
/* After load the example's own loop runs this long, so a count-up or a first 3D frame lands before it is held. */
const SETTLE_MS = 900;

/* ---- the slot pool: at most MAX_LIVE live frames across the page ---- */
interface Slot { visible: boolean; live: boolean; at: number; set: (live: boolean) => void }
const slots = new Set<Slot>();
let clock = 0;
const budget = () => (window.matchMedia?.(PHONE).matches ? MAX_LIVE.phone : MAX_LIVE.wide);

function schedule() {
  const max = budget();
  const all = [...slots];
  const evict = () => {
    const v = all.filter((s) => s.live && !s.visible).sort((a, b) => a.at - b.at)[0];
    if (v) { v.live = false; v.set(false); }
    return !!v;
  };
  while (all.filter((s) => s.live).length > max && evict()) { /* over budget after a resize */ }
  for (const s of all.filter((x) => x.visible && !x.live)) {
    if (all.filter((x) => x.live).length >= max && !evict()) break;
    s.live = true; s.at = ++clock; s.set(true);
  }
}

function useSlot(box: React.RefObject<HTMLElement | null>): boolean {
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const s: Slot = { visible: false, live: false, at: 0, set: setLive };
    slots.add(s);
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      for (const e of entries) s.visible = e.isIntersecting;
      schedule();
    }, { rootMargin: '120px 0px' });
    if (io) io.observe(el); else { s.visible = true; schedule(); }
    /* Unmounted (a filter hides the tile, a route leaves): the slot goes back to the pool. */
    return () => { io?.disconnect(); slots.delete(s); schedule(); };
  }, [box]);
  return live;
}

/* ---- holding an example's animation-frame loop ---- */
interface Gate { held: boolean; queue: FrameRequestCallback[]; raf: (cb: FrameRequestCallback) => number }
function gateOf(w: Window): Gate | null {
  const k = w as Window & { __vsvGate?: Gate };
  if (k.__vsvGate) return k.__vsvGate;
  if (typeof w.requestAnimationFrame !== 'function') return null;
  const raf = w.requestAnimationFrame.bind(w);
  const g: Gate = { held: false, queue: [], raf };
  w.requestAnimationFrame = (cb) => { if (g.held) { g.queue.push(cb); return 0; } return raf(cb); };
  return (k.__vsvGate = g);
}

/* A missing example is answered with 404.html, the studio shell; a frame that cannot be read failed too. */
function failed(f: HTMLIFrameElement): boolean {
  try { return !f.contentDocument || !!f.contentDocument.getElementById('studio-root'); } catch { return true; }
}

/* Still: every CSS animation at its end state (the studio's pause sheet) and the loop held. */
function apply(f: HTMLIFrameElement, play: boolean, settled: boolean) {
  try {
    const d = f.contentDocument;
    if (!d?.documentElement) return;
    syncFrame(f);
    if (play) delete d.documentElement.dataset.motion;
    else d.documentElement.dataset.motion = 'paused';
    const g = f.contentWindow ? gateOf(f.contentWindow) : null;
    if (!g) return;
    g.held = !play && settled;
    if (!g.held) g.queue.splice(0).forEach((cb) => g.raf(cb));
  } catch { /* cross-origin frame: leave it alone */ }
}

export function Thumb({ slug, title, onFail }: { slug: string; title: string; onFail?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const live = useSlot(box);
  const fail = useRef(onFail);
  fail.current = onFail;
  const paused = usePauseMotion();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const play = live && (hover || focus) && !paused;
  const state = useRef({ play, settled: false });
  state.current.play = play;

  /* Hover and focus are the tile's, not the thumbnail's (it takes no pointer events). */
  useEffect(() => {
    const tile = box.current?.closest<HTMLElement>('.wtile');
    if (!tile) return;
    const ac = new AbortController();
    const o = { signal: ac.signal };
    tile.addEventListener('pointerenter', () => setHover(true), o);
    tile.addEventListener('pointerleave', () => setHover(false), o);
    tile.addEventListener('focusin', () => setFocus(true), o);
    tile.addEventListener('focusout', (e) => { if (!tile.contains(e.relatedTarget as Node | null)) setFocus(false); }, o);
    return () => ac.abort();
  }, []);

  /* A live frame: themed and still on load, scaled to its box, re-themed on every flip. */
  useEffect(() => {
    const f = frame.current;
    const b = box.current;
    if (!live || !f || !b) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => apply(f, state.current.play, state.current.settled);
    const onLoad = () => {
      if (failed(f)) { fail.current?.(); return; }
      state.current.settled = false;
      f.dataset.loaded = '';
      sync();
      clearTimeout(timer);
      timer = setTimeout(() => { state.current.settled = true; sync(); }, SETTLE_MS);
    };
    const fit = () => {
      const w = b.clientWidth;
      const h = b.clientHeight;
      if (!w) return;
      f.style.height = `${Math.round((LAYOUT_W * h) / w)}px`;
      f.style.transform = `scale(${w / LAYOUT_W})`;
    };
    f.addEventListener('load', onLoad);
    window.addEventListener('vsv-theme', sync);
    window.addEventListener('vsv-motion', sync);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(b);
    fit();
    return () => {
      clearTimeout(timer);
      f.removeEventListener('load', onLoad);
      window.removeEventListener('vsv-theme', sync);
      window.removeEventListener('vsv-motion', sync);
      ro?.disconnect();
    };
  }, [live]);

  useEffect(() => { if (frame.current) apply(frame.current, play, state.current.settled); }, [play]);

  return (
    <div ref={box} className="gthumb" aria-hidden="true" inert data-playing={play ? '' : undefined}>
      {live
        ? <iframe ref={frame} src={`/examples/${slug}.html`} title={title} tabIndex={-1} />
        : <span className="gthumb-ph" />}
    </div>
  );
}
