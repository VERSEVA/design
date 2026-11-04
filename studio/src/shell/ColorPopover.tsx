// Color: one accent dot (identity, like the org mark) opens a popover with the presets and
// Custom (shell/ColorPanel.tsx, its own chunk, fetched on first intent: hover, focus or press).
// A failed chunk shows a labels-only error with Retry. The popover is modal while open: focus
// stays inside, Esc closes and focus returns to the dot; under 900px it is a bottom sheet.
import { useEffect, useId, useRef, useState } from 'react';
import { BRANDS, useTheme } from '../theme';
import { ChunkBoundary, ChunkError, chunk, trapTab, useChunk } from './chunk';

export const colorPanelChunk = chunk(() => import('./ColorPanel'));
const NAMES: Record<string, string> = { ...Object.fromEntries(BRANDS.map((b) => [b.value, b.label])), custom: 'Custom' };

export function ColorPopover() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLButtonElement>(null);
  const errBox = useRef<HTMLDivElement>(null);
  const popId = useId();
  const panel = useChunk(colorPanelChunk, open);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    /* Esc closes from anywhere while open, and focus returns to the dot. */
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); dot.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const close = () => { setOpen(false); dot.current?.focus(); };
  const prefetch = () => { void colorPanelChunk.get().catch(() => {}); };
  const failedBox = (retry: () => void) => (
    <div id={popId} ref={errBox} className="menu-list panel colorpop" role="dialog" aria-modal="true" aria-label="Color" onKeyDown={(e) => trapTab(e, errBox.current)}>
      <ChunkError label="Color panel did not load" onRetry={retry} />
    </div>
  );
  const Panel = panel.value?.default;

  return (
    <div className="menu colorwrap" ref={wrap}>
      <button
        ref={dot}
        type="button"
        className="ibtn accentdot"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        aria-label={`Color: ${NAMES[theme.brand] ?? NAMES['']}`}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        onClick={() => setOpen((v) => !v)}
      >
        <i className="accentswatch" aria-hidden="true" />
      </button>
      {open && <div className="colorscrim" aria-hidden="true" onMouseDown={close} />}
      {open && panel.failed && failedBox(panel.retry)}
      {open && Panel && (
        <ChunkBoundary fallback={failedBox} onRetry={panel.retry}>
          <Panel id={popId} onClose={close} />
        </ChunkBoundary>
      )}
    </div>
  );
}
