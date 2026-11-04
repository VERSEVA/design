/**
 * Widget grid logic: fit a size to the column count, placement, reorder (including 2D
 * keyboard moves), add, remove, undo, resize, serialize and parse with validation, and the
 * live-region messages. Pure and React-free, so node --test imports it directly (erasable
 * TypeScript only). Storage is always injected.
 */

export type WidgetSize = 's' | 'm' | 'l' | 'xl';
export type Columns = 1 | 2 | 4;
export type MoveDir = 'left' | 'right' | 'up' | 'down';
/** One placed widget. The product stores the layout (an array of these) where it likes. */
export interface LayoutItem { id: string; kind: string; size: WidgetSize }
/** What the rules need to know about a widget kind. */
export interface WidgetSpec { kind: string; sizes: readonly WidgetSize[] }
export interface Placement { id: string; size: WidgetSize; row: number; col: number; cols: number; rows: number }
export interface Removed { item: LayoutItem; index: number }
export interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface KeyLike { key: string; altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; isComposing?: boolean }

export const LAYOUT_KEY = 'verseva.widgets.layout';
export const SIZE_ORDER: WidgetSize[] = ['s', 'm', 'l', 'xl'];
export const SIZE_LABEL: Record<WidgetSize, string> = { s: 'small', m: 'medium', l: 'large', xl: 'extra large' };
/** Column and row span per size (S 1x1, M 2x1, L 2x2, XL 4x2). */
export const SPAN: Record<WidgetSize, { cols: number; rows: number }> = { s: { cols: 1, rows: 1 }, m: { cols: 2, rows: 1 }, l: { cols: 2, rows: 2 }, xl: { cols: 4, rows: 2 } };
/** Viewport widths where the grid steps down: 4 columns from 1100px, 2 from 560px, 1 below. */
export const BREAKPOINTS = { four: 1100, two: 560 } as const;
const MAX_ID = 64;
const ARROWS: Record<string, MoveDir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

const rank = (s: WidgetSize) => SIZE_ORDER.indexOf(s);
const isSize = (s: unknown): s is WidgetSize => typeof s === 'string' && (SIZE_ORDER as string[]).includes(s);
const specFor = (specs: readonly WidgetSpec[], kind: string) => specs.find((s) => s.kind === kind);

export function columnsForWidth(width: number): Columns {
  return width >= BREAKPOINTS.four ? 4 : width >= BREAKPOINTS.two ? 2 : 1;
}

/** 4 columns hold XL, 2 hold L, 1 holds M (L and XL show their M view). */
export function largestSizeFor(cols: Columns): WidgetSize {
  return cols >= 4 ? 'xl' : cols >= 2 ? 'l' : 'm';
}

export function sizeFits(size: WidgetSize, cols: Columns): boolean {
  return rank(size) <= rank(largestSizeFor(cols));
}

/** The largest supported size at or below both the wanted size and what the columns hold; else the smallest supported. */
export function fitSize(size: WidgetSize, sizes: readonly WidgetSize[], cols: Columns): WidgetSize {
  const cap = Math.min(rank(size), rank(largestSizeFor(cols)));
  const ok = SIZE_ORDER.filter((s) => sizes.includes(s));
  const under = ok.filter((s) => rank(s) <= cap);
  return under.length ? under[under.length - 1] : (ok[0] ?? size);
}

/** Every supported size in order; the ones that do not fit stay listed (rendered aria-disabled). */
export function sizeOptions(sizes: readonly WidgetSize[], cols: Columns): { size: WidgetSize; fits: boolean }[] {
  return SIZE_ORDER.filter((s) => sizes.includes(s)).map((size) => ({ size, fits: sizeFits(size, cols) }));
}

export function spanOf(size: WidgetSize, cols: Columns): { cols: number; rows: number } {
  const span = SPAN[size];
  return { cols: Math.min(span.cols, cols), rows: cols === 1 ? 1 : span.rows };
}

/**
 * Where each widget lands under CSS grid's sparse auto-placement (grid-auto-flow: row): the
 * cursor only moves forward, so DOM order, focus order and visual order stay the same.
 */
export function placeAll(layout: readonly LayoutItem[], cols: Columns, specs: readonly WidgetSpec[]): Placement[] {
  const taken = new Set<string>();
  const free = (r: number, c: number, w: number, h: number) => {
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (taken.has(`${y},${x}`)) return false;
    return true;
  };
  let row = 0;
  let col = 0;
  return layout.map((it) => {
    const size = fitSize(it.size, specFor(specs, it.kind)?.sizes ?? [it.size], cols);
    const span = spanOf(size, cols);
    for (;;) {
      if (col + span.cols > cols) { row++; col = 0; continue; }
      if (free(row, col, span.cols, span.rows)) break;
      col++;
    }
    for (let y = row; y < row + span.rows; y++) for (let x = col; x < col + span.cols; x++) taken.add(`${y},${x}`);
    const p = { id: it.id, size, row, col, cols: span.cols, rows: span.rows };
    col += span.cols;
    return p;
  });
}

/** The item at `from` ends up at index `to`. Out of range or no-op returns the same array. */
export function move<T>(layout: readonly T[], from: number, to: number): T[] {
  const n = layout.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return layout as T[];
  const next = layout.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

/** Alt+Arrow: Left and Right move one slot, Up and Down move one row (to the widget above or below). */
export function moveBy(layout: readonly LayoutItem[], id: string, dir: MoveDir, cols: Columns, specs: readonly WidgetSpec[]): LayoutItem[] {
  const from = layout.findIndex((x) => x.id === id);
  if (from < 0) return layout as LayoutItem[];
  if (dir === 'left') return from > 0 ? move(layout, from, from - 1) : (layout as LayoutItem[]);
  if (dir === 'right') return from < layout.length - 1 ? move(layout, from, from + 1) : (layout as LayoutItem[]);
  const places = placeAll(layout, cols, specs);
  const me = places[from];
  const lastRow = Math.max(...places.map((p) => p.row + p.rows - 1));
  const step = dir === 'up' ? -1 : 1;
  for (let r = dir === 'up' ? me.row - 1 : me.row + me.rows; r >= 0 && r <= lastRow; r += step) {
    const inRow = places.filter((p) => p.id !== id && p.row <= r && r < p.row + p.rows);
    if (!inRow.length) continue;
    const dist = (p: Placement) => (me.col >= p.col && me.col < p.col + p.cols ? 0 : Math.min(Math.abs(p.col - me.col), Math.abs(p.col + p.cols - 1 - me.col)));
    const target = inRow.reduce((a, b) => (dist(b) < dist(a) ? b : a));
    return move(layout, from, places.indexOf(target));
  }
  return layout as LayoutItem[];
}

/** Alt plus an arrow, no other modifier, not mid-composition. */
export function moveDirection(e: KeyLike): MoveDir | null {
  if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || e.isComposing) return null;
  return ARROWS[e.key] ?? null;
}

function freshId(layout: readonly LayoutItem[]): string {
  const used = new Set(layout.map((x) => x.id));
  let n = layout.length + 1;
  while (used.has(`w${n}`)) n++;
  return `w${n}`;
}

export function addWidget(layout: readonly LayoutItem[], kind: string, size: WidgetSize, id?: string): LayoutItem[] {
  const useId = id && !layout.some((x) => x.id === id) ? id : freshId(layout);
  return [...layout, { id: useId, kind, size }];
}

export function removeWidget(layout: readonly LayoutItem[], id: string): { layout: LayoutItem[]; removed: Removed | null } {
  const index = layout.findIndex((x) => x.id === id);
  if (index < 0) return { layout: layout as LayoutItem[], removed: null };
  return { layout: layout.filter((_, i) => i !== index), removed: { item: layout[index], index } };
}

/** Undo a remove: back at its old index (clamped). A layout that already holds the id is returned as is. */
export function restoreWidget(layout: readonly LayoutItem[], removed: Removed): LayoutItem[] {
  if (layout.some((x) => x.id === removed.item.id)) return layout as LayoutItem[];
  const next = layout.slice();
  next.splice(Math.min(removed.index, next.length), 0, removed.item);
  return next;
}

export function resizeWidget(layout: readonly LayoutItem[], id: string, size: WidgetSize, specs: readonly WidgetSpec[]): LayoutItem[] {
  const i = layout.findIndex((x) => x.id === id);
  if (i < 0 || layout[i].size === size || !specFor(specs, layout[i].kind)?.sizes.includes(size)) return layout as LayoutItem[];
  return layout.map((x, k) => (k === i ? { ...x, size } : x));
}

/** After a remove at `index`: the widget now at that index, else the one before, else null. */
export function nextFocusId(after: readonly LayoutItem[], index: number): string | null {
  return after[index]?.id ?? after[after.length - 1]?.id ?? null;
}

export function serializeLayout(layout: readonly LayoutItem[]): string {
  return JSON.stringify(layout.map(({ id, kind, size }) => ({ id, kind, size })));
}

/** null for anything that is not a JSON array; otherwise the valid items (known kind, supported size, unique id). */
export function parseLayout(text: string | null | undefined, specs: readonly WidgetSpec[]): LayoutItem[] | null {
  if (typeof text !== 'string') return null;
  let data: unknown;
  try { data = JSON.parse(text); } catch { return null; }
  if (!Array.isArray(data)) return null;
  const seen = new Set<string>();
  const out: LayoutItem[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue;
    const { id, kind, size } = raw as Record<string, unknown>;
    if (typeof id !== 'string' || !id || id.length > MAX_ID || seen.has(id)) continue;
    if (typeof kind !== 'string' || !isSize(size) || !specFor(specs, kind)?.sizes.includes(size)) continue;
    seen.add(id);
    out.push({ id, kind, size });
  }
  return out;
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

export function readLayout(store: KeyValueStore | null, specs: readonly WidgetSpec[], key: string = LAYOUT_KEY): LayoutItem[] | null {
  if (!store) return null;
  try { return parseLayout(store.getItem(key), specs); } catch { return null; }
}

export function writeLayout(store: KeyValueStore | null, layout: readonly LayoutItem[], key: string = LAYOUT_KEY): void {
  if (!store) return;
  try { store.setItem(key, serializeLayout(layout)); } catch { /* storage blocked: session only */ }
}

export const movedMessage = (name: string, index: number, total: number) => `${name} moved to position ${index + 1} of ${total}`;
export const resizedMessage = (name: string, size: WidgetSize) => `${name} resized to ${SIZE_LABEL[size]}`;
export const removedMessage = (name: string) => `${name} removed`;
export const addedMessage = (name: string) => `${name} added`;
