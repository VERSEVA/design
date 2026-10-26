/**
 * Console shell logic: SemVer compare, the What's new unread rule, collapse
 * persistence and shortcut guards. Pure and React-free, so node --test imports
 * it directly (erasable TypeScript only). Storage is always injected.
 */

export type ChangeKind = 'new' | 'improved' | 'fixed';
export interface ReleaseChange { kind: ChangeKind; text: string }
/** date is ISO yyyy-mm-dd. */
export interface Release { version: string; date: string; changes: ReleaseChange[] }
export interface ParsedVersion { major: number; minor: number; patch: number; pre: (string | number)[] }
export interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface KeyLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  target?: unknown;
}

export const SEEN_KEY = 'verseva.whatsnew.seen';
export const COLLAPSE_KEY = 'verseva.shell.collapsed';
export const COLLAPSE_SHORTCUT = '[';
export const KIND_ORDER: ChangeKind[] = ['new', 'improved', 'fixed'];
export const KIND_LABEL: Record<ChangeKind, string> = { new: 'New', improved: 'Improved', fixed: 'Fixed' };

const SEMVER = /^[vV]?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BUTTON_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);
const TEXT_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton']);

export function parseVersion(v: string): ParsedVersion | null {
  if (typeof v !== 'string') return null;
  const m = SEMVER.exec(v.trim());
  if (!m) return null;
  const pre = m[4] ? m[4].split('.').map((id) => (/^\d+$/.test(id) ? Number(id) : id)) : [];
  return { major: Number(m[1]), minor: Number(m[2] ?? 0), patch: Number(m[3] ?? 0), pre };
}

/** SemVer 2.0.0 precedence: -1, 0 or 1. An invalid version sorts below every valid one. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return pa ? 1 : pb ? -1 : 0;
  for (const part of ['major', 'minor', 'patch'] as const) {
    if (pa[part] !== pb[part]) return pa[part] < pb[part] ? -1 : 1;
  }
  if (!pa.pre.length || !pb.pre.length) {
    if (pa.pre.length === pb.pre.length) return 0;
    return pa.pre.length ? -1 : 1;
  }
  const n = Math.max(pa.pre.length, pb.pre.length);
  for (let i = 0; i < n; i++) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1;
    if (typeof x === 'number') return -1;
    if (typeof y === 'number') return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export function displayVersion(v: string): string {
  const t = String(v ?? '').trim();
  if (!parseVersion(t)) return t;
  return /^[vV]/.test(t) ? t : `v${t}`;
}

/** Unread while last-seen is missing, invalid or older; never when the current version is invalid. */
export function isUnread(lastSeen: string | null, current: string): boolean {
  if (!parseVersion(current)) return false;
  if (lastSeen === null || !parseVersion(lastSeen)) return true;
  return compareVersions(lastSeen, current) < 0;
}

/** globalThis.localStorage when it is reachable and usable, else null. Never throws. */
export function safeStorage(): KeyValueStore | null {
  try {
    const s = (globalThis as { localStorage?: Partial<KeyValueStore> }).localStorage;
    return s && typeof s.getItem === 'function' && typeof s.setItem === 'function' ? (s as KeyValueStore) : null;
  } catch {
    return null;
  }
}

export function readSeen(store: KeyValueStore | null, key: string = SEEN_KEY): string | null {
  if (!store) return null;
  try { return store.getItem(key); } catch { return null; }
}

export function writeSeen(store: KeyValueStore | null, version: string, key: string = SEEN_KEY): void {
  if (!store) return;
  try { store.setItem(key, version); } catch { /* storage blocked: session only */ }
}

export function readCollapsed(store: KeyValueStore | null, key: string = COLLAPSE_KEY, fallback = false): boolean {
  if (!store) return fallback;
  try {
    const v = store.getItem(key);
    return v === '1' ? true : v === '0' ? false : fallback;
  } catch {
    return fallback;
  }
}

export function writeCollapsed(store: KeyValueStore | null, collapsed: boolean, key: string = COLLAPSE_KEY): void {
  if (!store) return;
  try { store.setItem(key, collapsed ? '1' : '0'); } catch { /* storage blocked: session only */ }
}

/** Duck-typed so it runs without a DOM: text inputs, textarea, select, contenteditable, text roles. */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const t = target as { tagName?: unknown; type?: unknown; isContentEditable?: unknown; getAttribute?: unknown };
  if (t.isContentEditable === true) return true;
  const role = typeof t.getAttribute === 'function' ? (t.getAttribute as (name: string) => string | null).call(target, 'role') : null;
  if (typeof role === 'string' && TEXT_ROLES.has(role.toLowerCase())) return true;
  const tag = typeof t.tagName === 'string' ? t.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !BUTTON_INPUTS.has(String(t.type ?? 'text').toLowerCase());
  return false;
}

export function isCollapseShortcut(e: KeyLike, shortcut: string = COLLAPSE_SHORTCUT): boolean {
  if (e.key !== shortcut) return false;
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.isComposing || e.defaultPrevented) return false;
  return !isTypingTarget(e.target);
}

/** Meta+K or Ctrl+K; a chord, so it works while typing. */
export function isSearchShortcut(e: KeyLike): boolean {
  return Boolean((e.metaKey || e.ctrlKey) && typeof e.key === 'string' && e.key.toLowerCase() === 'k' && !e.altKey && !e.shiftKey);
}

export function shortcutLabel(isApple: boolean): string {
  return isApple ? '⌘K' : 'Ctrl K';
}

/** Releases at or below the current version, newest first. Notes staged ahead of a deploy never show. */
export function visibleReleases(releases: Release[], current: string): Release[] {
  if (!Array.isArray(releases)) return [];
  return releases
    .filter((r) => isRelease(r) && parseVersion(r.version) !== null && compareVersions(r.version, current) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version));
}

export function isFresh(version: string, lastSeen: string | null, newest: string): boolean {
  if (lastSeen === null || !parseVersion(lastSeen)) return compareVersions(version, newest) === 0;
  return compareVersions(version, lastSeen) > 0;
}

function isRelease(r: unknown): r is Release {
  return typeof r === 'object' && r !== null && typeof (r as Release).version === 'string' && Array.isArray((r as Release).changes);
}

function isKind(kind: string): kind is ChangeKind {
  return (KIND_ORDER as string[]).includes(kind);
}

export function sortChanges(changes: ReleaseChange[]): ReleaseChange[] {
  const rank = (kind: string) => (isKind(kind) ? KIND_ORDER.indexOf(kind) : KIND_ORDER.length);
  if (!Array.isArray(changes)) return [];
  return changes.filter((c) => typeof c === 'object' && c !== null).sort((a, b) => rank(a.kind) - rank(b.kind));
}

export function kindLabel(kind: string): string {
  return isKind(kind) ? KIND_LABEL[kind] : 'Changed';
}

export function changeTone(kind: string, fresh: boolean): 'bloom' | 'neutral' | 'ok' {
  if (!fresh || !isKind(kind)) return 'neutral';
  if (kind === 'new') return 'bloom';
  if (kind === 'fixed') return 'ok';
  return 'neutral';
}

export function formatReleaseDate(iso: string, locale: string = 'en-US'): string {
  const m = ISO_DATE.exec(iso);
  if (!m) return iso;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) return iso;
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
  } catch {
    return iso;
  }
}

export function unreadCount(items: ReadonlyArray<{ unread: boolean }>): number {
  return items.reduce((n, item) => n + (item.unread === true ? 1 : 0), 0);
}

export function badgeCount(n: number): string | null {
  if (!Number.isFinite(n)) return null;
  const whole = Math.floor(n);
  if (whole <= 0) return null;
  return whole > 99 ? '99+' : String(whole);
}

export function initials(name: string): string {
  const words = String(name ?? '').trim().split(/[\s-]+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
  return (Array.from(words[0])[0] + Array.from(words[1])[0]).toUpperCase();
}

export function railTipPosition(rect: { top: number; right: number; height: number }, gap = 12): { x: number; y: number } {
  return { x: rect.right + gap, y: rect.top + rect.height / 2 };
}

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto']);

/**
 * Link sinks only take relative paths, fragments, http:, https: and mailto:.
 * The scheme is read the way a browser reads it (whitespace and control
 * characters stripped, any case); anything else becomes '#'.
 */
export function safeHref(href: string): string {
  if (typeof href !== 'string') return '#';
  const bare = href.replace(/[\u0000- \u007f-\u009f]/g, '');
  const m = SCHEME.exec(bare);
  if (!m) return href;
  return SAFE_SCHEMES.has(m[1].toLowerCase()) ? href : '#';
}

/** Defaults merged with overrides; a key whose override is undefined keeps its default. */
export function withDefaults<T extends object>(defaults: T, overrides?: Partial<T> | null): T {
  const out = { ...defaults };
  if (overrides) {
    for (const key of Object.keys(overrides) as (keyof T)[]) {
      const v = overrides[key];
      if (v !== undefined) out[key] = v as T[keyof T];
    }
  }
  return out;
}
