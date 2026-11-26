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
