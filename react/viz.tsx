import * as React from 'react';
import { cx } from './cx';
import { VIZ_LABELS, type VizLabels } from './viz-state';

/**
 * The chart kit, synthesized from the portfolio's shipped viz. Doctrine in
 * code: numbers ON the marks, no gridline forests (a reference line at
 * most), one magnitude hue (--data-3) plus the fixed second series
 * (--data-alt, dashed as its secondary encoding), deltas colored by
 * MEANING, hover as the default layer on plots. All colors are CSS vars;
 * no hex ever enters this file.
 *
 * Withheld data (1.7.1). A null in a line is a gap: the line and its area
 * break there, no point is drawn, it is never zero or bridged, and a thin
 * baseline segment says the stretch is withheld, not broken. A suppressed
 * bar is a privacy floor: its value is never read, so it cannot reach a bar
 * length, the scale, a title or any attribute. The word for withheld is
 * copy: `vizLabels` overrides it (defaults in viz-state.ts).
 */

declare const process: { env: { NODE_ENV?: string } };
/** True unless a bundler has set production; with no bundler there is no `process`, which is a dev setup. */
const DEV = (() => { try { return process.env.NODE_ENV !== 'production'; } catch { return true; } })();

type Pt = readonly [number, number];
/** A value the chart can draw. Null, undefined, NaN and the infinities are gaps. */
const known = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** One slot per index, so a gap keeps its place on the x axis; a gap has no point. */
const pts = (vals: readonly (number | null)[], w: number, h: number, pad = 4, max?: number): (Pt | null)[] => {
  const top = max ?? Math.max(...vals.filter(known), 1);
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  return vals.map((v, i) => (known(v) ? [
    pad + (vals.length === 1 ? iw / 2 : (iw * i) / (vals.length - 1)),
    pad + ih * (1 - v / top),
  ] as const : null));
};
/** The unbroken runs of points between gaps. */
const runs = (p: readonly (Pt | null)[]) => {
  const out: Pt[][] = [];
  let run: Pt[] | null = null;
  for (const pt of p) {
    if (!pt) { run = null; continue; }
    if (!run) out.push((run = []));
    run.push(pt);
  }
  return out;
};
const seg = (p: readonly Pt[]) =>
  p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
/** A run wide enough to stroke or fill; a series of one value keeps the path it always had. */
const drawn = (p: readonly (Pt | null)[]) => runs(p).filter((r) => r.length > 1 || p.length === 1);
/** One subpath per run; empty when no run is wide enough. */
const linePath = (p: readonly (Pt | null)[]) => drawn(p).map(seg).join(' ');
/** One closed subpath per run, so the fill stops at a gap. */
const areaPath = (p: readonly (Pt | null)[], h: number, pad = 4) =>
  drawn(p).map((r) => `M${r[0][0].toFixed(1)} ${h - pad} ${seg(r).slice(1)} L${r[r.length - 1][0].toFixed(1)} ${h - pad} Z`).join(' ');
/** A value alone between gaps has no line to sit on: it is a dot. The last index is the end dot's. */
const lone = (p: readonly (Pt | null)[]) =>
  p.length === 1 ? [] : p.filter((pt, i): pt is Pt => !!pt && !p[i - 1] && !p[i + 1] && i < p.length - 1);
/** Each gap's stretch along x, from the point before it to the point after (or the plot's edge). */
const gaps = (p: readonly (Pt | null)[], w: number, pad: number) => {
  const out: [number, number][] = [];
  if (!p.some(Boolean)) return out;
  const x = (i: number) => pad + ((w - pad * 2) * i) / (p.length - 1);
  for (let i = 0; i < p.length; i++) {
    if (p[i]) continue;
    let j = i;
    while (j + 1 < p.length && !p[j + 1]) j++;
    out.push([x(Math.max(i - 1, 0)), x(Math.min(j + 1, p.length - 1))]);
    i = j;
  }
  return out;
};
/** The 1px baseline marks under a series' gaps: withheld, not a rendering fault. */
const gapMarks = (p: readonly (Pt | null)[], w: number, h: number, pad: number) =>
  gaps(p, w, pad).map(([x1, x2]) => (
    <line key={x1} data-gap="" x1={x1} y1={h - pad} x2={x2} y2={h - pad} stroke="var(--text-3)" strokeWidth="1" />
  ));

export interface SparklineProps {
  /** A null is a gap: the line breaks there and no point is drawn. */
  values: (number | null)[];
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
  const fill = area ? areaPath(p, H) : '';
  const line = linePath(p);
  const last = p[p.length - 1];
  return (
    <span className={cx('spark', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {fill && (
          <>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--data-3)" stopOpacity="0.26" />
                <stop offset="1" stopColor="var(--data-3)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={fill} fill={`url(#${id})`} />
          </>
        )}
        {gapMarks(p, W, H, 4)}
        {line && <path d={line} fill="none" stroke="var(--data-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        {lone(p).map(([x, y]) => <circle key={x} cx={x} cy={y} r="3" fill="var(--data-3)" />)}
        {last && <circle cx={last[0]} cy={last[1]} r="3" fill="var(--data-3)" />}
      </svg>
    </span>
  );
}

export interface LineChartProps {
  labels: string[];
  /** A null is a gap in that series: no line, no point, and hover names it withheld. */
  series: { name: string; values: (number | null)[] }[];
  /** A dashed reference line (an average, a target) with its mono tag. */
  reference?: { value: number; label: string };
  height?: number;
  /** Formats the hover readout; defaults to the raw number. */
  format?: (v: number) => string;
  /** Copy: the word a gap shows on hover. */
  vizLabels?: Partial<VizLabels>;
  className?: string;
}

/**
 * One or two series (a third folds to small multiples, never a new hue).
 * Series two rides --data-alt AND a dash, so identity survives print and
 * CVD. Hover is the default layer: crosshair + readout.
 */
export function LineChart({ labels, series, reference, height = 140, format = String, vizLabels, className }: LineChartProps) {
  const id = React.useId();
  const L = { ...VIZ_LABELS, ...vizLabels };
  const W = 320;
  const pad = 6;
  const shown = series.slice(0, 2);
  const top = Math.max(...shown.flatMap((s) => s.values.filter(known)), reference?.value ?? 1);
  const [hover, setHover] = React.useState<number | null>(null);
  const all = shown.map((s) => pts(s.values, W, height, pad, top));
  const hoverX = hover === null ? undefined : all.find((p) => p[hover])?.[hover]?.[0];
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
        {all.map((p, si) => {
          const last = p[p.length - 1];
          const fill = si === 0 ? areaPath(p, height, pad) : '';
          const line = linePath(p);
          const hue = si === 0 ? 'var(--data-3)' : 'var(--data-alt)';
          return (
          <g key={shown[si].name}>
            {p.some(Boolean) && <>
            {fill && (
              <>
                <defs>
                  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--data-3)" stopOpacity="0.22" />
                    <stop offset="1" stopColor="var(--data-3)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={fill} fill={`url(#${id})`} />
              </>
            )}
            {gapMarks(p, W, height, pad)}
            {line && <path d={line} fill="none"
              stroke={hue}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={si === 1 ? '5 4' : undefined} />}
            {lone(p).map(([x, y]) => <circle key={x} cx={x} cy={y} r="3" fill={hue} />)}
            {last && <circle cx={last[0]} cy={last[1]} r="3"
              fill={hue} />}
            </>}
          </g>
          );
        })}
        {hover !== null && (
          <g>
            {hoverX !== undefined && (
              <line x1={hoverX} y1={pad} x2={hoverX} y2={height - pad}
                stroke="var(--text-3)" strokeWidth="1" opacity="0.5" />
            )}
            {all.map((p, si) => { const h = p[hover]; return h && (
              <circle key={si} cx={h[0]} cy={h[1]} r="4"
                fill={si === 0 ? 'var(--data-3)' : 'var(--data-alt)'}
                stroke="var(--surface)" strokeWidth="2" />
            ); })}
          </g>
        )}
      </svg>
      {reference && <span className="reftag" style={{ top: `${(refY / height) * 100}%` }}>{reference.label}</span>}
      {hover !== null && (
        <div className="viztip" role="status">
          <b>{labels[hover]}</b>
          {shown.map((s) => {
            const v = s.values[hover];
            if (v === undefined) return null;
            return known(v)
              ? <span key={s.name}>{s.name} {format(v)}</span>
              : <span key={s.name} data-withheld="">{s.name} {L.withheld}</span>;
          })}
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

/**
 * `display` replaces the printed value; the bar still draws from `value`, so it is NOT a privacy floor.
 * `suppressed: true` is: it needs a `display` (the floor label, "<5"), draws the withheld stub and no
 * fill, and nothing is read from `value`, which also stays out of the scale.
 */
type Shown = { display?: string; suppressed?: false } | { display: string; suppressed: true };
export type BarsItem = { label: string; value: number; level?: 0 | 1 | 2 | 3 } & Shown;
export type HBarsItem = { label: string; value: number; alt?: boolean } & Shown;

/** A suppressed item that slipped past the types with no display: said once per set, in development, by label only. */
function useMissingDisplay(part: string, data: readonly { label: string; suppressed?: boolean; display?: string }[]) {
  const missing = data.filter((d) => d.suppressed && d.display === undefined).map((d) => d.label).join('", "');
  React.useEffect(() => {
    if (missing && DEV) console.warn(`${part}: suppressed item "${missing}" has no display; it prints no label. Pass the floor label, for example display: "<5".`);
  }, [part, missing]);
}

export interface BarsProps {
  data: BarsItem[];
  /** Prints each value on/above its mark, the portfolio default. */
  showValues?: boolean;
  height?: number;
  /** Copy: the word a suppressed item with no display carries in its title. */
  vizLabels?: Partial<VizLabels>;
  className?: string;
}

/** Vertical bars, numbers on the marks, no axis. */
export function Bars({ data, showValues = true, height = 120, vizLabels, className }: BarsProps) {
  const L = { ...VIZ_LABELS, ...vizLabels };
  useMissingDisplay('Bars', data);
  const top = Math.max(...data.filter((d) => !d.suppressed).map((d) => d.value), 1);
  return (
    <div className={cx(className)}>
      <div className="bars" style={{ height }}>
        {data.map((d) => {
          if (d.suppressed) {
            const display: string | undefined = d.display;
            return (
              <div className="bar" key={d.label} title={`${d.label}: ${display ?? L.withheld}`} data-suppressed="">
                {showValues && display !== undefined && <span className="vlab">{display}</span>}
                <div className="vtrack" />
                <span className="mlab">{d.label}</span>
              </div>
            );
          }
          const shown = d.display ?? d.value;
          return (
          <div className="bar" key={d.label} title={`${d.label}: ${shown}`}>
            {showValues && <span className="vlab">{shown}</span>}
            <div className="fill" style={{ height: `${(d.value / top) * 100}%`, background: d.level !== undefined ? `var(--data-${d.level})` : undefined }} />
            <span className="mlab">{d.label}</span>
          </div>
          );
        })}
      </div>
    </div>
  );
}

export interface HBarsProps {
  /** `format` never sees a suppressed value. */
  data: HBarsItem[];
  format?: (v: number) => string;
  /** Copy: the word a suppressed item with no display carries in its title. */
  vizLabels?: Partial<VizLabels>;
  className?: string;
}

/** Label / track / mono count rows: the axis-free distribution. */
export function HBars({ data, format = String, vizLabels, className }: HBarsProps) {
  const L = { ...VIZ_LABELS, ...vizLabels };
  useMissingDisplay('HBars', data);
  const top = Math.max(...data.filter((d) => !d.suppressed).map((d) => d.value), 1);
  return (
    <div className={cx('hbars', className)}>
      {data.map((d) => {
        if (d.suppressed) {
          const display: string | undefined = d.display;
          return (
            <div className="hbar" key={d.label} title={`${d.label}: ${display ?? L.withheld}`} data-suppressed="">
              <span className="hlabel">{d.label}</span>
              <span className="htrack" />
              <span className="hcount">{display}</span>
            </div>
          );
        }
        const shown = d.display ?? format(d.value);
        return (
        <div className="hbar" key={d.label} title={`${d.label}: ${shown}`}>
          <span className="hlabel">{d.label}</span>
          <span className="htrack"><i className={d.alt ? 'alt' : undefined} style={{ width: `${(d.value / top) * 100}%` }} /></span>
          <span className="hcount">{shown}</span>
        </div>
        );
      })}
    </div>
  );
}

export interface RingProps {
  /** 0..100 */
  value: number;
  /** The actionable center number ("1,059 left", not the total). */
  center: string;
  sub?: string;
  size?: number;
  className?: string;
}

/** Progress/readiness ring on the token ladder. */
export function Ring({ value, center, sub, size = 74, className }: RingProps) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <span className={cx('ring', className)} role="img" aria-label={`${center}${sub ? ` ${sub}` : ''}: ${pct}%`}>
      <span className="rdial">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle className="ringtrack" cx={size / 2} cy={size / 2} r={r} />
          <circle className="ringfill" cx={size / 2} cy={size / 2} r={r}
            strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - pct / 100)).toFixed(1)} />
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
