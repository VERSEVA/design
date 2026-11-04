// Widget grid logic (react/widget-state.ts). Node strips the types on import.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYOUT_KEY, SIZE_ORDER, SIZE_LABEL,
  columnsForWidth, largestSizeFor, sizeFits, fitSize, sizeOptions, spanOf, placeAll,
  move, moveBy, moveDirection, addWidget, removeWidget, restoreWidget, resizeWidget, nextFocusId,
  serializeLayout, parseLayout, readLayout, writeLayout,
  movedMessage, resizedMessage, removedMessage, addedMessage,
} from '../react/widget-state.ts';

const SPECS = [
  { kind: 'revenue', sizes: ['s', 'm', 'l', 'xl'] },
  { kind: 'runway', sizes: ['s', 'm'] },
  { kind: 'tasks', sizes: ['s', 'm', 'l'] },
  { kind: 'week', sizes: ['m', 'l'] },
  { kind: 'board', sizes: ['xl'] },
];
const item = (id, kind = 'revenue', size = 's') => ({ id, kind, size });
const ids = (layout) => layout.map((x) => x.id);
const eight = () => 'abcdefgh'.split('').map((id) => item(id));
const memory = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, m };
};
const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

describe('constants', () => {
  test('storage key, size order and labels are fixed', () => {
    assert.equal(LAYOUT_KEY, 'verseva.widgets.layout');
    assert.deepEqual(SIZE_ORDER, ['s', 'm', 'l', 'xl']);
    assert.deepEqual(SIZE_LABEL, { s: 'small', m: 'medium', l: 'large', xl: 'extra large' });
  });
});

describe('columns and fit', () => {
  test('4 columns from 1100px, 2 from 560px, 1 below', () => {
    assert.equal(columnsForWidth(1440), 4);
    assert.equal(columnsForWidth(1100), 4);
    assert.equal(columnsForWidth(1099), 2);
    assert.equal(columnsForWidth(560), 2);
    assert.equal(columnsForWidth(559), 1);
    assert.equal(columnsForWidth(375), 1);
  });
  test('the largest size each column count holds', () => {
    assert.equal(largestSizeFor(4), 'xl');
    assert.equal(largestSizeFor(2), 'l');
    assert.equal(largestSizeFor(1), 'm');
  });
  test('XL drops to L at 2 columns and to M at 1', () => {
    const sizes = ['s', 'm', 'l', 'xl'];
    assert.equal(fitSize('xl', sizes, 4), 'xl');
    assert.equal(fitSize('xl', sizes, 2), 'l');
    assert.equal(fitSize('xl', sizes, 1), 'm');
    assert.equal(fitSize('l', sizes, 1), 'm');
    assert.equal(fitSize('s', sizes, 1), 's');
  });
  test('a fit only lands on a size the widget supports', () => {
    assert.equal(fitSize('l', ['s', 'l'], 1), 's');
    assert.equal(fitSize('xl', ['s', 'm', 'xl'], 2), 'm');
  });
  test('a widget with no size that fits renders its smallest', () => {
    assert.equal(fitSize('xl', ['xl'], 2), 'xl');
    assert.equal(fitSize('l', ['l', 'xl'], 1), 'l');
  });
  test('sizeFits reads the column count', () => {
    assert.equal(sizeFits('xl', 4), true);
    assert.equal(sizeFits('xl', 2), false);
    assert.equal(sizeFits('l', 2), true);
    assert.equal(sizeFits('l', 1), false);
    assert.equal(sizeFits('m', 1), true);
  });
  test('size options keep every supported size, in order, flagged by fit', () => {
    assert.deepEqual(sizeOptions(['xl', 's', 'm'], 2), [
      { size: 's', fits: true }, { size: 'm', fits: true }, { size: 'xl', fits: false },
    ]);
  });
  test('spans clamp to the column count', () => {
    assert.deepEqual(spanOf('xl', 4), { cols: 4, rows: 2 });
    assert.deepEqual(spanOf('m', 4), { cols: 2, rows: 1 });
    assert.deepEqual(spanOf('m', 1), { cols: 1, rows: 1 });
  });
});

describe('placement (sparse row flow, DOM order is visual order)', () => {
  test('S tiles fill rows of four', () => {
    const p = placeAll(eight(), 4, SPECS);
    assert.deepEqual(p.map((x) => [x.id, x.row, x.col]), [
      ['a', 0, 0], ['b', 0, 1], ['c', 0, 2], ['d', 0, 3], ['e', 1, 0], ['f', 1, 1], ['g', 1, 2], ['h', 1, 3],
    ]);
  });
  test('an L takes a 2x2 block and the cursor never moves back', () => {
    const layout = [item('a', 'revenue', 'l'), item('b'), item('c'), item('d', 'revenue', 'm'), item('e')];
    const p = placeAll(layout, 4, SPECS);
    assert.deepEqual(p.map((x) => [x.id, x.row, x.col, x.cols, x.rows]), [
      ['a', 0, 0, 2, 2], ['b', 0, 2, 1, 1], ['c', 0, 3, 1, 1], ['d', 1, 2, 2, 1], ['e', 2, 0, 1, 1],
    ]);
  });
  test('placement uses the fitted size', () => {
    const p = placeAll([item('a', 'revenue', 'xl'), item('b')], 2, SPECS);
    assert.deepEqual(p.map((x) => [x.id, x.size, x.row, x.col, x.cols, x.rows]), [['a', 'l', 0, 0, 2, 2], ['b', 's', 2, 0, 1, 1]]);
  });
});

describe('reorder', () => {
  test('move puts the item at the target index', () => {
    assert.deepEqual(ids(move(eight(), 0, 3)), ['b', 'c', 'd', 'a', 'e', 'f', 'g', 'h']);
    assert.deepEqual(ids(move(eight(), 5, 1)), ['a', 'f', 'b', 'c', 'd', 'e', 'g', 'h']);
  });
  test('move out of range or onto itself returns the same layout', () => {
    const l = eight();
    assert.equal(move(l, 2, 2), l);
    assert.equal(move(l, -1, 2), l);
    assert.equal(move(l, 2, 99), l);
  });
  test('Left and Right move one slot; the ends do nothing', () => {
    assert.deepEqual(ids(moveBy(eight(), 'c', 'left', 4, SPECS)), ['a', 'c', 'b', 'd', 'e', 'f', 'g', 'h']);
    assert.deepEqual(ids(moveBy(eight(), 'c', 'right', 4, SPECS)), ['a', 'b', 'd', 'c', 'e', 'f', 'g', 'h']);
    const l = eight();
    assert.equal(moveBy(l, 'a', 'left', 4, SPECS), l);
    assert.equal(moveBy(l, 'h', 'right', 4, SPECS), l);
  });
  test('Up and Down move one row on a 2D grid', () => {
    assert.deepEqual(ids(moveBy(eight(), 'f', 'up', 4, SPECS)), ['a', 'f', 'b', 'c', 'd', 'e', 'g', 'h']);
    assert.deepEqual(ids(moveBy(eight(), 'b', 'down', 4, SPECS)), ['a', 'c', 'd', 'e', 'f', 'b', 'g', 'h']);
  });
  test('Up on the first row and Down on the last row do nothing', () => {
    const l = eight();
    assert.equal(moveBy(l, 'c', 'up', 4, SPECS), l);
    assert.equal(moveBy(l, 'g', 'down', 4, SPECS), l);
  });
  test('Up and Down step over a tall tile by its rows, at 2 columns', () => {
    // 2 cols: a(L) rows 0-1, b c on row 2
    const l = [item('a', 'revenue', 'l'), item('b'), item('c')];
    assert.deepEqual(ids(moveBy(l, 'c', 'up', 2, SPECS)), ['c', 'a', 'b']);
    assert.deepEqual(ids(moveBy(l, 'a', 'down', 2, SPECS)), ['b', 'a', 'c']);
  });
  test('at 1 column Up and Down are one slot', () => {
    const l = [item('a'), item('b'), item('c')];
    assert.deepEqual(ids(moveBy(l, 'b', 'up', 1, SPECS)), ['b', 'a', 'c']);
    assert.deepEqual(ids(moveBy(l, 'b', 'down', 1, SPECS)), ['a', 'c', 'b']);
  });
  test('an unknown id does nothing', () => {
    const l = eight();
    assert.equal(moveBy(l, 'zz', 'left', 4, SPECS), l);
  });
  test('Alt+Arrow maps to a direction; anything else is null', () => {
    assert.equal(moveDirection({ key: 'ArrowLeft', altKey: true }), 'left');
    assert.equal(moveDirection({ key: 'ArrowRight', altKey: true }), 'right');
    assert.equal(moveDirection({ key: 'ArrowUp', altKey: true }), 'up');
    assert.equal(moveDirection({ key: 'ArrowDown', altKey: true }), 'down');
    assert.equal(moveDirection({ key: 'ArrowLeft' }), null);
    assert.equal(moveDirection({ key: 'ArrowLeft', altKey: true, metaKey: true }), null);
    assert.equal(moveDirection({ key: 'ArrowLeft', altKey: true, ctrlKey: true }), null);
    assert.equal(moveDirection({ key: 'ArrowLeft', altKey: true, shiftKey: true }), null);
    assert.equal(moveDirection({ key: 'a', altKey: true }), null);
    assert.equal(moveDirection({ key: 'ArrowLeft', altKey: true, isComposing: true }), null);
  });
});

describe('add, remove, undo, resize', () => {
  test('add appends with a fresh id', () => {
    const l = [item('w1'), item('w2')];
    const next = addWidget(l, 'tasks', 'm');
    assert.equal(next.length, 3);
    assert.equal(next[2].kind, 'tasks');
    assert.equal(next[2].size, 'm');
    assert.ok(!['w1', 'w2'].includes(next[2].id));
    assert.deepEqual(ids(addWidget(l, 'tasks', 'm', 'x9')), ['w1', 'w2', 'x9']);
  });
  test('add keeps a given id unique', () => {
    const next = addWidget([item('x9')], 'tasks', 'm', 'x9');
    assert.equal(new Set(ids(next)).size, 2);
  });
  test('remove then restore round-trips to the same layout', () => {
    const l = eight();
    const { layout, removed } = removeWidget(l, 'c');
    assert.deepEqual(ids(layout), ['a', 'b', 'd', 'e', 'f', 'g', 'h']);
    assert.deepEqual(removed, { item: item('c'), index: 2 });
    assert.deepEqual(restoreWidget(layout, removed), l);
  });
  test('restore clamps the index and never duplicates an id', () => {
    const { removed } = removeWidget(eight(), 'h');
    assert.deepEqual(ids(restoreWidget([item('a')], removed)), ['a', 'h']);
    const l = [item('h')];
    assert.equal(restoreWidget(l, removed), l);
  });
  test('removing an unknown id changes nothing', () => {
    const l = eight();
    const r = removeWidget(l, 'zz');
    assert.equal(r.layout, l);
    assert.equal(r.removed, null);
  });
  test('after a remove, focus goes to the next widget, else the previous, else none', () => {
    assert.equal(nextFocusId([item('a'), item('b'), item('d')], 2), 'd');
    assert.equal(nextFocusId([item('a'), item('b')], 2), 'b');
    assert.equal(nextFocusId([], 0), null);
  });
  test('resize sets a supported size and ignores the rest', () => {
    const l = [item('a', 'runway', 's')];
    assert.equal(resizeWidget(l, 'a', 'm', SPECS)[0].size, 'm');
    assert.equal(resizeWidget(l, 'a', 'xl', SPECS), l);
    assert.equal(resizeWidget(l, 'zz', 'm', SPECS), l);
    assert.equal(resizeWidget(l, 'a', 's', SPECS), l);
  });
});

describe('serialize and parse', () => {
  test('round-trip', () => {
    const l = [item('a', 'revenue', 'xl'), item('b', 'runway', 'm')];
    assert.deepEqual(parseLayout(serializeLayout(l), SPECS), l);
  });
  test('serialize keeps only id, kind and size', () => {
    assert.equal(serializeLayout([{ id: 'a', kind: 'revenue', size: 's', extra: 1 }]), '[{"id":"a","kind":"revenue","size":"s"}]');
  });
  test('rejects unknown kinds and unsupported sizes, keeps the rest', () => {
    const text = JSON.stringify([item('a', 'revenue', 'm'), item('b', 'gone', 's'), item('c', 'runway', 'xl'), item('d', 'week', 's'), item('e', 'week', 'l')]);
    assert.deepEqual(ids(parseLayout(text, SPECS)), ['a', 'e']);
  });
  test('rejects malformed items and duplicate ids', () => {
    const text = JSON.stringify([null, 3, { id: '', kind: 'revenue', size: 's' }, { id: 5, kind: 'revenue', size: 's' }, { kind: 'revenue', size: 's' }, item('a'), item('a', 'runway', 'm'), { id: 'x'.repeat(65), kind: 'revenue', size: 's' }]);
    assert.deepEqual(parseLayout(text, SPECS), [item('a')]);
  });
  test('garbage is null', () => {
    for (const bad of ['', 'nope', '{"a":1}', '42', 'null', null, undefined]) assert.equal(parseLayout(bad, SPECS), null, String(bad));
  });
  test('read and write go through injected storage and never throw', () => {
    const s = memory();
    writeLayout(s, [item('a')]);
    assert.equal(s.m.get(LAYOUT_KEY), '[{"id":"a","kind":"revenue","size":"s"}]');
    assert.deepEqual(readLayout(s, SPECS), [item('a')]);
    assert.equal(readLayout(memory(), SPECS), null);
    assert.equal(readLayout(null, SPECS), null);
    assert.equal(readLayout(throwing, SPECS), null);
    assert.doesNotThrow(() => writeLayout(throwing, [item('a')]));
    assert.doesNotThrow(() => writeLayout(null, [item('a')]));
    const k = memory();
    writeLayout(k, [item('a')], 'custom');
    assert.deepEqual(readLayout(k, SPECS, 'custom'), [item('a')]);
  });
});

describe('announcements', () => {
  test('moved, resized, removed, added', () => {
    assert.equal(movedMessage('Revenue', 2, 8), 'Revenue moved to position 3 of 8');
    assert.equal(resizedMessage('Revenue', 'xl'), 'Revenue resized to extra large');
    assert.equal(removedMessage('Revenue'), 'Revenue removed');
    assert.equal(addedMessage('Revenue'), 'Revenue added');
  });
});
