import * as React from 'react';
import {
  LAYOUT_KEY, SIZE_LABEL, BREAKPOINTS,
  addWidget, addedMessage, fitSize, move, moveBy, moveDirection, movedMessage, nextFocusId, rowPartner,
  readLayout, removeWidget, removedMessage, resizeWidget, resizedMessage, restoreWidget, safeStorage, sizeOptions, writeLayout,
} from './widget-state';
import type { Columns, LayoutItem, Removed, RowMove, WidgetSize, WidgetSpec } from './widget-state';
import { WidgetGallery } from './widget-gallery';
import type { WidgetGalleryLabels } from './widget-gallery';
import { cx } from './cx';

export interface WidgetRenderState {
  /** The size the tile renders at (already fitted to the columns). */
  size: WidgetSize;
  /** True for the one widget allowed to spend the accent. */
  focus: boolean;
  editing: boolean;
  columns: Columns;
}

/** A widget kind: its sizes and one view per size. */
export interface WidgetDefinition extends WidgetSpec {
  kind: string;
  name: string;
  icon?: React.ReactNode;
  sizes: readonly WidgetSize[];
  render: (size: WidgetSize, state: WidgetRenderState) => React.ReactNode;
  /** Loading view at a size; default is a header, numeral and plot skeleton. */
  skeleton?: (size: WidgetSize) => React.ReactNode;
}

/** Per-widget status the product reports. */
export interface WidgetStatus { loading?: boolean; error?: string; disabled?: boolean }

export interface WidgetGridLabels {
  region: string;
  empty: string;
  add: string;
  retry: string;
  undo: string;
  move: string;
  remove: (name: string) => string;
  moveUp: (name: string) => string;
  moveDown: (name: string) => string;
  size: (name: string) => string;
  restored: (name: string) => string;
  gallery?: Partial<WidgetGalleryLabels>;
}

export const WIDGET_GRID_LABELS: WidgetGridLabels = {
  region: 'Widgets',
  empty: 'No widgets',
  add: 'Add widget',
  retry: 'Retry',
  undo: 'Undo',
  move: 'Move',
  remove: (name) => `Remove ${name}`,
  moveUp: (name) => `Move ${name} up`,
  moveDown: (name) => `Move ${name} down`,
  size: (name) => `${name} size`,
  restored: (name) => `${name} restored`,
};

export interface WidgetGridProps {
  definitions: readonly WidgetDefinition[];
  /** Controlled layout. Controlled mode neither reads nor writes storage. */
  layout?: readonly LayoutItem[];
  /** Uncontrolled start when nothing is stored. */
  defaultLayout?: readonly LayoutItem[];
  onLayoutChange?: (layout: LayoutItem[]) => void;
  /** Default 'verseva.widgets.layout'; null disables persistence. */
  storageKey?: string | null;
  editing?: boolean;
  defaultEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  /** Id of the one widget that may spend the accent (law 3: one accent per view). */
  focus?: string;
  status?: Readonly<Record<string, WidgetStatus>>;
  onRetry?: (id: string) => void;
  /** Force a column count (specimens, tests); written to data-cols so the CSS follows. Default: from the viewport, 4 / 2 / 1. */
  columns?: Columns;
  /** The product's Edit toggle: Esc leaving edit mode moves focus there. */
  toggleRef?: React.RefObject<HTMLElement | null>;
  /** Long-press delay that enters edit mode, ms. Default 550; 0 turns it off. */
  longPress?: number;
  labels?: Partial<WidgetGridLabels>;
  className?: string;
}

const svg = (d: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const MINUS = svg(<path d="M6 12h12" />);
const PLUS = svg(<path d="M12 5v14M5 12h14" />);
const UP = svg(<path d="M12 19V5M6 11l6-6 6 6" />);
const DOWN = svg(<path d="M12 5v14M6 13l6 6 6-6" />);
const GRIP = svg(<><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>);
const ALERT = svg(<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>);
const KEYS = 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown';
const INTERACTIVE = 'a,button,input,select,textarea,label,[role="button"],[contenteditable="true"]';
const UNDO_MS = 6000;

const useIsoLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

function inOpenModal(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]:not([hidden])') !== null;
}

function matches(q: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
}

/** 4, 2 or 1 from the viewport (the CSS breakpoints); 4 on the server. */
export function useWidgetColumns(forced?: Columns): Columns {
  const [cols, setCols] = React.useState<Columns>(forced ?? 4);
  React.useEffect(() => {
    if (forced) { setCols(forced); return; }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const four = window.matchMedia(`(min-width: ${BREAKPOINTS.four}px)`);
    const two = window.matchMedia(`(min-width: ${BREAKPOINTS.two}px)`);
    const on = () => setCols(four.matches ? 4 : two.matches ? 2 : 1);
    on();
    four.addEventListener?.('change', on);
    two.addEventListener?.('change', on);
    return () => { four.removeEventListener?.('change', on); two.removeEventListener?.('change', on); };
  }, [forced]);
  return cols;
}

function durationMs(el: Element | null, token: string, fallback: number): number {
  if (!el || typeof getComputedStyle !== 'function') return fallback;
  const v = getComputedStyle(el).getPropertyValue(token).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith('ms') ? n : n * 1000) : fallback;
}

function DefaultSkeleton({ size }: { size: WidgetSize }) {
  return (
    <div className="wtile-skel" aria-hidden="true">
      <span className="skel" style={{ width: '40%' }} />
      <span className="skel wtile-skel-num" />
      {size !== 's' && <span className="skel wtile-skel-plot" />}
    </div>
  );
}

/**
 * The widget home: a 4 / 2 / 1 column grid of tiles, each rendering its definition's view for the
 * fitted size. Edit mode (the editing prop, a long-press, or Esc to leave) removes with Undo,
 * resizes through aria-pressed size buttons, reorders by drag, the touch handle, Move up and Move
 * down, or Alt+Arrow on a focused tile, and adds from the gallery drawer. Changes are announced
 * in a polite live region.
 */
export function WidgetGrid({
  definitions, layout: controlled, defaultLayout, onLayoutChange, storageKey = LAYOUT_KEY,
  editing: editingProp, defaultEditing = false, onEditingChange, focus, status, onRetry,
  columns: forcedColumns, toggleRef, longPress = 550, labels, className,
}: WidgetGridProps) {
  const L = { ...WIDGET_GRID_LABELS, ...labels };
  const cols = useWidgetColumns(forcedColumns);
  const isControlled = controlled !== undefined;
  const [own, setOwn] = React.useState<LayoutItem[]>(() => [...(defaultLayout ?? [])]);
  const layout = (isControlled ? controlled : own) as LayoutItem[];
  const [ownEditing, setOwnEditing] = React.useState(defaultEditing);
  const editing = editingProp ?? ownEditing;
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [undo, setUndo] = React.useState<Removed | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const rects = React.useRef<Map<string, DOMRect> | null>(null);
  /** Tile id to focus after the next render ('' means none left), and optionally a control inside it. */
  const pendingFocus = React.useRef<string | null>(null);
  const pendingControl = React.useRef<string | null>(null);
  const lastRow = React.useRef<RowMove | null>(null);
  const layoutRef = React.useRef(layout);
  layoutRef.current = layout;
  const defs = React.useMemo(() => new Map(definitions.map((d) => [d.kind, d])), [definitions]);
  const nameOf = (it: LayoutItem | undefined) => (it && defs.get(it.kind)?.name) || '';

  // Stored layout loads after mount so the server render and hydration agree.
  React.useEffect(() => {
    if (isControlled || storageKey === null) return;
    const stored = readLayout(safeStorage(), definitions, storageKey);
    if (stored) setOwn(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const announce = React.useCallback((text: string) => {
    setMessage((prev) => (prev === text ? `${text} ` : text));
  }, []);

  const snapshot = () => {
    const grid = gridRef.current;
    if (!grid || matches('(prefers-reduced-motion: reduce)')) { rects.current = null; return; }
    rects.current = new Map([...grid.querySelectorAll<HTMLElement>('.wtile[data-id]')].map((el) => [el.dataset.id as string, el.getBoundingClientRect()]));
  };

  const commit = (next: LayoutItem[], row: RowMove | null = null) => {
    if (next === layoutRef.current) return;
    lastRow.current = row;
    snapshot();
    layoutRef.current = next;
    if (!isControlled) setOwn(next);
    if (!isControlled && storageKey !== null) writeLayout(safeStorage(), next, storageKey);
    onLayoutChange?.(next);
  };

  const setEditing = (on: boolean) => {
    if (editingProp === undefined) setOwnEditing(on);
    onEditingChange?.(on);
  };

  // FLIP: tiles glide from where they were (transform only; skipped under reduced motion).
  useIsoLayoutEffect(() => {
    const before = rects.current;
    rects.current = null;
    const grid = gridRef.current;
    if (grid && pendingFocus.current !== null) {
      const id = pendingFocus.current;
      const control = pendingControl.current;
      pendingFocus.current = null;
      pendingControl.current = null;
      const tile = [...grid.querySelectorAll<HTMLElement>('.wtile[data-id]')].find((el) => el.dataset.id === id) ?? null;
      const target = tile && ((control && tile.querySelector<HTMLElement>(control)) || (tile.tabIndex >= 0 ? tile : tile.querySelector<HTMLElement>(INTERACTIVE)));
      (target ?? grid.querySelector<HTMLElement>('.wgrid-add, .wgrid-empty .btn') ?? grid).focus();
    }
    if (!before || !grid) return;
    const dur = durationMs(grid, '--dur-4', 480);
    for (const el of grid.querySelectorAll<HTMLElement>('.wtile[data-id]')) {
      const from = before.get(el.dataset.id as string);
      if (!from || typeof el.animate !== 'function') continue;
      const to = el.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: dur, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  });

  // Esc leaves edit mode (an open dialog handles its own Esc first).
  React.useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || inOpenModal()) return;
      // Scoped: only from inside the grid, the Edit toggle, or nowhere (after a long-press with the mouse).
      const at = document.activeElement;
      const grid = gridRef.current;
      const toggle = toggleRef?.current ?? null;
      if (at && at !== document.body && !(grid && grid.contains(at)) && at !== toggle) return;
      setEditing(false);
      (toggle ?? grid)?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // Undo lives in the toast; it waits while hovered or focused.
  const [undoHeld, setUndoHeld] = React.useState(false);
  React.useEffect(() => {
    if (!undo || undoHeld) return;
    const t = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [undo, undoHeld]);

  const remove = (id: string) => {
    const it = layout.find((x) => x.id === id);
    const r = removeWidget(layout, id);
    if (!r.removed || !it) return;
    pendingFocus.current = nextFocusId(r.layout, r.removed.index) ?? '';
    commit(r.layout);
    setUndo(r.removed);
    announce(removedMessage(nameOf(it)));
  };

  const doUndo = () => {
    if (!undo) return;
    pendingFocus.current = undo.item.id;
    commit(restoreWidget(layoutRef.current, undo));
    announce(L.restored(nameOf(undo.item)));
    setUndo(null);
    setUndoHeld(false);
  };

  /** control: a selector inside the tile to refocus (the Move buttons), else the tile itself. */
  const reorder = (next: LayoutItem[], id: string, control: string | null, row: RowMove | null = null) => {
    if (next === layoutRef.current) return;
    pendingFocus.current = id;
    pendingControl.current = control;
    commit(next, row);
    const i = next.findIndex((x) => x.id === id);
    announce(movedMessage(nameOf(next[i]), i, next.length));
  };

  const resize = (id: string, size: WidgetSize) => {
    const next = resizeWidget(layout, id, size, definitions);
    if (next === layout) return;
    commit(next);
    announce(resizedMessage(nameOf(next.find((x) => x.id === id)), size));
  };

  const add = (kind: string, size: WidgetSize) => {
    const next = addWidget(layout, kind, size);
    const it = next[next.length - 1];
    setGalleryOpen(false);
    pendingFocus.current = it.id;
    commit(next);
    announce(addedMessage(defs.get(kind)?.name ?? kind));
  };

  // Long-press enters edit mode.
  const press = React.useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const cancelPress = () => { if (press.current) clearTimeout(press.current.t); press.current = null; };
  React.useEffect(() => cancelPress, []);

  // Touch reorder through the handle: pointer capture, the tile under the finger takes the slot.
  const onHandleDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragId(id);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragId || typeof document.elementFromPoint !== 'function') return;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.wtile[data-id]');
    const overId = over?.dataset.id;
    if (!overId || overId === dragId) return;
    const cur = layoutRef.current;
    commit(move(cur, cur.findIndex((x) => x.id === dragId), cur.findIndex((x) => x.id === overId)));
  };
  const onHandleUp = () => {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    const cur = layoutRef.current;
    const i = cur.findIndex((x) => x.id === id);
    if (i >= 0) announce(movedMessage(nameOf(cur[i]), i, cur.length));
  };

  const tiles = layout.map((it, index) => {
    const def = defs.get(it.kind);
    if (!def) return null;
    const size = fitSize(it.size, def.sizes, cols);
    const st = status?.[it.id] ?? {};
    const isFocus = focus === it.id;
    const opts = sizeOptions(def.sizes, cols);
    let body: React.ReactNode;
    if (st.error) {
      body = (
        <>
          <div className="wtile-hd">{def.icon}{def.name}</div>
          <div className="wtile-err" role="alert">
            <span className="wtile-errline">{ALERT}{st.error}</span>
            {onRetry && <button type="button" className="btn btn-secondary sm" onClick={() => onRetry(it.id)}>{L.retry}</button>}
          </div>
        </>
      );
    } else if (st.loading) {
      body = def.skeleton ? def.skeleton(size) : <DefaultSkeleton size={size} />;
    } else {
      body = def.render(size, { size, focus: isFocus, editing, columns: cols });
    }
    return (
      <div
        key={it.id}
        className="wtile"
        role="group"
        aria-roledescription="widget"
        data-id={it.id}
        data-size={size}
        data-focus={isFocus ? '' : undefined}
        data-dragging={dragId === it.id ? '' : undefined}
        aria-label={`${def.name}, ${SIZE_LABEL[size]}`}
        aria-busy={st.loading ? true : undefined}
        aria-disabled={st.disabled ? true : undefined}
        tabIndex={editing ? 0 : undefined}
        aria-keyshortcuts={editing ? KEYS : undefined}
        draggable={editing || undefined}
        onKeyDown={(e) => {
          if (!editing || e.target !== e.currentTarget) return;
          const dir = moveDirection(e);
          if (!dir) return;
          e.preventDefault();
          if (dir === 'up' || dir === 'down') {
            const prev = lastRow.current;
            const undoing = prev && prev.id === it.id && prev.dir !== dir;
            const partner = undoing ? null : rowPartner(layout, it.id, dir, cols, definitions);
            reorder(moveBy(layout, it.id, dir, cols, definitions, prev), it.id, null, partner ? { id: it.id, dir, partner } : null);
          } else reorder(moveBy(layout, it.id, dir, cols, definitions), it.id, null);
        }}
        onPointerDown={(e) => {
          if (editing || !longPress || e.button > 0 || (e.target as Element).closest(INTERACTIVE)) return;
          cancelPress();
          press.current = { x: e.clientX, y: e.clientY, t: setTimeout(() => { press.current = null; setEditing(true); }, longPress) };
        }}
        onPointerMove={(e) => { if (press.current && Math.abs(e.clientX - press.current.x) + Math.abs(e.clientY - press.current.y) > 8) cancelPress(); }}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
        onDragStart={(e) => {
          if (!editing) return;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', it.id);
          setDragId(it.id);
        }}
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          if (dragId === it.id) return;
          const cur = layoutRef.current;
          commit(move(cur, cur.findIndex((x) => x.id === dragId), cur.findIndex((x) => x.id === it.id)));
        }}
        onDrop={(e) => e.preventDefault()}
        onDragEnd={onHandleUp}
      >
        <div className="wtile-body" inert={editing || undefined}>{body}</div>
        {editing && (
          <>
            <button type="button" className="wtile-x" aria-label={L.remove(def.name)} onClick={() => remove(it.id)}>{MINUS}</button>
            <span className="wtile-handle" aria-hidden="true" onPointerDown={(e) => onHandleDown(e, it.id)} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp}>{GRIP}</span>
            <div className="wtile-edit">
              <div className="wtile-move" role="group" aria-label={L.move}>
                <button type="button" aria-label={L.moveUp(def.name)} aria-disabled={index === 0 ? true : undefined} onClick={() => { if (index > 0) reorder(move(layout, index, index - 1), it.id, '.wtile-move button[data-move="up"]'); }} data-move="up">{UP}</button>
                <button type="button" aria-label={L.moveDown(def.name)} aria-disabled={index === layout.length - 1 ? true : undefined} onClick={() => { if (index < layout.length - 1) reorder(move(layout, index, index + 1), it.id, '.wtile-move button[data-move="down"]'); }} data-move="down">{DOWN}</button>
              </div>
              {opts.length > 1 && (
                <div className="wtile-sizes" role="group" aria-label={L.size(def.name)}>
                  {opts.map((o) => (
                    <button
                      key={o.size}
                      type="button"
                      aria-label={SIZE_LABEL[o.size]}
                      aria-pressed={o.size === size}
                      aria-disabled={o.fits ? undefined : true}
                      onClick={() => { if (o.fits) resize(it.id, o.size); }}
                    >
                      {o.size.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  });

  return (
    <>
      <div ref={gridRef} className={cx('wgrid', className)} role="region" aria-label={L.region} data-editing={editing ? '' : undefined} data-cols={forcedColumns} tabIndex={-1}>
        {layout.length === 0 && !editing ? (
          <div className="wgrid-empty">
            <b>{L.empty}</b>
            <button type="button" className="btn btn-secondary" onClick={() => setGalleryOpen(true)}>{L.add}</button>
          </div>
        ) : tiles}
        {editing && (
          <button type="button" className="wgrid-add" onClick={() => setGalleryOpen(true)}>{PLUS}{L.add}</button>
        )}
        <div className="sr-only" aria-live="polite" aria-atomic="true">{message}</div>
      </div>
      {undo && (
        <div className="wgrid-undo" onMouseEnter={() => setUndoHeld(true)} onMouseLeave={() => setUndoHeld(false)} onFocus={() => setUndoHeld(true)} onBlur={() => setUndoHeld(false)}>
          <div className="toast ok">
            <span className="dot" aria-hidden="true" />
            <span>{removedMessage(nameOf(undo.item))}</span>
            <button type="button" className="btn btn-ghost sm" onClick={doUndo}>{L.undo}</button>
          </div>
        </div>
      )}
      <WidgetGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} entries={definitions} onAdd={add} columns={cols} labels={L.gallery} />
    </>
  );
}
