/**
 * The chart kit's copy, kept in a pure module so the parts in viz.tsx export
 * components only. A product passes its own words through `vizLabels`.
 */
export interface VizLabels {
  /** Named where a value is withheld: a null in a line on hover, a suppressed bar with no display in its title. */
  withheld: string;
}

export const VIZ_LABELS: VizLabels = { withheld: 'Withheld' };
