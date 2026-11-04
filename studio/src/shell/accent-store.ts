// The custom accent as stored and applied: the storage key, the one-line style text the head
// script also builds before first paint, a strict reader of the stored value, and the writer.
// Loads with the color popover; on a cold load the head script alone applies the stored choice.
import { applyTheme, getTheme } from '../theme';

export interface Roles { accent: string; hover: string; ink: string }

export const CUSTOM_KEY = 'verseva-custom';

const decls = (r: Roles) => [['--accent', r.accent], ['--accent-hover', r.hover], ['--accent-ink', r.ink], ['--focus', r.accent]] as const;
export const declsOf = decls;

/** One line, the same text the head script builds from storage before first paint. The head
    script's style lands BEFORE the stylesheets, so :root lifts it over tokens.css's :root and
    [data-theme="light"] blocks (a copied theme file loads after tokens.css and needs no lift). */
export function styleText(v: { dark: Roles; light: Roles }): string {
  const blk = (r: Roles) => decls(r).map(([k, x]) => `${k}:${x}`).join(';');
  return `:root[data-brand="custom"]{${blk(v.dark)}}:root[data-brand="custom"][data-theme="light"]{${blk(v.light)}}`;
}

/** The stored custom choice, or null when absent or not six-digit hex throughout. */
export function readCustom(raw: string | null): { pick: string; dark: Roles; light: Roles } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const ok = (s: unknown) => typeof s === 'string' && /^#[0-9A-Fa-f]{6}$/.test(s);
    const roles = (o: Roles | undefined) => !!o && ok(o.accent) && ok(o.hover) && ok(o.ink);
    if (!ok(v?.pick) || !roles(v.dark) || !roles(v.light)) return null;
    const pick = (r: Roles) => ({ accent: r.accent, hover: r.hover, ink: r.ink });
    return { pick: v.pick, dark: pick(v.dark), light: pick(v.light) };
  } catch { return null; }
}

const readKey = () => { try { return localStorage.getItem(CUSTOM_KEY); } catch { return null; } };

/** The stored custom pick, or null. */
export function storedCustom() { return readCustom(readKey()); }

/* The custom accent's rules in the one style element the head script also writes. */
function writeCustomStyle(v: { dark: Roles; light: Roles }) {
  let el = document.getElementById('vsv-custom');
  if (!el) { el = document.createElement('style'); el.id = 'vsv-custom'; document.head.appendChild(el); }
  const text = styleText(v);
  if (el.textContent !== text) el.textContent = text;
}

/** Stores a derived custom accent, writes its rules and switches the brand to it. */
export function applyCustom(v: { pick: string; dark: Roles; light: Roles }) {
  const roles = (r: Roles) => ({ accent: r.accent, hover: r.hover, ink: r.ink });
  const stored = { pick: v.pick, dark: roles(v.dark), light: roles(v.light) };
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(stored)); } catch { /* storage blocked */ }
  writeCustomStyle(stored);
  applyTheme({ ...getTheme(), brand: 'custom' });
}
