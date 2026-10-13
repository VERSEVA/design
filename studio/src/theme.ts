// Studio theme state: brand preset + mode, on <html>, persisted, broadcast.
// Shares the 'verseva-theme' key with the legacy site so a choice carries over.
import { useEffect, useState, useSyncExternalStore } from 'react';

export type Brand = '' | 'cobalt' | 'forest' | 'slate' | 'violet';
export type Mode = 'light' | 'dark' | 'system';
export interface ThemeState { brand: Brand; mode: Mode }

export const BRANDS: ReadonlyArray<{ value: Brand; label: string }> = [
  { value: '', label: 'Signature' },
  { value: 'cobalt', label: 'Cobalt' },
  { value: 'forest', label: 'Forest' },
  { value: 'slate', label: 'Slate' },
  { value: 'violet', label: 'Violet' },
];
export const MODES: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const BRAND_KEY = 'verseva-brand';
const MODE_KEY = 'verseva-theme';
const isBrand = (v: unknown): v is Brand => BRANDS.some((b) => b.value === v);

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

export function readStored(): ThemeState {
  const b = read(BRAND_KEY);
  const m = read(MODE_KEY);
  const mode: Mode = m === 'light' || m === 'system' ? m : m === 'dark' || m === '' ? 'dark' : 'system';
  return { brand: isBrand(b) ? b : '', mode };
}

export function resolveMode(mode: Mode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

let current: ThemeState = { brand: '', mode: 'system' };
const listeners = new Set<() => void>();

export function setAttrs(el: HTMLElement, state: ThemeState = current) {
  if (state.brand) el.dataset.brand = state.brand; else delete el.dataset.brand;
  if (resolveMode(state.mode) === 'light') el.dataset.theme = 'light'; else delete el.dataset.theme;
}

export function applyTheme(next: ThemeState) {
  current = next;
  setAttrs(document.documentElement, next);
  write(BRAND_KEY, next.brand);
  write(MODE_KEY, next.mode);
  listeners.forEach((l) => l());
  window.dispatchEvent(new Event('vsv-theme'));
}

export function getTheme() { return current; }

export function initTheme() {
  current = readStored();
  setAttrs(document.documentElement, current);
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  mq.addEventListener?.('change', () => { if (current.mode === 'system') applyTheme(current); });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export function useTheme(): ThemeState {
  return useSyncExternalStore(subscribe, getTheme, getTheme);
}

/* The View Transition circle wipe (site/theme.js, ratified 09-01); reduced motion flips instantly. */
export function wipe(e: { clientX?: number; clientY?: number } | null, fn: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce) { fn(); return; }
  const x = e?.clientX || innerWidth / 2;
  const y = e?.clientY || 40;
  const t = doc.startViewTransition(fn);
  t.ready.then(() => {
    const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${far}px at ${x}px ${y}px)`] },
      { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
}

/* Page-level motion pause (WCAG 2.2.2); reduced motion starts it paused. */
let paused = false;
const pauseListeners = new Set<() => void>();
export function setMotionPaused(v: boolean) { paused = v; pauseListeners.forEach((l) => l()); }
export function isMotionPaused() {
  return paused || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
export function usePauseMotion(): boolean {
  return useSyncExternalStore(
    (l) => { pauseListeners.add(l); return () => pauseListeners.delete(l); },
    () => isMotionPaused(),
    () => false,
  );
}

/* Re-render on every theme flip (for values read from computed style). */
export function useThemeTick(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const on = () => requestAnimationFrame(() => setN((v) => v + 1));
    window.addEventListener('vsv-theme', on);
    return () => window.removeEventListener('vsv-theme', on);
  }, []);
  return n;
}
