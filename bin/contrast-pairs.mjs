/**
 * The contrast pairs the contract names, shared by verseva-contrast-gate and
 * the studio's live contrast table. Browser-safe: no node: imports.
 * Each entry: [foreground token, backdrop chain (top layer first; "name*a"
 * scales that layer's alpha), floor]. Every role that sets reading text
 * (the whole text ladder, --chart-label via text-3, error help and danger menu
 * items) is gated at the 4.5:1 body floor; 3:1 is for large text and UI parts.
 *
 * @type {ReadonlyArray<[string, string[], number]>}
 */
export const PAIRS = [
  ['text-1', ['bg'], 4.5], ['text-1', ['surface'], 4.5], ['text-1', ['surface-2'], 4.5],
  ['text-2', ['bg'], 4.5], ['text-2', ['surface'], 4.5], ['text-2', ['surface-2'], 4.5],
  ['text-3', ['bg'], 4.5], ['text-3', ['surface'], 4.5], ['text-3', ['surface-2'], 4.5],
  ['accent-ink', ['accent'], 4.5],
  ['accent-ink', ['accent-hover'], 4.5],
  ['accent', ['bg'], 3],
  ['accent', ['surface'], 3],
  ['focus', ['bg'], 3],
  ['success', ['success-bg', 'surface'], 4.5],
  ['warn', ['warn-bg', 'surface'], 4.5],
  ['danger', ['danger-bg', 'surface'], 4.5],
  ['danger', ['surface'], 4.5],
  ['text-1', ['accent*0.14', 'surface'], 4.5],
  ['text-1', ['accent*0.14', 'bg'], 4.5],
  ['data-alt', ['bg'], 3],
  ['data-alt', ['surface'], 3],
];
