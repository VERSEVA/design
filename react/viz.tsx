import * as React from 'react';
import { cx } from './cx';

/**
 * The chart kit, synthesized from the portfolio's shipped viz. Doctrine in
 * code: numbers ON the marks, no gridline forests (a reference line at
 * most), one magnitude hue (--data-3) plus the fixed second series
 * (--data-alt, dashed as its secondary encoding), deltas colored by
 * MEANING, hover as the default layer on plots. All colors are CSS vars;
 * no hex ever enters this file.
 */

const pts = (vals: number[], w: number, h: number, pad = 4, max?: number) => {
  const top = max ?? Math.max(...vals, 1);
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  return vals.map((v, i) => [
    pad + (vals.length === 1 ? iw / 2 : (iw * i) / (vals.length - 1)),
    pad + ih * (1 - v / top),
  ] as const);
};
const linePath = (p: readonly (readonly [number, number])[]) =>
  p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
const areaPath = (p: readonly (readonly [number, number])[], h: number, pad = 4) =>
  `M${p[0][0].toFixed(1)} ${h - pad} ${linePath(p).slice(1)} L${p[p.length - 1][0].toFixed(1)} ${h - pad} Z`;

export interface SparklineProps {
  values: number[];
  /** Fixed scale top; defaults to the series max. */
  max?: number;
  area?: boolean;
  className?: string;
}

/** Trend-at-a-glance: line + last-point dot, optional soft area. */
export function Sparkline({ values, max, area = true, className }: SparklineProps) {
  const id = React.useId();
  const W = 140;
  const H = 40;
  const p = pts(values, W, H, 4, max);
  const last = p[p.length - 1];
  return (
    <span className={cx('spark', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {area && (
          <>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--data-3)" stopOpacity="0.26" />
                <stop offset="1" stopColor="var(--data-3)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath(p, H)} fill={`url(#${id})`} />
          </>
        )}
        <path d={linePath(p)} fill="none" stroke="var(--data-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="3" fill="var(--data-3)" />
      </svg>
    </span>
  );
}

export interface LineChartProps {
  labels: string[];
  series: { name: string; values: number[] }[];
  /** A dashed reference line (an average, a target) with its mono tag. */
  reference?: { value: number; label: string };
  height?: number;
  /** Formats the hover readout; defaults to the raw number. */
  format?: (v: number) => string;
  className?: string;
}

/**
 * One or two series (a third folds to small multiples, never a new hue).
 * Series two rides --data-alt AND a dash, so identity survives print and
 * CVD. Hover is the default layer: crosshair + readout.
 */
export function LineChart({ labels, series, reference, height = 140, format = String, className }: LineChartProps) {
  const id = React.useId();
  const W = 320;
  const pad = 6;
  const shown = series.slice(0, 2);
  const top = Math.max(...shown.flatMap((s) => s.values), reference?.value ?? 1);
  const [hover, setHover] = React.useState<number | null>(null);
  const all = shown.map((s) => pts(s.values, W, height, pad, top));
  const refY = reference ? pad + (height - pad * 2) * (1 - reference.value / top) : 0;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    const n = labels.length;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((x - pad) / (W - pad * 2)) * (n - 1)))));
  };

  return (
    <div className={cx('vizplot', className)}>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img"
        aria-label={shown.map((s) => s.name).join(' vs ')}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {reference && <line className="refline" x1={pad} y1={refY} x2={W - pad} y2={refY} />}
        {all.map((p, si) => (
          <g key={shown[si].name}>
            {si === 0 && (
              <>
                <defs>
                  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--data-3)" stopOpacity="0.22" />
                    <stop offset="1" stopColor="var(--data-3)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={areaPath(p, height, pad)} fill={`url(#${id})`} />
              </>
            )}
            <path d={linePath(p)} fill="none"
              stroke={si === 0 ? 'var(--data-3)' : 'var(--data-alt)'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={si === 1 ? '5 4' : undefined} />
            <circle cx={p[p.length - 1][0]} cy={p[p.length - 1][1]} r="3"
              fill={si === 0 ? 'var(--data-3)' : 'var(--data-alt)'} />
          </g>
        ))}
        {hover !== null && (
          <g>
            <line x1={all[0][hover][0]} y1={pad} x2={all[0][hover][0]} y2={height - pad}
              stroke="var(--text-3)" strokeWidth="1" opacity="0.5" />
            {all.map((p, si) => (
              <circle key={si} cx={p[hover][0]} cy={p[hover][1]} r="4"
                fill={si === 0 ? 'var(--data-3)' : 'var(--data-alt)'}
                stroke="var(--surface)" strokeWidth="2" />
            ))}
          </g>
        )}
      </svg>
      {reference && <span className="reftag" style={{ top: `${(refY / height) * 100}%` }}>{reference.label}</span>}
      {hover !== null && (
        <div className="viztip" role="status">
          <b>{labels[hover]}</b>
          {shown.map((s) => <span key={s.name}>{s.name} {format(s.values[hover])}</span>)}
        </div>
      )}
      <div className="xlabels mt-2" aria-hidden="true">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
      {shown.length > 1 && (
        <div className="vizlegend mt-2">
          <span><i /> {shown[0].name}</span>
          <span><i className="alt" /> {shown[1].name}</span>
        </div>
      )}
    </div>
  );
}

export interface BarsProps {
  data: { label: string; value: number; level?: 0 | 1 | 2 | 3 }[];
  /** Prints each value on/above its mark, the portfolio default. */
  showValues?: boolean;
  height?: number;
  className?: string;
}

/** Vertical bars, numbers on the marks, no axis. */
export function Bars({ data, showValues = true, height = 120, className }: BarsProps) {
  const top = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cx(className)}>
      <div className="bars" style={{ height }}>
        {data.map((d) => (
          <div className="bar" key={d.label} title={`${d.label}: ${d.value}`}>
            {showValues && <span className="vlab">{d.value}</span>}
            <div className="fill" style={{ height: `${(d.value / top) * 100}%`, background: d.level !== undefined ? `var(--data-${d.level})` : undefined }} />
            <span className="mlab">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface HBarsProps {
  data: { label: string; value: number; alt?: boolean }[];
  format?: (v: number) => string;
  className?: string;
}

/** Label / track / mono count rows: the axis-free distribution. */
export function HBars({ data, format = String, className }: HBarsProps) {
  const top = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cx('hbars', className)}>
      {data.map((d) => (
        <div className="hbar" key={d.label} title={`${d.label}: ${format(d.value)}`}>
          <span className="hlabel">{d.label}</span>
          <span className="htrack"><i className={d.alt ? 'alt' : undefined} style={{ width: `${(d.value / top) * 100}%` }} /></span>
          <span className="hcount">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

export interface RingProps {
  /** 0..100 */
  value: number;
  /** The actionable center number (UFITRA law: "1,059 left", not the total). */
  center: string;
  sub?: string;
  size?: number;
  className?: string;
}

/** Progress/readiness ring on the token ladder. */
export function Ring({ value, center, sub, size = 74, className }: RingProps) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <span className={cx('ring', className)} role="img" aria-label={`${center}${sub ? ` ${sub}` : ''}: ${value}%`}>
      <span className="rdial">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle className="ringtrack" cx={size / 2} cy={size / 2} r={r} />
          <circle className="ringfill" cx={size / 2} cy={size / 2} r={r}
            strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - value / 100)).toFixed(1)} />
        </svg>
        <span className="rv"><b>{center}</b></span>
      </span>
      {sub && <small className="rlbl">{sub}</small>}
    </span>
  );
}

export interface ActivityStripProps {
  /** Intensity levels 0..3, one cell each; the shared activity language. */
  levels: (0 | 1 | 2 | 3)[];
  todayIndex?: number;
  labels?: string[];
  className?: string;
}

export function ActivityStrip({ levels, todayIndex, labels, className }: ActivityStripProps) {
  return (
    <span className={cx('actstrip', className)} role="img" aria-label={`activity: ${levels.join(', ')}`}>
      {levels.map((l, i) => (
        <i key={i} data-l={l || undefined} className={i === todayIndex ? 'today' : undefined}
          title={labels?.[i] ? `${labels[i]}: level ${l}` : undefined} />
      ))}
    </span>
  );
}

export interface TrendProps {
  /** The rendered delta, sign included ("+4 kg", "−52 s"). */
  delta: string;
  /** Judgment, not direction: a falling 5K time is good. */
  judgment: 'good' | 'bad' | 'flat';
  className?: string;
}

export function Trend({ delta, judgment, className }: TrendProps) {
  const arrow = delta.trim().startsWith('−') || delta.trim().startsWith('-') ? '↓' : judgment === 'flat' ? '→' : '↑';
  return <span className={cx('trend', judgment, className)}>{arrow} {delta}</span>;
}
