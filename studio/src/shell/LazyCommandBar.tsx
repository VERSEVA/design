// The package command bar, loaded on first open (the chord or a trigger), so it stays out of
// the main chunk. Once opened it stays mounted, so closing restores focus as the bar does.
// SearchTrigger is the package trigger's markup (.searchbox.cmdk-trigger), kept in the main
// chunk without pulling the bar module in with it.
import { useEffect, useRef, useState } from 'react';
import type { CommandBarProps } from '../../../react/command-bar';
import { shortcutLabel } from '../../../react/console-state';
import { SearchIcon } from './icons';
import { ChunkBoundary, ChunkError, chunk, trapTab, useChunk } from './chunk';

export const commandBarChunk = chunk(() => import('../../../react/command-bar'));
export const loadCommandBar = () => commandBarChunk.get().catch(() => null);

/* The error state in the bar's own frame: a modal dialog with what did not load, Retry and Close. */
function BarError({ label, onRetry, onClose }: { label: string; onRetry: () => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  return (
    <div className="cmdk-ovl" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className="cmdk" role="dialog" aria-modal="true" aria-label="Search"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); return; } trapTab(e, box.current); }}>
        <ChunkError label={label} onRetry={onRetry} />
        <button type="button" className="btn btn-ghost sm cmdk-errclose" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/** The package bar, loaded on first open. `commandsFailed` shows the same error state when the
    commands chunk failed; Retry reloads whichever failed. */
export function LazyCommandBar({ commandsFailed = false, onRetryCommands, ...props }: CommandBarProps & { commandsFailed?: boolean; onRetryCommands?: () => void }) {
  const [seen, setSeen] = useState(false);
  useEffect(() => { if (props.open) setSeen(true); }, [props.open]);
  const bar = useChunk(commandBarChunk, Boolean(props.open) || seen);
  const close = () => props.onOpenChange?.(false);
  const retry = () => { if (bar.failed) bar.retry(); if (commandsFailed) onRetryCommands?.(); };
  if (!props.open && !seen) return null;
  if (props.open && (bar.failed || commandsFailed)) return <BarError label="Search did not load" onRetry={retry} onClose={close} />;
  const Bar = bar.value?.CommandBar;
  if (!Bar) return null;
  return (
    <ChunkBoundary fallback={(r) => (props.open ? <BarError label="Search did not load" onRetry={r} onClose={close} /> : null)} onRetry={bar.retry}>
      <Bar {...props} />
    </ChunkBoundary>
  );
}

const isApple = () => {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || '');
};

/** The top bar search slot as a button that opens the bar; the chord label settles after mount (SSR-stable). */
export function SearchTrigger({ onOpen, label = 'Search or ask' }: { onOpen: () => void; label?: string }) {
  const [apple, setApple] = useState(false);
  useEffect(() => { setApple(isApple()); }, []);
  return (
    <button type="button" className="searchbox cmdk-trigger" aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K"
      onPointerEnter={() => { void loadCommandBar(); }} onFocus={() => { void loadCommandBar(); }}
      onClick={(e) => { e.currentTarget.focus(); onOpen(); }}>
      <SearchIcon />
      <span>{label}</span>
      <kbd aria-hidden="true">{shortcutLabel(apple)}</kbd>
    </button>
  );
}
