import * as React from 'react';
import {
  ACTIVITY_LABELS, DONE_LEAVE_MS, activityEvents, activityState, announcement, currentStep, failedCount, leadActivity,
  leaveExpired, moreCount, nextLeaveIn, percent, pruneLeft, ringOffset, trackDone, visibleActivities,
} from './activity-state';
import type { Activity, ActivityEvent, ActivityLabels, DoneStamps } from './activity-state';
import { withDefaults } from './console-state';
import { cx } from './cx';

export type { Activity } from './activity-state';

export interface LiveActivityProps {
  /** Every job the product knows about; push a new array on each change. */
  activities: Activity[];
  /** Cancel on running rows when given. The product removes the job; that removal is announced as cancelled. */
  onCancel?: (id: string) => void;
  /** Retry on failed rows when given. */
  onRetry?: (id: string) => void;
  /** Once per job when it finishes: write a notification here so it can be found later. */
  onDone?: (activity: Activity) => void;
  /** A done job left the capsule (after leaveDelay, never while the panel is open); the product may drop it. */
  onLeave?: (id: string) => void;
  /** "Clear done" in the panel header when given. */
  onClearDone?: () => void;
  /** Milliseconds a done job stays; default 6000. */
  leaveDelay?: number;
  /** Built-in words; English defaults in ACTIVITY_LABELS. */
  labels?: Partial<ActivityLabels>;
  className?: string;
}

const R = 8;
const RING = 2 * Math.PI * R;
const icon = (d: React.ReactNode, cls?: string) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const CHECK = <path d="m5 12.5 4.5 4.5L19 7.5" />;
const CROSS = <path d="M7 7l10 10M17 7 7 17" />;

function focusNextControl(root: HTMLElement | null) {
  const bar = root?.closest('.tbar-end') ?? root?.parentElement;
  const next = Array.from(bar?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]') ?? []).find((el) => !root?.contains(el) && el.offsetParent !== null);
  next?.focus();
}

/**
 * Live activity capsule for the top bar's .tbar-end, before the bell: the
 * running job closest to done with its ring and percent, +n running, done
 * and failed states, and a panel listing every job with its step, bar,
 * Cancel and Retry. Announces start, done, cancel and 25% steps politely;
 * failures as alerts. Data comes in as props; nothing is fetched here.
 */
export function LiveActivity({ activities, onCancel, onRetry, onDone, onLeave, onClearDone, leaveDelay = DONE_LEAVE_MS, labels, className }: LiveActivityProps) {
  const L = withDefaults(ACTIVITY_LABELS, labels);
  const [open, setOpen] = React.useState(false);
  const [left, setLeft] = React.useState<Set<string>>(() => new Set());
  const [status, setStatus] = React.useState('');
  const [alert, setAlert] = React.useState('');
  const stamps = React.useRef<DoneStamps>({});
  const prev = React.useRef<Activity[]>([]);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const capRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();
  const titleId = React.useId();
  const list = Array.isArray(activities) ? activities : [];

  // Transitions: announce, stamp done jobs, hand finished jobs to onDone.
  React.useEffect(() => {
    const events: ActivityEvent[] = activityEvents(prev.current, list);
    prev.current = list;
    stamps.current = trackDone(stamps.current, list, Date.now());
    setLeft((l) => {
      const pruned = pruneLeft(l, list);
      return pruned.size === l.size ? l : pruned;
    });
    const polite = events.filter((e) => e.politeness === 'status');
    const loud = events.filter((e) => e.politeness === 'alert');
    if (polite.length) setStatus(polite.map((e) => announcement(e, L)).join('. '));
    if (loud.length) setAlert(loud.map((e) => announcement(e, L)).join('. '));
    for (const e of events) {
      if (e.type !== 'done') continue;
      const a = list.find((x) => x.id === e.id);
      if (a) onDone?.(a);
    }
  }, [activities]);

  // Done-leave timer: the earliest done job leaves after the delay, never while the panel is open.
  React.useEffect(() => {
    const ms = nextLeaveIn(list, stamps.current, left, Date.now(), open, leaveDelay);
    if (ms === null) return;
    const t = setTimeout(() => {
      setLeft((l) => {
        const next = leaveExpired(list, stamps.current, l, Date.now(), false, leaveDelay);
        for (const id of next) if (!l.has(id)) onLeave?.(id);
        return next;
      });
    }, ms);
    return () => clearTimeout(t);
  }, [activities, left, open, leaveDelay]);

  const shown = visibleActivities(list, left);
  const lead = leadActivity(shown);
  const state = lead ? activityState(lead) : null;
  const more = moreCount(shown);
  const failed = failedCount(shown);
  const anyDone = shown.some((a) => activityState(a) === 'done');

  const close = (refocus: boolean) => {
    setOpen(false);
    if (!refocus) return;
    if (lead) capRef.current?.focus();
    else focusNextControl(rootRef.current);
  };

  React.useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('.panel-hd button:not(:disabled)') ?? panel?.querySelector<HTMLElement>('.lact-acts button');
    (first ?? panel)?.focus();
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Nothing left and the panel shut: the capsule goes, so nothing can hold focus inside it.
  const hideCapsule = !lead && !open;

  const ringFor = (s: string | null, p: number | null | undefined) => (s === 'done' || s === 'error' ? 0 : s === 'pending' ? RING * 0.75 : ringOffset(p, RING));

  return (
    <>
      <div
        className={cx('menu end lact-wrap', className)}
        ref={rootRef}
        hidden={hideCapsule}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) { e.preventDefault(); close(true); }
        }}
        onBlur={(e) => {
          const to = e.relatedTarget;
          if (open && to instanceof Node && !rootRef.current?.contains(to)) setOpen(false);
        }}
      >
        <button
          ref={capRef}
          type="button"
          className="lact"
          data-state={state ?? 'empty'}
          aria-label={lead ? L.capsule(lead.name, state!, percent(lead), more, failed) : L.title}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          <span className="lact-ring" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <circle className="lact-track" cx="10" cy="10" r={R} />
              <circle className="lact-arc" cx="10" cy="10" r={R} strokeDasharray={RING} strokeDashoffset={ringFor(state, lead?.progress)} />
            </svg>
            {icon(state === 'error' ? CROSS : CHECK, 'lact-ti')}
          </span>
          <span className="lact-tx" aria-hidden="true">
            <span className="lact-name">{lead ? lead.name : L.empty}</span>
            {lead && <span className="lact-pc">{state === 'done' ? L.done : state === 'error' ? L.failed : state === 'pending' ? L.starting : `${percent(lead)}%`}</span>}
          </span>
          {more > 0 && <span className="lact-more" aria-hidden="true">+{more}</span>}
        </button>
        <div className="menu-list panel lact-panel" id={panelId} role="dialog" aria-labelledby={titleId} tabIndex={-1} hidden={!open} ref={panelRef}>
          <div className="panel-hd">
            <h4 id={titleId}>{L.title}</h4>
            {onClearDone && (
              <button type="button" disabled={!anyDone} onClick={() => { onClearDone(); panelRef.current?.focus(); }}>{L.clearDone}</button>
            )}
          </div>
          {shown.length ? (
            <ul className="lact-list">
              {shown.map((a) => {
                const s = activityState(a);
                const pct = percent(a);
                const step = currentStep(a);
                const err = typeof a.error === 'string' && a.error ? a.error : null;
                return (
                  <li className="lact-item" data-state={s} key={a.id}>
                    <div className="lact-top">
                      {(s === 'done' || s === 'error') && icon(s === 'error' ? CROSS : CHECK)}
                      <b>{a.name}</b>
                      <span className="lact-pc">{s === 'done' ? L.done : s === 'error' ? L.failed : s === 'pending' ? L.starting : `${pct}%`}</span>
                    </div>
                    <div
                      className="lact-bar"
                      role="progressbar"
                      aria-label={a.name}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={s === 'pending' ? undefined : pct}
                    >
                      <i style={s === 'pending' ? undefined : { transform: `scaleX(${s === 'done' || s === 'error' ? 1 : pct / 100})` }} />
                    </div>
                    {s === 'error' ? (err && <div className="lact-err">{err}</div>) : step && <div className="lact-step">{step}</div>}
                    {((s === 'running' || s === 'pending') && onCancel) || (s === 'error' && onRetry) ? (
                      <div className="lact-acts">
                        {s === 'error'
                          ? <button type="button" className="btn btn-secondary sm" onClick={() => { onRetry?.(a.id); panelRef.current?.focus(); }}>{L.retry}</button>
                          : <button type="button" className="btn btn-ghost sm" onClick={() => { onCancel?.(a.id); panelRef.current?.focus(); }}>{L.cancel}</button>}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="panel-empty">{L.empty}</div>
          )}
        </div>
      </div>
      <div className="sr-only" role="status" aria-live="polite">{status}</div>
      <div className="sr-only" role="alert">{alert}</div>
    </>
  );
}
