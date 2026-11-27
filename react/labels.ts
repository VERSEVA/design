/**
 * Built-in words and limits for parts that have no state module of their own. Pure and
 * React-free, so server code can read and spread them; the client files re-export them.
 */

export interface SmartStackLabels {
  pause: string;
  resume: string;
  /** Dot name. */
  show: (label: string, index: number, total: number) => string;
  /** Slide name. */
  slide: (label: string, index: number, total: number) => string;
  /** Step buttons, used instead of dots above three pages; index is the page they go to. */
  prev: (index: number, total: number) => string;
  next: (index: number, total: number) => string;
}

export const SMART_STACK_LABELS: SmartStackLabels = {
  pause: 'Pause rotation',
  resume: 'Resume rotation',
  show: (label) => `Show ${label}`,
  slide: (label, i, n) => `${i + 1} of ${n}: ${label}`,
  prev: (i, n) => `Previous: ${i + 1} of ${n}`,
  next: (i, n) => `Next: ${i + 1} of ${n}`,
};
/** A one-row tile fits the pause button and three 44px dots; above that the nav steps instead. */
export const MAX_DOTS = 3;

/** The chart kit's copy (viz.tsx): a product passes its own words through `vizLabels`. */
export interface VizLabels {
  /** Named where a value is withheld, after a series or item name: a null in a line on hover, a suppressed bar with no display in its title, an all-null chart in its plot. */
  withheld: string;
  /** The column header of the hidden data table on a one-series part (Sparkline, Bars, HBars). */
  value: string;
  /** The hidden data table's name when the part has no `label` (a LineChart is named by its series instead). */
  table: string;
  /** The one mark the items past `cap` fold into (Bars, HBars). */
  other: string;
  /** What a suppressed Other prints: the floor label. */
  floor: string;
  /** The note a windowed LineChart shows, and adds to its table caption: n is the points kept. */
  window: (n: number) => string;
}

export const VIZ_LABELS: VizLabels = {
  withheld: 'withheld',
  value: 'Value',
  table: 'Chart data',
  other: 'Other',
  floor: '<5',
  window: (n) => `Last ${n}`,
};
/** The privacy floor: an Other whose own total is under this is suppressed. */
export const VIZ_FLOOR = 5;

/** The step funnel's copy (funnel.tsx): a product passes its own words through `labels`. */
export interface FunnelLabels {
  /** Names the list, and captions the hidden table when no `label` is given. */
  list: string;
  /** Column labels: the panel's head row and the hidden table's header. */
  step: string;
  count: string;
  /** Share of the first step, e.g. "Of landing" where the first step is landing views. */
  share: string;
  drop: string;
  /** The neutral chip on the biggest drop. */
  biggest: string;
  /** The empty state. */
  empty: string;
  /** Read before a share, for a screen reader: "of first 25%". */
  shareSr: string;
  /** A fall from the previous step, read for a screen reader. */
  dropSr: (percent: number) => string;
  /** A rise from the previous step, read for a screen reader. */
  riseSr: (percent: number) => string;
  /** A drop beside a withheld step: never exact, printed as a dash. */
  notExact: string;
}

export const FUNNEL_LABELS: FunnelLabels = {
  list: 'Funnel steps',
  step: 'Step',
  count: 'Count',
  share: 'Of first',
  drop: 'Drop',
  biggest: 'Biggest drop',
  empty: 'No funnel events',
  shareSr: 'of first',
  dropSr: (p) => `drop ${p}%`,
  riseSr: (p) => `rise ${p}%`,
  notExact: 'drop not exact',
};

export interface SecretFieldLabels {
  /** The badge beside the label once a value is stored. */
  set: string;
  replace: string;
  save: string;
  cancel: string;
  /** What is being stored, e.g. "token": Save and Replace then read "Save token" and "Replace token". Empty for none. */
  noun: string;
  /** Announced, and read in place of the Save label, while the save runs. */
  saving: string;
  /** Announced when a save lands. */
  saved: string;
  /** Shown and announced when a save fails. Static text that says how to fix it: never a
      rejection reason, never anything built from the typed value. */
  error: string;
}

export const SECRET_FIELD_LABELS: SecretFieldLabels = {
  set: 'Set',
  replace: 'Replace',
  save: 'Save',
  cancel: 'Cancel',
  noun: '',
  saving: 'Saving',
  saved: 'Saved',
  error: 'Not saved. Check the value and try again.',
};
