'use client';
import * as React from 'react';
import { cx } from './cx';
import { VIZ_LABELS, VIZ_FLOOR, type VizLabels } from './labels';
import { chartCap } from './bounded-state';

/**
 * The chart kit, synthesized from the portfolio's shipped viz. Doctrine in
 * code: numbers ON the marks, no gridline forests (a reference line at
 * most), one magnitude hue (--data-3) plus the fixed second series
 * (--data-alt, dashed as its secondary encoding), deltas colored by
 * MEANING, hover as the default layer on plots. All colors are CSS vars;
 * no hex ever enters this file.
 *
 * Withheld data (1.8.0). A null in a line is a gap: the line and its area
 * break there, no point is drawn, it is never zero or bridged, and a hatched
 * band under the plot says those indices are withheld, not broken (HTML over
 * the plot, so the hatch never stretches with it; all nulls is one full band). A suppressed
 * bar is a privacy floor: its value is never read, so it cannot reach a bar
 * length, the scale, a title or any attribute. The word for withheld is
 * copy: `vizLabels` overrides it (defaults in labels.ts).
 *
 * The values as a table (1.8). Every part also renders its values as a visually hidden data table
 * (`.sr-only`), so keyboard, touch and screen reader users reach what `title` gives a pointer; the plot
 * is then aria-hidden. `label` is its caption (default `vizLabels.table`; a LineChart is named by its series). `table={false}` opts out, for a decorative sparkline
 * beside a number that already says it; the part then renders as it did before.
 *
 * Bounded charts (1.8). `cap` on Bars and HBars keeps the first `cap` items by position (the kit never sorts)
 * and folds the rest into one Other mark, last, on the alt fill (Other is extra: `cap` + 1 marks). Other is a privacy floor of its own: a
 * suppressed item is never read into it and makes it suppressed, and so does a total under VIZ_FLOOR. `cap`
 * on LineChart keeps the newest `cap` points and drops the oldest, and says so in its legend and caption.
 * Without `cap` each part renders exactly as before.
 */

declare const process: { env: { NODE_ENV?: string } };
/** True unless a bundler has set production; with no bundler there is no `process`, which is a dev setup. */
const DEV = (() => { try { return process.env.NODE_ENV !== 'production'; } catch { return true; } })();

type Pt = readonly [number, number];
/** A value the chart can draw. Null, undefined, NaN and the infinities are gaps. */
const known = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * The gap band: below the zero baseline by 2 plot units (it scales with the stroke, so a large plot keeps the
 * clearance) or `--s-1`, whichever is larger (the stylesheet takes the max of the two custom properties the
 * band carries), and `--s-1` tall; a chart with a gap keeps this much room under its plot.
 */
const BAND_GAP = 2;
const BAND = 4;
/** A series that draws a band: any gap at all. All gaps is one band across the plot; an empty array is not a gap. */
const hasGap = (vals: readonly (number | null)[]) => vals.some((v) => !known(v));
/** Room under the plot for the band; none for a series with no gap, so it renders as it always did. */
const reserve = (gapped: boolean) => (gapped ? BAND_GAP + BAND : 0);

/** One slot per index, so a gap keeps its place on the x axis; a gap has no point. `foot` is the room kept under the plot. */
const pts = (vals: readonly (number | null)[], w: number, h: number, pad = 4, max?: number, foot = 0): (Pt | null)[] => {
  const top = max ?? Math.max(...vals.filter(known), 1);
  const iw = w - pad * 2;
  const ih = h - pad * 2 - foot;
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
/** One closed subpath per run down to the baseline, so the fill stops at a gap. */
const areaPath = (p: readonly (Pt | null)[], base: number) =>
  drawn(p).flatMap((r) => {
    const a = r[0];
    const z = r[r.length - 1];
    return a && z ? [`M${a[0].toFixed(1)} ${base} ${seg(r).slice(1)} L${z[0].toFixed(1)} ${base} Z`] : [];
  }).join(' ');
/** A value alone between gaps has no line to sit on: it is a dot. The last index is the end dot's. */
const lone = (p: readonly (Pt | null)[]) =>
  p.length === 1 ? [] : p.filter((pt, i): pt is Pt => !!pt && !p[i - 1] && !p[i + 1] && i < p.length - 1);
/**
 * Each gap's own stretch along x, from which indices are null and nothing else: its null indices and half a
 * step either side (the midpoint to the next known point), clipped to the plot. It never runs under a known
 * value, so a gap at an end takes the half step there is. All nulls is the whole plot.
 */
const gaps = (p: readonly (Pt | null)[], w: number, pad: number) => {
  const out: [number, number][] = [];
  if (p.length < 2 || !p.some(Boolean)) return p.length && !p.some(Boolean) ? [[pad, w - pad] as [number, number]] : out;
  const step = (w - pad * 2) / (p.length - 1);
  for (let i = 0; i < p.length; i++) {
    if (p[i]) continue;
    let j = i;
    while (j + 1 < p.length && !p[j + 1]) j++;
    out.push([Math.max(pad, pad + step * (i - 0.5)), Math.min(w - pad, pad + step * (j + 0.5))]);
    i = j;
  }
  return out;
};
/**
 * The bands under the gaps, drawn over the plot's frame in percent: withheld, not zero and not a rendering
 * fault. They are HTML, not part of the stretched svg, so the hatch keeps the bar stub's angle and height.
 */
const gapBands = (series: readonly (readonly (Pt | null)[])[], w: number, h: number, base: number, pad: number) => {
  /* One row per chart: stretches that touch or overlap across series become one band, so the hatch never doubles. */
  const merged: [number, number][] = [];
  for (const [a, b] of series.flatMap((p) => gaps(p, w, pad)).sort((x, y) => x[0] - y[0])) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 0.001) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged.map(([x1, x2]) => (
    <i key={x1} className="vizgap" aria-hidden="true"
      style={{ left: `${(x1 / w) * 100}%`, width: `${((x2 - x1) / w) * 100}%`, '--vizband-base': `${(base / h) * 100}%`, '--vizband-top': `${((base + BAND_GAP) / h) * 100}%` } as React.CSSProperties} />
  ));
};

type Row = readonly [string, readonly string[]];
/**
 * The hidden data table: one row per item or x label, one column per series. A withheld cell holds what
 * the part prints (a suppressed item's display, the withheld word for a LineChart null, or empty for a
 * Sparkline null), never a value.
 */
const dataTable = (name: string, cols: readonly string[], rows: readonly Row[]) => (
  <div className="sr-only">
    <table className="table">
      <caption>{name}</caption>
      <thead><tr><td />{cols.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>
      <tbody>{rows.map(([h, cells], i) => <tr key={i}><th scope="row">{h}</th>{cells.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);
/** A table's caption, with the window note when the chart dropped its oldest points. */
const caption = (name: string, note?: string) => (note ? `${name}, ${note}` : name);
/**
 * The same table from ARIA roles on spans, for Sparkline: it sits in phrasing content (a sentence, a
 * paragraph), where a <table> would close the <p> on parse and spill out of its hidden wrapper.
 */
const spanTable = (name: string, cols: readonly string[], rows: readonly Row[]) => (
  <span className="sr-only">
    <span role="table" aria-label={name}>
      <span role="row"><span role="cell" />{cols.map((c, i) => <span key={i} role="columnheader">{c}</span>)}</span>
      {rows.map(([h, cells], i) => <span key={i} role="row"><span role="rowheader">{h}</span>{cells.map((c, j) => <span key={j} role="cell">{c}</span>)}</span>)}
    </span>
  </span>
);

/** An all-null chart shows a band and nothing else, which can read as loading: it says the word in the plot. */
const gapWord = (series: readonly (readonly (Pt | null)[])[], word: string) =>
  series.some((p) => p.length > 0) && !series.some((p) => p.some(Boolean)) ? <span className="vizgap-word">{word}</span> : null;

export interface SparklineProps {
  /** A null is a gap: the line breaks there and no point is drawn. */
  values: (number | null)[];
  /** Fixed scale top; defaults to the series max. */
  max?: number;
  area?: boolean;
  /** Caption of the hidden data table. */
  label?: string;
  /** False drops the hidden data table: only for a decorative sparkline beside a number that says it. */
  table?: boolean;
  /** Copy: the word an all-null sparkline shows, and the table's value header. */
  vizLabels?: Partial<VizLabels>;
  className?: string;
}

/** Trend-at-a-glance: line + last-point dot, optional soft area. */
export function Sparkline({ values, max, area = true, label, table = true, vizLabels, className }: SparklineProps) {
  const id = React.useId();
  const L = { ...VIZ_LABELS, ...vizLabels };
  const W = 140;
  const H = 40;
  const gapped = hasGap(values);
  const base = H - 4 - reserve(gapped);
  const p = pts(values, W, H, 4, max, reserve(gapped));
  const fill = area ? areaPath(p, base) : '';
  const line = linePath(p);
  const last = p[p.length - 1];
  const plot = (
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
        {line && <path d={line} fill="none" stroke="var(--data-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        {lone(p).map(([x, y]) => <circle key={x} cx={x} cy={y} r="3" fill="var(--data-3)" />)}
        {last && <circle cx={last[0]} cy={last[1]} r="3" fill="var(--data-3)" />}
      </svg>
  );
  return (
    <span className={cx('spark', className)}>
      {gapped ? <span className="vizframe">{plot}{gapBands([p], W, H, base, 4)}{gapWord([p], L.withheld)}</span> : plot}
      {table && spanTable(label ?? L.table, [L.value], values.map((v, i) => [String(i + 1), [known(v) ? String(v) : '']]))}
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
  /** The time window: keeps the newest `cap` points of every series and drops the oldest. Absent draws them all. */
  cap?: number;
  /** Caption of the hidden data table. */
  label?: string;
  /** False drops the hidden data table and keeps the plot as a named image. */
  table?: boolean;
  /** Copy: the word a gap shows on hover, and an all-null chart shows in its plot; the window note. */
  vizLabels?: Partial<VizLabels>;
  className?: string;
}

/**
 * One or two series (a third folds to small multiples, never a new hue).
 * Series two rides --data-alt AND a dash, so identity survives print and
 * CVD. Hover is the default layer: crosshair + readout.
 */
export function LineChart({ labels: every, series: whole, reference, height = 140, format = String, cap, label, table = true, vizLabels, className }: LineChartProps) {
  const id = React.useId();
  const L = { ...VIZ_LABELS, ...vizLabels };
  const W = 320;
  const pad = 6;
  /* The window: one index range from the labels, so a short series stays aligned; the oldest points go. */
  const keep = chartCap(cap);
  const from = keep !== undefined && every.length > keep ? every.length - keep : 0;
  const windowed = from > 0;
  const labels = windowed ? every.slice(from) : every;
  const series = windowed ? whole.map((s) => ({ ...s, values: s.values.slice(from, every.length) })) : whole;
  const shown = series.slice(0, 2);
  const top = Math.max(...shown.flatMap((s) => s.values.filter(known)), reference?.value ?? 1);
  const [hover, setHover] = React.useState<number | null>(null);
  const gapped = shown.some((s) => hasGap(s.values));
  const foot = reserve(gapped);
  const base = height - pad - foot;
  const all = shown.map((s) => pts(s.values, W, height, pad, top, foot));
  const hoverX = hover === null ? undefined : all.find((p) => p[hover])?.[hover]?.[0];
  const refY = reference ? pad + (height - pad * 2 - foot) * (1 - reference.value / top) : 0;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    const n = labels.length;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((x - pad) / (W - pad * 2)) * (n - 1)))));
  };

  const plot = (
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none"
        {...(table ? { 'aria-hidden': 'true' as const } : { role: 'img', 'aria-label': shown.map((s) => s.name).join(' vs ') })}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {reference && <line className="refline" x1={pad} y1={refY} x2={W - pad} y2={refY} />}
        {all.map((p, si) => {
          const last = p[p.length - 1];
          const fill = si === 0 ? areaPath(p, base) : '';
          const line = linePath(p);
          const hue = si === 0 ? 'var(--data-3)' : 'var(--data-alt)';
          return (
          <g key={shown[si]?.name}>
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
              <line x1={hoverX} y1={pad} x2={hoverX} y2={base}
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
  );

  return (
    <div className={cx('vizplot', className)}>
      {gapped ? <span className="vizframe">{plot}{gapBands(all, W, height, base, pad)}{gapWord(all, L.withheld)}</span> : plot}
      {reference && <span className="reftag" style={{ top: `${(refY / height) * 100}%` }} aria-hidden={table ? 'true' : undefined}>{reference.label}</span>}
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
      {(shown.length > 1 || windowed) && (
        <div className="vizlegend mt-2" aria-hidden={table ? 'true' : undefined}>
          {shown.length > 1 && <>
          <span><i /> {shown[0]?.name}</span>
          <span><i className="alt" /> {shown[1]?.name}</span>
          </>}
          {windowed && <span>{L.window(labels.length)}</span>}
        </div>
      )}
      {table && dataTable(caption(label ?? shown.map((s) => s.name).join(' vs '), windowed ? L.window(labels.length) : undefined), shown.map((s) => s.name),
        labels.map((x, i) => [x, shown.map((s) => { const v = s.values[i]; return v === undefined ? '' : known(v) ? format(v) : L.withheld; })]))}
    </div>
  );
}

/**
 * `display` replaces the printed value; the bar still draws from `value`, so it is NOT a privacy floor.
 * `suppressed: true` is: it needs a `display` (the floor label, "<5"), draws the withheld stub and no
 * fill, and nothing is read from `value`, which also stays out of the scale.
 */
type Shown = { display?: string; suppressed?: false } | { display: string; suppressed: true };
/** The item shape every withheld-aware part shares (a funnel step is one). */
export type ShownItem = { label: string; value: number } & Shown;
export type BarsItem = { label: string; value: number; level?: 0 | 1 | 2 | 3 } & Shown;
export type HBarsItem = { label: string; value: number; alt?: boolean } & Shown;

/** Each missing-display warning already given, so a re-render does not repeat it. Capped: past the cap nothing is added and nothing more is said, so a long-lived process cannot grow it. */
const warned = new Set<string>();
const WARNED_MAX = 50;
/**
 * A suppressed item that slipped past the types with no display: said once, in development, by label only.
 * Called during render with no hook, so Bars and HBars need no client boundary.
 */
function warnMissingDisplay(part: string, data: readonly { label: string; suppressed?: boolean; display?: string }[]) {
  if (!DEV) return;
  const missing = data.filter((d) => d.suppressed && d.display === undefined).map((d) => d.label).join('", "');
  if (!missing || warned.has(`${part}|${missing}`) || warned.size >= WARNED_MAX) return;
  warned.add(`${part}|${missing}`);
  console.warn(`${part}: suppressed item "${missing}" has no display; it prints no label. Pass the floor label, for example display: "<5".`);
}

/** The mark the items past `cap` fold into; `fold` marks it, for the alt fill and its own key. */
type Folded<T> = T & { fold?: true };
/**
 * Keeps the first `cap` items by position and folds the rest into one Other item, last. A suppressed item is
 * never read: one in the rest makes Other suppressed before any value is summed, and so does a total under
 * VIZ_FLOOR. A suppressed Other prints the floor label, holds value 0 and so stays out of the scale.
 */
function foldOther<T extends { label: string; value: number; suppressed?: boolean }>(data: T[], cap: number | undefined, L: VizLabels): Folded<T>[] {
  const keep = chartCap(cap);
  if (keep === undefined || data.length <= keep) return data;
  const rest = data.slice(keep);
  const total = rest.some((d) => d.suppressed) ? undefined : rest.reduce((sum, d) => sum + d.value, 0);
  /* Fails closed: a NaN or infinite total is never printed, it is suppressed like a total under the floor. */
  const other = total === undefined || !Number.isFinite(total) || !(total >= VIZ_FLOOR)
    ? { label: L.other, value: 0, suppressed: true, display: L.floor, fold: true }
    : { label: L.other, value: total, fold: true };
  return [...data.slice(0, keep), other as Folded<T>];
}
/** Other's own key: a data row may already be labelled Other. */
const FOLD_KEY = '\u0000';

export interface BarsProps {
  data: BarsItem[];
  /** Prints each value on/above its mark, the portfolio default. */
  showValues?: boolean;
  height?: number;
  /** Marks drawn before the fold: items past it become one Other mark, last. Other is extra: `cap` does not count it, so `cap={3}` draws 4 marks. Absent draws every item. */
  cap?: number;
  /** Caption of the hidden data table. */
  label?: string;
  /** False drops the hidden data table. */
  table?: boolean;
  /** Copy: the word a suppressed item with no display carries in its title and table cell; the value header; Other and its floor label. */
  vizLabels?: Partial<VizLabels>;
  className?: string;
}

/** Vertical bars, numbers on the marks, no axis. */
export function Bars({ data: given, showValues = true, height = 120, cap, label, table = true, vizLabels, className }: BarsProps) {
  const L = { ...VIZ_LABELS, ...vizLabels };
  warnMissingDisplay('Bars', given);
  const data = foldOther(given, cap, L);
  const top = Math.max(...data.filter((d) => !d.suppressed).map((d) => d.value), 1);
  return (
    <div className={cx(className)}>
      <div className="bars" style={{ height }} aria-hidden={table ? 'true' : undefined}>
        {data.map((d) => {
          if (d.suppressed) {
            const display: string | undefined = d.display;
            return (
              <div className="bar" key={d.fold ? FOLD_KEY : d.label} title={`${d.label}: ${display ?? L.withheld}`} data-suppressed="">
                {showValues && display !== undefined && <span className="vlab">{display}</span>}
                <div className="vtrack" />
                <span className="mlab">{d.label}</span>
              </div>
            );
          }
          const shown = d.display ?? d.value;
          return (
          <div className="bar" key={d.fold ? FOLD_KEY : d.label} title={`${d.label}: ${shown}`}>
            {showValues && <span className="vlab">{shown}</span>}
            <div className="fill" style={{ height: `${(d.value / top) * 100}%`, background: d.fold ? 'var(--data-alt)' : d.level !== undefined ? `var(--data-${d.level})` : undefined }} />
            <span className="mlab">{d.label}</span>
          </div>
          );
        })}
      </div>
      {table && dataTable(label ?? L.table, [L.value], data.map((d) => [d.label, [d.suppressed ? (d.display ?? L.withheld) : String(d.display ?? d.value)]]))}
    </div>
  );
}

export interface HBarsProps {
  /** `format` never sees a suppressed value. */
  data: HBarsItem[];
  format?: (v: number) => string;
  /** Rows drawn before the fold: items past it become one Other row, last, on the alt fill. Other is extra: `cap` does not count it, so `cap={3}` draws 4 rows. Absent draws every item. */
  cap?: number;
  /** Caption of the hidden data table. */
  label?: string;
  /** False drops the hidden data table. */
  table?: boolean;
  /** Copy: the word a suppressed item with no display carries in its title and table cell; the value header. */
  vizLabels?: Partial<VizLabels>;
  className?: string;
}

/** Label / track / mono count rows: the axis-free distribution. */
export function HBars({ data: given, format = String, cap, label, table = true, vizLabels, className }: HBarsProps) {
  const L = { ...VIZ_LABELS, ...vizLabels };
  warnMissingDisplay('HBars', given);
  const data = foldOther(given, cap, L);
  const top = Math.max(...data.filter((d) => !d.suppressed).map((d) => d.value), 1);
  const hidden = table ? 'true' : undefined;
  /* Formatted once, for the row and its table cell; never for a suppressed item. */
  const printed = data.map((d) => (d.suppressed ? undefined : d.display ?? format(d.value)));
  return (
    <div className={cx('hbars', className)}>
      {data.map((d, k) => {
        if (d.suppressed) {
          const display: string | undefined = d.display;
          return (
            <div className="hbar" key={d.fold ? FOLD_KEY : d.label} title={`${d.label}: ${display ?? L.withheld}`} data-suppressed="" aria-hidden={hidden}>
              <span className="hlabel">{d.label}</span>
              <span className="htrack" />
              <span className="hcount">{display}</span>
            </div>
          );
        }
        const shown = printed[k];
        return (
        <div className="hbar" key={d.fold ? FOLD_KEY : d.label} title={`${d.label}: ${shown}`} aria-hidden={hidden}>
          <span className="hlabel">{d.label}</span>
          <span className="htrack"><i className={d.alt || d.fold ? 'alt' : undefined} style={{ width: `${(d.value / top) * 100}%` }} /></span>
          <span className="hcount">{shown}</span>
        </div>
        );
      })}
      {table && dataTable(label ?? L.table, [L.value], data.map((d, k) => [d.label, [d.suppressed ? (d.display ?? L.withheld) : printed[k]!]]))}
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
