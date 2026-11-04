import * as React from 'react';
import { cx } from './cx';

export interface StackPage { label: string; content: React.ReactNode }

export interface SmartStackLabels {
  pause: string;
  resume: string;
  /** Dot name. */
  show: (label: string, index: number, total: number) => string;
  /** Slide name. */
  slide: (label: string, index: number, total: number) => string;
}

export const SMART_STACK_LABELS: SmartStackLabels = {
  pause: 'Pause rotation',
  resume: 'Resume rotation',
  show: (label) => `Show ${label}`,
  slide: (label, i, n) => `${i + 1} of ${n}: ${label}`,
};

export interface SmartStackProps {
  pages: readonly StackPage[];
  /** The stack's name, e.g. "Live now". */
  label: string;
  /** Rotation period in ms. Default 6000; 0 turns the timer off. */
  interval?: number;
  /** Stop rotating from outside, e.g. while the grid is in edit mode. */
  paused?: boolean;
  defaultIndex?: number;
  labels?: Partial<SmartStackLabels>;
  className?: string;
}

const PAUSE = <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>;
const PLAY = <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/**
 * Several widgets in one slot. Moves by wheel, vertical swipe, the dots, or a timer that pauses on
 * hover, on focus inside, through the visible pause button, while the page is hidden, and is off
 * under reduced motion (WCAG 2.2.2). Hidden pages are inert.
 */
export function SmartStack({ pages, label, interval = 6000, paused = false, defaultIndex = 0, labels, className }: SmartStackProps) {
  const L = { ...SMART_STACK_LABELS, ...labels };
  const n = pages.length;
  const [index, setIndex] = React.useState(() => Math.min(Math.max(defaultIndex, 0), Math.max(n - 1, 0)));
  const [userPaused, setUserPaused] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [focusIn, setFocusIn] = React.useState(false);
  const [userMoved, setUserMoved] = React.useState(false);
  const reduced = useReducedMotion();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const cur = n ? ((index % n) + n) % n : 0;
  const timerOn = n > 1 && interval > 0 && !reduced;
  const running = timerOn && !paused && !userPaused && !hover && !focusIn;

  const go = React.useCallback((i: number, byUser = true) => {
    if (n < 2) return;
    setIndex(((i % n) + n) % n);
    if (byUser) setUserMoved(true);
  }, [n]);

  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => { if (!document.hidden) setIndex((i) => (i + 1) % n); }, interval);
    return () => clearInterval(t);
  }, [running, interval, n]);

  // Wheel needs a non-passive listener to keep the page from scrolling under the stack.
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || n < 2 || paused) return;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      const now = Date.now();
      if (now - last < 450) return;
      last = now;
      setIndex((i) => (((i + (e.deltaY > 0 ? 1 : -1)) % n) + n) % n);
      setUserMoved(true);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [n, paused]);

  const touchY = React.useRef<number | null>(null);

  return (
    <div
      ref={rootRef}
      className={cx('wstack', className)}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocusIn(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusIn(false); }}
      onTouchStart={(e) => { touchY.current = e.touches[0]?.clientY ?? null; }}
      onTouchEnd={(e) => {
        const y0 = touchY.current;
        touchY.current = null;
        const y1 = e.changedTouches[0]?.clientY;
        if (paused || y0 === null || y1 === undefined || Math.abs(y1 - y0) < 30) return;
        go(cur + (y1 < y0 ? 1 : -1));
      }}
    >
      <div className="wstack-pages" aria-live={running || !userMoved ? 'off' : 'polite'}>
        {pages.map((p, i) => (
          <div
            key={i}
            className="wstack-page"
            data-pos={i === cur ? 'cur' : i < cur ? 'prev' : 'next'}
            role="group"
            aria-roledescription="slide"
            aria-label={L.slide(p.label, i, n)}
            aria-hidden={i === cur ? undefined : true}
            inert={i !== cur}
          >
            {p.content}
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="wstack-nav">
          {timerOn && (
            <button type="button" className="wstack-pause" aria-label={userPaused ? L.resume : L.pause} onClick={() => setUserPaused((v) => !v)}>
              {userPaused ? PLAY : PAUSE}
            </button>
          )}
          {pages.map((p, i) => (
            <button key={i} type="button" className="wstack-dot" aria-label={L.show(p.label, i, n)} aria-current={i === cur ? true : undefined} onClick={() => go(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
