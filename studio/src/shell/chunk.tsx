// Lazily loaded parts of the shell (the command bar, the color panel, the search commands):
// one cached import per part that forgets a failure, a hook that loads it when needed and
// reports failure, a boundary for anything thrown while it renders, and a labels-only error
// state with Retry. A failed chunk never takes the studio down with it.
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';

export interface Chunk<T> { load: () => Promise<T>; value: T | null; get: () => Promise<T>; reset: () => void }

export function chunk<T>(load: () => Promise<T>): Chunk<T> {
  let pending: Promise<T> | null = null;
  const c: Chunk<T> = {
    load,
    value: null,
    get() {
      pending ??= c.load().then((v) => { c.value = v; return v; }, (e) => { pending = null; throw e; });
      return pending;
    },
    /** Forgets the cached promise (and value), so the next get() imports again. */
    reset() { pending = null; c.value = null; },
  };
  return c;
}

/** Loads the chunk while `active`; `retry` clears the cached import and tries again. */
export function useChunk<T>(c: Chunk<T>, active: boolean) {
  const [state, setState] = useState<{ value: T | null; failed: boolean }>(() => ({ value: c.value, failed: false }));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active || state.value) return;
    let live = true;
    c.get().then((value) => { if (live) setState({ value, failed: false }); }, () => { if (live) setState({ value: null, failed: true }); });
    return () => { live = false; };
  }, [active, attempt, c, state.value]);
  const retry = () => { c.reset(); setState({ value: null, failed: false }); setAttempt((n) => n + 1); };
  return { ...state, retry };
}

/** Catches a render-time throw inside a lazily loaded part and shows its error state instead. */
export class ChunkBoundary extends Component<{ fallback: (retry: () => void) => ReactNode; onRetry: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* shown in place; nothing to report */ }
  retry = () => { this.setState({ failed: false }); this.props.onRetry(); };
  render() { return this.state.failed ? this.props.fallback(this.retry) : this.props.children; }
}

/** Labels only: what did not load, and Retry (focused when it appears). */
export function ChunkError({ label, onRetry }: { label: string; onRetry: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { btn.current?.focus(); }, []);
  return (
    <div className="chunkerr" role="alert">
      <p>{label}</p>
      <button ref={btn} type="button" className="btn btn-secondary sm" onClick={onRetry}>Retry</button>
    </div>
  );
}

const FOCUSABLE = ':is(button,input,select,textarea,a[href],[tabindex]):not([disabled]):not([tabindex="-1"])';
/** Tab and Shift+Tab wrap inside `el` (a modal dialog or sheet). */
export function trapTab(e: React.KeyboardEvent, el: HTMLElement | null) {
  if (e.key !== 'Tab' || !el) return;
  const all = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (!all.length) { e.preventDefault(); return; }
  const first = all[0];
  const last = all[all.length - 1];
  const at = document.activeElement;
  if (e.shiftKey && (at === first || !el.contains(at))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (at === last || !el.contains(at))) { e.preventDefault(); first.focus(); }
}
