/**
 * Live activity logic: job state, the lead job, +n, done-leave timing and
 * the announcement rules. Pure and React-free, so node --test imports it
 * directly (erasable TypeScript only). Time is always passed in.
 */

/** What a product pushes. progress is 0..1; null or missing means not known yet. */
export interface Activity {
  id: string;
  name: string;
  /** Step names in order; the current one follows progress. */
  steps?: string[];
  progress?: number | null;
  done?: boolean;
  /** A message, or true for a failure without one. */
  error?: string | boolean | null;
}

export type ActivityState = 'pending' | 'running' | 'done' | 'error';
export type DoneStamps = Record<string, number>;

export interface ActivityEvent {
  type: 'start' | 'progress' | 'done' | 'error' | 'cancel';
  id: string;
  name: string;
  /** Percent step crossed (25, 50, 75), progress events only. */
  step?: number;
  error?: string;
  politeness: 'status' | 'alert';
}

/** A done job leaves the capsule this long after it finishes (never while the panel is open). */
export const DONE_LEAVE_MS = 6000;
/** Progress is announced in quarter steps only. */
export const ANNOUNCE_STEPS = 4;

export const ACTIVITY_LABELS = {
  title: 'Live activity',
  clearDone: 'Clear done',
  cancel: 'Cancel',
  retry: 'Retry',
  done: 'Done',
  failed: 'Failed',
  starting: 'Starting',
  empty: 'No activity',
  capsule: (lead: string, state: ActivityState, pct: number, more: number, failed: number) => {
    const head = state === 'done' ? `${lead}, done` : state === 'error' ? `${lead}, failed` : state === 'pending' ? `${lead}, starting` : `${lead}, ${pct}%`;
    const tail = [more > 0 ? `${more} more running` : '', failed > 0 && state !== 'error' ? `${failed} failed` : ''].filter(Boolean).join(', ');
    return `Live activity: ${head}${tail ? `, ${tail}` : ''}`;
  },
  started: (name: string) => `${name} started`,
  progress: (name: string, pct: number) => `${name} ${pct}%`,
  finished: (name: string) => `${name} done`,
  cancelled: (name: string) => `${name} cancelled`,
  failure: (name: string, error?: string) => (error ? `${name} failed: ${error}` : `${name} failed`),
};
export type ActivityLabels = typeof ACTIVITY_LABELS;

export function clampProgress(p: unknown): number | null {
  if (typeof p !== 'number' || !Number.isFinite(p)) return null;
  return Math.min(1, Math.max(0, p));
}

function errorText(a: Activity): string | undefined {
  return typeof a.error === 'string' && a.error ? a.error : undefined;
}

function hasError(a: Activity): boolean {
  return a.error === true || (typeof a.error === 'string' && a.error.length > 0);
}

export function activityState(a: Activity): ActivityState {
  if (hasError(a)) return 'error';
  if (a.done === true) return 'done';
  return clampProgress(a.progress) === null ? 'pending' : 'running';
}

const running = (a: Activity) => {
  const s = activityState(a);
  return s === 'running' || s === 'pending';
};

/** Whole percent, floored, so a running job never reads 100 before it is done. */
export function percent(a: Activity): number {
  if (activityState(a) === 'done') return 100;
  const p = clampProgress(a.progress) ?? 0;
  return Math.min(99, Math.floor(p * 100 + 1e-9));
}

export function currentStep(a: Activity): string | null {
  const steps = Array.isArray(a.steps) ? a.steps : [];
  const p = clampProgress(a.progress);
  if (!steps.length || p === null || activityState(a) === 'done') return null;
  return steps[Math.min(steps.length - 1, Math.floor(p * steps.length))] ?? null;
}

/** stroke-dashoffset for a ring of the given circumference. */
export function ringOffset(progress: number | null | undefined, circumference: number): number {
  return circumference * (1 - (clampProgress(progress) ?? 0));
}

/** The running job closest to done (known progress beats pending; ties keep list order), else the first error, else the first done job. */
export function leadActivity(list: Activity[] | null | undefined): Activity | null {
  if (!Array.isArray(list) || !list.length) return null;
  let lead: Activity | null = null;
  let best = -2;
  for (const a of list) {
    if (!running(a)) continue;
    const p = clampProgress(a.progress) ?? -1;
    if (p > best) { best = p; lead = a; }
  }
  return lead ?? list.find((a) => activityState(a) === 'error') ?? list.find((a) => activityState(a) === 'done') ?? null;
}

/** "+n": running jobs other than the lead. Done and failed jobs never count. */
export function moreCount(list: Activity[] | null | undefined): number {
  if (!Array.isArray(list)) return 0;
  return Math.max(0, list.filter(running).length - 1);
}

export function failedCount(list: Activity[] | null | undefined): number {
  return Array.isArray(list) ? list.filter((a) => activityState(a) === 'error').length : 0;
}

/** Stamp the time a job is first seen done; forget jobs that are gone or no longer done. */
export function trackDone(stamps: DoneStamps, list: Activity[], now: number): DoneStamps {
  const out: DoneStamps = {};
  for (const a of list) {
    if (activityState(a) !== 'done') continue;
    out[a.id] = stamps[a.id] ?? now;
  }
  return out;
}

/** Ids that have left: the given set plus done jobs past the delay. Nothing leaves while the panel is open; errors never leave. */
export function leaveExpired(list: Activity[], stamps: DoneStamps, left: Set<string>, now: number, panelOpen: boolean, delay = DONE_LEAVE_MS): Set<string> {
  const out = new Set(left);
  if (panelOpen) return out;
  for (const a of list) {
    const at = stamps[a.id];
    if (activityState(a) === 'done' && at !== undefined && now - at >= delay) out.add(a.id);
  }
  return out;
}

/** Milliseconds until the next done job leaves, or null when none will (panel open, nothing done). */
export function nextLeaveIn(list: Activity[], stamps: DoneStamps, left: Set<string>, now: number, panelOpen: boolean, delay = DONE_LEAVE_MS): number | null {
  if (panelOpen) return null;
  let wait: number | null = null;
  for (const a of list) {
    const at = stamps[a.id];
    if (activityState(a) !== 'done' || at === undefined || left.has(a.id)) continue;
    const ms = Math.max(0, at + delay - now);
    wait = wait === null ? ms : Math.min(wait, ms);
  }
  return wait;
}

/** Keep only ids whose job is still present and done, so a job that runs again comes back. */
export function pruneLeft(left: Set<string>, list: Activity[]): Set<string> {
  const done = new Set(list.filter((a) => activityState(a) === 'done').map((a) => a.id));
  return new Set([...left].filter((id) => done.has(id)));
}

export function visibleActivities(list: Activity[], left: Set<string>): Activity[] {
  return list.filter((a) => !(left.has(a.id) && activityState(a) === 'done'));
}

const quarter = (a: Activity) => Math.floor((clampProgress(a.progress) ?? 0) * ANNOUNCE_STEPS + 1e-9);

/**
 * What changed between two pushes, for the live regions: start, done and
 * cancel (a running job removed), progress at 25% steps only, and errors as
 * alerts. A done or failed job leaving is silent.
 */
export function activityEvents(prev: Activity[], next: Activity[]): ActivityEvent[] {
  const before = new Map(prev.map((a) => [a.id, a]));
  const ids = new Set(next.map((a) => a.id));
  const out: ActivityEvent[] = [];
  for (const a of next) {
    const p = before.get(a.id);
    const sn = activityState(a);
    const sp = p ? activityState(p) : null;
    const base = { id: a.id, name: a.name };
    if (sn === 'error') {
      if (sp !== 'error') out.push({ ...base, type: 'error', error: errorText(a), politeness: 'alert' });
    } else if (sn === 'done') {
      if (sp !== 'done') out.push({ ...base, type: 'done', politeness: 'status' });
    } else if (sp === null || sp === 'error' || sp === 'done') {
      out.push({ ...base, type: 'start', politeness: 'status' });
    } else {
      const q = quarter(a);
      if (q > quarter(p!) && q > 0 && q < ANNOUNCE_STEPS) out.push({ ...base, type: 'progress', step: (q * 100) / ANNOUNCE_STEPS, politeness: 'status' });
    }
  }
  for (const p of prev) {
    if (!ids.has(p.id) && running(p)) out.push({ id: p.id, name: p.name, type: 'cancel', politeness: 'status' });
  }
  return out;
}

export function announcement(e: ActivityEvent, L: ActivityLabels = ACTIVITY_LABELS): string {
  switch (e.type) {
    case 'start': return L.started(e.name);
    case 'progress': return L.progress(e.name, e.step ?? 0);
    case 'done': return L.finished(e.name);
    case 'cancel': return L.cancelled(e.name);
    default: return L.failure(e.name, e.error);
  }
}
