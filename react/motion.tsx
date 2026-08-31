import * as React from 'react';
import { cx } from './cx';

/**
 * The motion kit, synthesized from the portfolio's shipped motion and the
 * study of the systems worth studying. Doctrine in code: enter on
 * --ease-entrance, leave for good on --ease-exit, settle direct
 * manipulation on --ease-back; transitions over keyframes wherever motion
 * can be interrupted; JS only writes numbers (custom properties,
 * transforms), the visual math lives in the contract CSS; everything
 * respects prefers-reduced-motion through the contract's guards.
 */

const reduced = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The contract hides pre-reveal content only once JS has declared itself. */
const declareJs = () => {
  if (typeof document !== 'undefined') document.documentElement.classList.add('js');
};

export interface StaggerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** Children fade + rise 10px, 60ms apart (the contract caps the stagger at 6). */
export function Stagger({ className, children, ...rest }: StaggerProps) {
  return (
    <div className={cx('mo-st', className)} {...rest}>
      {children}
    </div>
  );
}

export interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  /** One entry per line; each line gets its own mask. */
  lines: React.ReactNode[];
  /** Start when the element enters the viewport (default) or immediately. */
  onView?: boolean;
}

/** Masked line reveal: lines travel up out of their own clip, 70ms apart. */
export function Reveal({ lines, onView = true, className, ...rest }: RevealProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [inView, setInView] = React.useState(!onView);
  React.useEffect(() => {
    declareJs();
    if (!onView || inView) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onView, inView]);
  // Double-rAF so the closed state paints first and the transition actually runs.
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!inView) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setArmed(true)); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [inView]);
  return (
    <span ref={ref} className={cx('mo-lines', armed && 'in', className)} {...rest}>
      {lines.map((line, i) => (
        <span key={i}><span>{line}</span></span>
      ))}
    </span>
  );
}

export interface SpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Pointer spotlight group: tracks on the CONTAINER so neighboring `.spot`
 * cards begin to glow before the pointer arrives. Give the cards `.spot`.
 * Rect reads are coalesced to one batch per frame.
 */
export function Spotlight({ className, children, onPointerMove, ...rest }: SpotlightProps) {
  const frame = React.useRef(0);
  const last = React.useRef<{ x: number; y: number } | null>(null);
  React.useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(e);
    last.current = { x: e.clientX, y: e.clientY };
    const host = e.currentTarget;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const p = last.current;
      if (!p) return;
      for (const card of host.querySelectorAll<HTMLElement>('.spot')) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${p.x - r.left}px`);
        card.style.setProperty('--my', `${p.y - r.top}px`);
      }
    });
  };
  return (
    <div className={className} {...rest} onPointerMove={handleMove}>
      {children}
    </div>
  );
}

export interface MagneticProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  /** Fraction of the pointer's offset the element follows. */
  strength?: number;
}

/**
 * Follows the pointer at `strength`, settles home on --ease-back. The rect
 * is cached at pointerenter (the element is home then) so the follow never
 * measures its own displacement.
 */
export function Magnetic({ children, strength = 0.3, className, onPointerEnter, onPointerMove, onPointerLeave, ...rest }: MagneticProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const home = React.useRef<{ cx: number; cy: number } | null>(null);
  const handleEnter = (e: React.PointerEvent<HTMLSpanElement>) => {
    onPointerEnter?.(e);
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    home.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };
  const handleMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    onPointerMove?.(e);
    const el = ref.current;
    if (!el || !home.current || reduced()) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${((e.clientX - home.current.cx) * strength).toFixed(1)}px, ${((e.clientY - home.current.cy) * strength).toFixed(1)}px)`;
  };
  const handleLeave = (e: React.PointerEvent<HTMLSpanElement>) => {
    onPointerLeave?.(e);
    const el = ref.current;
    if (!el) return;
    home.current = null;
    el.style.transition = 'transform var(--dur-4) var(--ease-back)';
    el.style.transform = 'translate(0, 0)';
  };
  return (
    <span ref={ref} className={cx('magnet', className)} {...rest} onPointerEnter={handleEnter} onPointerMove={handleMove} onPointerLeave={handleLeave}>
      {children}
    </span>
  );
}

export interface NumberRollProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number | string;
}

/**
 * Rolling number: each digit is a column of 0-9 travelling on transform.
 * Non-digit characters (separators, units) render as plain glyphs. Columns
 * mount at zero and roll to the value, so the entrance IS the roll.
 */
export function NumberRoll({ value, className, ...rest }: NumberRollProps) {
  const chars = String(value).split('');
  const [live, setLive] = React.useState(false);
  React.useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setLive(true)); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, []);
  return (
    <span className={cx('ticker', className)} {...rest}>
      {chars.map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className="td" style={{ '--d': live ? ch : '0' } as React.CSSProperties} aria-hidden="true">
            {'0123456789'.split('').map((d) => <i key={d}>{d}</i>)}
          </span>
        ) : (
          <span key={i} aria-hidden="true">{ch}</span>
        ),
      )}
      <span className="sr-only">{String(value)}</span>
    </span>
  );
}
