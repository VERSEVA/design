/**
 * Date range logic and built-in words (react/date-range.tsx). Pure and React-free, so server
 * code can read the labels and build a value; the client file re-exports the types.
 *
 * Dates are plain 'YYYY-MM-DD' strings. The part does no calendar math: a preset carries its
 * own dates, snapping is the host's function, and two dates are compared as text.
 *
 * Presets are the host's. An example, for a page that reports whole weeks:
 *   [{ value: '7', label: 'This week', from: '2026-11-23', to: '2026-11-29' },
 *    { value: '28', label: '4 weeks', from: '2026-11-02', to: '2026-11-29' },
 *    { value: '91', label: '13 weeks', from: '2026-08-31', to: '2026-11-29' }]
 */

/** The whole value: plain and serialisable, so the host can keep it wherever it likes. */
export interface DateRangeValue {
  /** A preset's value, or 'custom'. */
  range: string;
  from: string;
  to: string;
  compare: boolean;
}

export interface DateRangePreset {
  value: string;
  label: string;
  from: string;
  to: string;
}

export type DateRangeEdge = 'from' | 'to';

/** Snaps one custom date (to a whole week, say). Called when a field loses focus, never per key. */
export type DateRangeSnap = (date: string, edge: DateRangeEdge) => string;

export interface DateRangeErrors {
  from?: string;
  to?: string;
}

export interface DateRangeLabels {
  /** Names the preset group and the menu trigger. */
  range: string;
  custom: string;
  compare: string;
  /** The Compare control's full name. */
  compareLong: string;
  from: string;
  to: string;
  customTitle: string;
  cancel: string;
  apply: string;
  close: string;
  /** Joined to the range line while Compare is on. */
  vsPrevious: string;
  needFrom: string;
  needTo: string;
  endBeforeStart: string;
  earliest: (date: string) => string;
  latest: (date: string) => string;
}

export const DATE_RANGE_LABELS: DateRangeLabels = {
  range: 'Range',
  custom: 'Custom',
  compare: 'Compare',
  compareLong: 'Compare with previous period',
  from: 'From',
  to: 'To',
  customTitle: 'Custom range',
  cancel: 'Cancel',
  apply: 'Apply',
  close: 'Close',
  vsPrevious: 'vs previous',
  needFrom: 'Enter a start date',
  needTo: 'Enter an end date',
  endBeforeStart: 'End is before start',
  earliest: (date) => `Earliest start is ${date}`,
  latest: (date) => `Latest end is ${date}`,
};

/** The `range` of a value whose dates were typed. */
export const CUSTOM_RANGE = 'custom';

/** A real calendar day written 'YYYY-MM-DD'. */
export function isDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const FULL = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const at = (s: string) => Date.parse(`${s}T00:00:00Z`);

/** '29 Nov 2026'. The date as written when it is not a date. */
export function dayText(date: string): string {
  return isDate(date) ? FULL.format(at(date)) : date;
}

/** '23 Nov to 29 Nov 2026': the default range line. Pass formatRange for another locale. */
export function rangeText(from: string, to: string): string {
  return `${isDate(from) ? DAY.format(at(from)) : from} to ${dayText(to)}`;
}

export interface DateRangeLimits {
  min?: string;
  max?: string;
  labels?: DateRangeLabels;
}

/** A custom range is two dates, inside min and max when given, the start not after the end. */
export function checkRange(from: string, to: string, { min, max, labels = DATE_RANGE_LABELS }: DateRangeLimits = {}): { ok: boolean; errors: DateRangeErrors } {
  const errors: DateRangeErrors = {};
  if (!isDate(from)) errors.from = labels.needFrom;
  if (!isDate(to)) errors.to = labels.needTo;
  if (errors.from || errors.to) return { ok: false, errors };
  if (min && from < min) errors.from = labels.earliest(dayText(min));
  if (max && to > max) errors.to = labels.latest(dayText(max));
  if (!errors.from && !errors.to && to < from) errors.to = labels.endBeforeStart;
  return { ok: !errors.from && !errors.to, errors };
}

/** Both dates through the host's snap; a date that is not one yet is left as typed. */
export function snapRange(from: string, to: string, snap?: DateRangeSnap): { from: string; to: string } {
  if (!snap) return { from, to };
  return { from: isDate(from) ? snap(from, 'from') : from, to: isDate(to) ? snap(to, 'to') : to };
}

/** Where an arrow, Home or End key moves in a list of `length`, wrapping; null for any other key. */
export function moveIndex(key: string, index: number, length: number): number | null {
  if (length < 1) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % length;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + length) % length;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  return null;
}
