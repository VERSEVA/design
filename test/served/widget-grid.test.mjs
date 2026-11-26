// The widget grid follows its container (issue 207), in headless Chrome over out/ (chrome.mjs).
// A grid inside .wgrid-wrap steps down on the wrapper's width: 2 columns under 1100px, 1 under
// 560px. A grid with no wrapper keeps the viewport rule. An edge-to-edge grid, wrapped or not,
// holds the column counts and tile widths it had before the wrapper existed. On /widgets the
// React part wraps its own grid and fits each tile to the columns the CSS shows.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';

const TILES = ['s', 'm', 'l', 'xl', 's'].map((s) => `<div class="wtile" data-size="${s}"></div>`).join('');
const GRID = `<div class="wgrid">${TILES}</div>`;
const WRAPPED = `<div class="wgrid-wrap">${GRID}</div>`;
const doc = (body) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/components.css"><style>html,body{margin:0}</style></head><body>${body}</body></html>`;
const EXTRA = {
  '/__probe/wgrid-900': doc(`<div style="width:900px">${WRAPPED}</div>`),
  '/__probe/wgrid-500': doc(`<div style="width:500px">${WRAPPED}</div>`),
  '/__probe/wgrid-900-bare': doc(`<div style="width:900px">${GRID}</div>`),
  '/__probe/wgrid-full': doc(WRAPPED),
  '/__probe/wgrid-full-bare': doc(GRID),
};

/* Every .wgrid on the page: its wrapper's width (null with no wrapper), the columns and row gap
   the CSS resolved, and each tile's size and width. */
const MEASURE = (wait = 0) => `(async () => {
  await new Promise((r) => setTimeout(r, ${wait}));
  const px = (el) => Math.round(el.getBoundingClientRect().width * 100) / 100;
  return JSON.stringify([...document.querySelectorAll('.wgrid')].map((g) => {
    const cs = getComputedStyle(g);
    const wrap = g.parentElement.classList.contains('wgrid-wrap') ? g.parentElement : null;
    return {
      name: g.getAttribute('aria-label') ?? g.className,
      wrap: wrap ? px(wrap) : null,
      forced: g.dataset.cols ?? null,
      cols: cs.gridTemplateColumns.split(' ').length,
      gap: cs.rowGap,
      tiles: [...g.querySelectorAll(':scope > .wtile')].map((t) => [t.dataset.size, px(t)]),
    };
  }));
})()`;

let run;
before(async () => { run = await start({ extra: EXTRA }); });
after(async () => { await run?.stop(); });

async function measure(path, width, wait = 0) {
  const page = await run.page({ width, height: 900, scheme: 'light' });
  await page.goto(path);
  const grids = JSON.parse(await page.evaluate(MEASURE(wait)));
  await page.close();
  return grids;
}

test('a wrapped grid in a 900px container shows 2 columns at a 1400px viewport', { timeout: 60000 }, async () => {
  const [g] = await measure('/__probe/wgrid-900', 1400);
  assert.equal(g.wrap, 900);
  assert.equal(g.cols, 2);
  assert.equal(g.gap, '16px');
  assert.deepEqual(g.tiles, [['s', 442], ['m', 900], ['l', 900], ['xl', 900], ['s', 442]]);
});

test('a wrapped grid in a 500px container shows 1 column at a 1400px viewport', { timeout: 60000 }, async () => {
  const [g] = await measure('/__probe/wgrid-500', 1400);
  assert.equal(g.cols, 1);
  assert.equal(g.gap, '12px');
  assert.deepEqual(g.tiles.map(([, w]) => w), [500, 500, 500, 500, 500]);
});

test('a grid with no wrapper keeps the viewport rule: 4 columns in a 900px container at 1400px', { timeout: 60000 }, async () => {
  const [g] = await measure('/__probe/wgrid-900-bare', 1400);
  assert.equal(g.wrap, null);
  assert.equal(g.cols, 4);
});

/* Measured on staging before the wrapper existed: viewport, columns, row gap, then the S, M, L and XL tile widths. */
const FULL = [
  [1400, 4, '16px', [338, 692, 692, 1400]],
  [1100, 4, '16px', [263, 542, 542, 1100]],
  [1000, 2, '16px', [492, 1000, 1000, 1000]],
  [560, 2, '16px', [272, 560, 560, 560]],
  [500, 1, '12px', [500, 500, 500, 500]],
];
for (const [path, label] of [['/__probe/wgrid-full', 'wrapped'], ['/__probe/wgrid-full-bare', 'bare']]) {
  for (const [width, cols, gap, widths] of FULL) {
    test(`a full-width ${label} grid is unchanged at ${width}px: ${cols} columns`, { timeout: 60000 }, async () => {
      const [g] = await measure(path, width);
      assert.equal(g.cols, cols);
      assert.equal(g.gap, gap);
      assert.deepEqual(g.tiles.slice(0, 4).map(([, w]) => w), widths);
    });
  }
}

const columnsFor = (w) => (w >= 1100 ? 4 : w >= 560 ? 2 : 1);
for (const width of [1400, 1000, 500]) {
  test(`/widgets at ${width}px: every React grid follows its wrapper and fits its tiles`, { timeout: 60000 }, async () => {
    const grids = (await measure('/widgets', width, 900)).filter((g) => !g.forced);
    assert.ok(grids.length >= 3, `found ${grids.length} grids`);
    for (const g of grids) {
      assert.notEqual(g.wrap, null, `${g.name} has no .wgrid-wrap`);
      assert.equal(g.cols, columnsFor(g.wrap), `${g.name} is ${g.wrap}px wide`);
      const sizes = g.tiles.map(([s]) => s);
      if (g.cols < 4) assert.ok(!sizes.includes('xl'), `${g.name}: XL view in ${g.cols} columns`);
      if (g.cols < 2) assert.ok(!sizes.includes('l'), `${g.name}: L view in 1 column`);
    }
  });
}
