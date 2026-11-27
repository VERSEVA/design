import * as React from 'react';
import { cx } from './cx';
import { FUNNEL_LABELS, VIZ_LABELS, type FunnelLabels, type VizLabels } from './labels';
import type { ShownItem } from './viz';

/**
 * The step funnel (1.8), step rows: how many reach each step, the share of the first step, the drop
 * from the step before, and the biggest drop flagged with a neutral word chip (never coloured by
 * sign, never the accent). Each step is an `.hbar` row on the `.funnel` grid, so the bar, the count
 * and the withheld stub are the chart kit's own.
 *
 * A suppressed step is a privacy floor, as in `HBars`: its value is never read. It draws the
 * withheld stub and prints `display`; its share is a dash, a drop beside it is a dash and is never
 * the biggest, and it stays out of the scale. The same steps render the same markup whatever the
 * suppressed value is.
 *
 * No state and no hook: it renders without a client boundary.
 */

/** A step: the same shape as a bar item. `suppressed: true` needs `display` (the floor label, "<5"). */
export type FunnelStep = ShownItem;

export interface FunnelProps {
  steps: FunnelStep[];
  /** The panel form: a column-label row and each step's share of the first step. */
  share?: boolean;
  /** Five skeleton rows of the same layout in place of the steps. */
  loading?: boolean;
  /** Captions the hidden data table and names the list. Default: `labels.list`. */
  label?: string;
  /** The visually hidden data table, on by default; the visible rows are then hidden from assistive tech. */
  table?: boolean;
  /** Counts as printed. Never called with a suppressed value. */
  format?: (v: number) => string;
  /** Shown in place of the rows when there are no steps. Default: `.empty` with `labels.empty`. */
  empty?: React.ReactNode;
  labels?: Partial<FunnelLabels>;
  /** The withheld word, for a suppressed step with no display. */
  vizLabels?: Partial<VizLabels>;
  className?: string;
}

const NUM = new Intl.NumberFormat('en-US');
const MINUS = '−';
/** `null` on the first step; `undefined` when either side is suppressed or the step before is zero (never exact, never flagged). */
type Drop = number | null | undefined;

const shareText = (x: number | null) => (x === null ? '-' : `${(x * 100).toFixed(x < 0.1 && x > 0 ? 1 : 0)}%`);
const pct = (d: number) => Math.round(Math.abs(d) * 100);
const dropText = (d: Drop) => (d === null ? '' : d === undefined ? '-' : d < 0 ? `+${pct(d)}%` : `${MINUS}${pct(d)}%`);

const DROP_ICON = (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M2 4.5l4.5 4.5 3-3L14 10.5" /><path d="M14 7v3.5h-3.5" />
  </svg>
);
const SKEL_W = [72, 58, 66, 54, 80];

export function Funnel({ steps, share = false, loading = false, label, table = true, format = (v) => NUM.format(v), empty, labels, vizLabels, className }: FunnelProps) {
  const L = { ...FUNNEL_LABELS, ...labels };
  const withheld = { ...VIZ_LABELS, ...vizLabels }.withheld;
  const name = label ?? L.list;

  if (loading) {
    return (
      <ol className={cx('funnel', className)} data-share={share ? '' : undefined} aria-hidden="true">
        {SKEL_W.map((w, i) => (
          <li className="hbar" key={i}>
            <span className="hlabel"><span className="skel" style={{ display: 'block', width: `${w}%` }} /></span>
            <span className="htrack"><span className="skel" style={{ display: 'block' }} /></span>
            <span className="hcount"><span className="skel" style={{ display: 'block' }} /></span>
            {share && <span className="funnel-share"><span className="skel" style={{ display: 'block' }} /></span>}
            <span className="funnel-drop"><span className="skel" style={{ display: 'block', width: '2.5rem' }} /></span>
          </li>
        ))}
      </ol>
    );
  }
  if (steps.length === 0) return <>{empty ?? <div className="empty"><b>{L.empty}</b></div>}</>;

  /* The scale: the first step when it is known and above zero; otherwise the largest known step. */
  const first = steps[0];
  const base = !first.suppressed && first.value > 0 ? first.value : null;
  const top = base ?? Math.max(...steps.filter((s) => !s.suppressed).map((s) => s.value), 1);
  const rows = steps.map((s, i) => {
    const prev = steps[i - 1];
    const drop: Drop = i === 0 ? null : !s.suppressed && !prev.suppressed && prev.value > 0 ? 1 - s.value / prev.value : undefined;
    return {
      step: s,
      count: s.suppressed ? s.display : format(s.value),
      width: s.suppressed ? null : `${((s.value / top) * 100).toFixed(1)}%`,
      share: s.suppressed || base === null ? null : s.value / base,
      drop,
    };
  });
  let biggest = -1;
  let most = 0;
  rows.forEach((r, i) => { if (typeof r.drop === 'number' && r.drop > most) { most = r.drop; biggest = i; } });

  const dropSr = (d: Drop) => (d === null ? '' : d === undefined ? L.notExact : d < 0 ? L.riseSr(pct(d)) : L.dropSr(pct(d)));
  const dropCell = (d: Drop, big: boolean) => {
    if (d === null) return <span className="funnel-drop" />;
    if (big) {
      return (
        <span className="funnel-drop" data-biggest="">
          <span className="badge neutral">{DROP_ICON}{L.biggest}</span>
          <span className="sr-only">{`, ${dropSr(d)}`}</span>
          <span aria-hidden="true">{dropText(d)}</span>
        </span>
      );
    }
    return <span className="funnel-drop"><span className="sr-only">{dropSr(d)}</span><span aria-hidden="true">{dropText(d)}</span></span>;
  };

  return (
    <>
      <ol className={cx('funnel', className)} data-share={share ? '' : undefined} aria-label={table ? undefined : name} aria-hidden={table ? 'true' : undefined}>
        {share && (
          <li className="funnel-head" aria-hidden="true">
            <span>{L.step}</span><span /><span>{L.count}</span><span>{L.share}</span><span>{L.drop}</span>
          </li>
        )}
        {rows.map((r, i) => (
          <li className="hbar" key={r.step.label} data-suppressed={r.step.suppressed ? '' : undefined}>
            <span className="hlabel">{r.step.label}</span>
            <span className="htrack" aria-hidden="true">{r.width !== null && <i style={{ width: r.width }} />}</span>
            <span className="hcount">{r.count}</span>
            {share && <span className="funnel-share"><span className="sr-only">{`${L.shareSr} `}</span>{shareText(r.share)}</span>}
            {dropCell(r.drop, i === biggest)}
          </li>
        ))}
      </ol>
      {table && (
        /* A table sizes to its content whatever its width says, so the hiding box is a div around it. */
        <div className="sr-only">
          {/* recipe-ok: the visually hidden data table for assistive tech, never drawn, so not a .table */}
          <table>
            <caption>{name}</caption>
            <thead>
              <tr><th scope="col">{L.step}</th><th scope="col">{L.count}</th><th scope="col">{L.share}</th><th scope="col">{L.drop}</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.step.label}>
                  <th scope="row">{r.step.label}</th>
                  <td>{r.count ?? withheld}</td>
                  <td>{shareText(r.share)}</td>
                  <td>{r.drop === undefined ? L.notExact : i === biggest ? `${dropText(r.drop)}, ${L.biggest}` : dropText(r.drop)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
