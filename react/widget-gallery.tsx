import * as React from 'react';
import { SIZE_LABEL, sizeOptions } from './widget-state';
import type { Columns, WidgetSize } from './widget-state';
import { cx } from './cx';

/** What the gallery lists: one row per widget kind. WidgetDefinition satisfies it. */
export interface GalleryEntry { kind: string; name: string; icon?: React.ReactNode; sizes: readonly WidgetSize[] }

export interface WidgetGalleryLabels {
  title: string;
  close: string;
  /** Group name for a kind's add buttons. */
  addKind: (name: string) => string;
  /** One add button. */
  addSize: (name: string, size: WidgetSize) => string;
}

export const WIDGET_GALLERY_LABELS: WidgetGalleryLabels = {
  title: 'Add widget',
  close: 'Close',
  addKind: (name) => `Add ${name}`,
  addSize: (name, size) => `Add ${name}, ${SIZE_LABEL[size]}`,
};

export interface WidgetGalleryProps {
  open: boolean;
  onClose: () => void;
  entries: readonly GalleryEntry[];
  onAdd: (kind: string, size: WidgetSize) => void;
  /** Sizes that do not fit stay listed with aria-disabled. Default 4. */
  columns?: Columns;
  labels?: Partial<WidgetGalleryLabels>;
  className?: string;
}

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const X = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);

/**
 * The add-widget drawer: a right sheet over a scrim (the console shell's .drawer). Each kind lists
 * its sizes as add buttons. Focus moves to Close, Tab cycles inside, and Escape, Close or the scrim
 * return focus to whatever opened it.
 */
export function WidgetGallery({ open, onClose, entries, onAdd, columns = 4, labels, className }: WidgetGalleryProps) {
  const L = { ...WIDGET_GALLERY_LABELS, ...labels };
  const titleId = React.useId();
  const drawerRef = React.useRef<HTMLElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => { onCloseRef.current = onClose; });

  React.useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
      const drawer = drawerRef.current;
      if (e.key !== 'Tab' || !drawer) return;
      const nodes = [...drawer.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!drawer.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="scrim" aria-hidden="true" onClick={onClose} />
      <aside ref={drawerRef} className={cx('drawer', className)} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="drawer-hd">
          <h4 id={titleId}>{L.title}</h4>
          <button ref={closeRef} type="button" className="ibtn" aria-label={L.close} onClick={onClose}>{X}</button>
        </div>
        <div className="drawer-bd">
          <ul className="wgal">
            {entries.map((d) => (
              <li className="wgal-item" key={d.kind}>
                {d.icon && <span className="wgal-icon" aria-hidden="true">{d.icon}</span>}
                <span className="wgal-name">{d.name}<small>{sizeOptions(d.sizes, 4).map((o) => o.size.toUpperCase()).join(' · ')}</small></span>
                <div className="wgal-sizes" role="group" aria-label={L.addKind(d.name)}>
                  {sizeOptions(d.sizes, columns).map((o) => (
                    <button
                      key={o.size}
                      type="button"
                      aria-label={L.addSize(d.name, o.size)}
                      aria-disabled={o.fits ? undefined : true}
                      onClick={() => { if (o.fits) onAdd(d.kind, o.size); }}
                    >
                      {o.size.toUpperCase()}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
}
