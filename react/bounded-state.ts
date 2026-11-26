/**
 * Bounded section limits. Pure and React-free, so server code can read them; the client
 * part (bounded-section) re-exports them.
 */

/** Rows a bounded section shows by default. */
export const BOUNDED_CAP = 5;
/** The largest cap the CSS holds a rule for. */
export const BOUNDED_MAX_CAP = 12;

/** The cap the CSS can hold: a whole number from 1 to 12. Anything else is the default, 5. */
export function boundedCap(cap: number = BOUNDED_CAP): number {
  return Number.isInteger(cap) && cap >= 1 && cap <= BOUNDED_MAX_CAP ? cap : BOUNDED_CAP;
}
