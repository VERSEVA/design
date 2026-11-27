/**
 * The bans a theme can declare in a verseva board manifest, and what proves each one. Shared by
 * the board server (it validates manifest names against these keys) and the board page (it
 * asserts every row on every matching contract specimen). Browser-safe: no node: imports.
 *
 * A theme that bans a material nulls its tokens (docs/theming.md, "Bans must null"): glass by
 * --glass-blur: 0, bloom by --accent-bloom: none. Each row names a specimen selector, a computed
 * CSS property and the value that proves the ban. `match` is "equals" (the default) or
 * "zero-blur": the value is none, or every blur() in it has a 0px radius.
 *
 * @typedef {{ specimen: string, property: string, expect: string, match?: 'equals' | 'zero-blur' }} BanRow
 * @type {Readonly<Record<string, ReadonlyArray<BanRow>>>}
 */
export const BANS = Object.freeze({
  bloom: Object.freeze([
    Object.freeze({ specimen: '.tab.on', property: 'background-image', expect: 'none' }),
    Object.freeze({ specimen: '.snav a[aria-current="page"]', property: 'background-image', expect: 'none' }),
  ]),
  glass: Object.freeze([
    Object.freeze({ specimen: '.card', property: 'backdrop-filter', expect: 'none' }),
    Object.freeze({ specimen: '.navshell', property: 'backdrop-filter', expect: 'blur(0px)', match: 'zero-blur' }),
    Object.freeze({ specimen: '.bulkbar', property: 'backdrop-filter', expect: 'blur(0px)', match: 'zero-blur' }),
  ]),
});

/** Whether a computed value proves the row. */
export function holds(row, value) {
  const v = String(value).trim();
  if (row.match === 'zero-blur') {
    if (v === 'none') return true;
    const radii = [...v.matchAll(/blur\(([^)]*)\)/g)].map((m) => m[1].trim());
    return radii.length > 0 && radii.every((r) => r === '0px' || r === '0');
  }
  return v === row.expect;
}

/** Own keys only: "constructor" or "__proto__" is never a ban. */
export const isBan = (name) => typeof name === 'string' && Object.prototype.hasOwnProperty.call(BANS, name);
