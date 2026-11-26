// The widget grid follows its container (issue 207), in headless Chrome over out/ (chrome.mjs).
// A grid inside .wgrid-wrap counts columns from the wrapper's width: 4 from 688px, 2 from 560px,
// 1 below, whatever the viewport. A grid with no wrapper keeps the viewport rule (1100px, 560px)
// and the column counts and tile widths it had before the wrapper existed. On / and /widgets the
// React part wraps its own grid and fits each tile to the columns the CSS shows; the home hero,
// split, pins its 4 columns. A small tile under 180px lays its four-size pill out 2 by 2.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';

const TILES = ['s', 'm', 'l', 'xl', 's'].map((s) => `<div class="wtile" data-size="${s}"></div>`).join('');
const GRID = `<div class="wgrid">${TILES}</div>`;
const WRAPPED = `<div class="wgrid-wrap">${GRID}</div>`;
const doc = (body) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/components.css"><style>html,body{margin:0}</style></head><body>${body}</body></html>`;
const CONTAINERS = [[1112, 4], [952, 4], [688, 4], [687, 2], [560, 2], [559, 1]];
const EXTRA = {
  ...Object.fromEntries(CONTAINERS.map(([w]) => [`/__probe/wgrid-${w}`, doc(`<div style="width:${w}px">${WRAPPED}</div>`)])),
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

for (const [w, cols] of CONTAINERS) {
  test(`a wrapped grid in a ${w}px container shows ${cols} column${cols > 1 ? 's' : ''} at a 1400px viewport`, { timeout: 60000 }, async () => {
    const [g] = await measure(`/__probe/wgrid-${w}`, 1400);
    assert.equal(g.wrap, w);
    assert.equal(g.cols, cols);
    assert.equal(g.gap, cols === 1 ? '12px' : '16px');
    const gap = 16;
    const col = (w - (cols - 1) * gap) / cols;
    const span = (n) => (cols === 1 ? w : Math.min(n, cols) * col + (Math.min(n, cols) - 1) * gap);
    assert.deepEqual(g.tiles, [['s', span(1)], ['m', span(2)], ['l', span(2)], ['xl', span(4)], ['s', span(1)]]);
  });
}

/* Measured on staging before the wrapper existed: viewport, columns, row gap, then the S, M, L and XL tile widths. */
const BEFORE = [
  [1400, 4, '16px', [338, 692, 692, 1400]],
  [1100, 4, '16px', [263, 542, 542, 1100]],
  [1000, 2, '16px', [492, 1000, 1000, 1000]],
  [560, 2, '16px', [272, 560, 560, 560]],
  [500, 1, '12px', [500, 500, 500, 500]],
];
/* A wrapped edge-to-edge grid is its own 1000px container: 4 columns there, the one row that differs. */
const WRAPPED_FULL = BEFORE.map((row) => (row[0] === 1000 ? [1000, 4, '16px', [238, 492, 492, 1000]] : row));
for (const [path, label, rows] of [['/__probe/wgrid-full-bare', 'bare grid is unchanged', BEFORE], ['/__probe/wgrid-full', 'wrapped grid follows its width', WRAPPED_FULL]]) {
  for (const [width, cols, gap, widths] of rows) {
    test(`a full-width ${label} at ${width}px: ${cols} column${cols > 1 ? 's' : ''}`, { timeout: 60000 }, async () => {
      const [g] = await measure(path, width);
      assert.equal(g.cols, cols);
      assert.equal(g.gap, gap);
      assert.deepEqual(g.tiles.slice(0, 4).map(([, w]) => w), widths);
    });
  }
}

const columnsFor = (w) => (w >= 688 ? 4 : w >= 560 ? 2 : 1);
for (const width of [1400, 1280, 1000, 500]) {
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

test('the home hero keeps its 4 columns while split, at a 1400px viewport', { timeout: 60000 }, async () => {
  const hero = (await measure('/', 1400, 900)).find((g) => g.name === 'Live home');
  assert.ok(hero, 'no Live home grid');
  assert.ok(hero.wrap < 688, `the split hero grid is ${hero.wrap}px wide`);
  assert.equal(hero.forced, '4');
  assert.equal(hero.cols, 4);
  assert.deepEqual(hero.tiles.map(([s]) => s), ['l', 'm', 'm']);
});

test('the home hero, stacked at a 1000px viewport, follows its container', { timeout: 60000 }, async () => {
  const hero = (await measure('/', 1000, 900)).find((g) => g.name === 'Live home');
  assert.equal(hero.forced, null);
  assert.equal(hero.cols, columnsFor(hero.wrap));
  assert.equal(hero.cols, 4);
  /* 4 columns hold all three tiles, L beside two M: no hole where the third was hidden */
  assert.equal(hero.tiles.filter(([, w]) => w > 0).length, 3);
});

test('the home hero under 688px of its own width drops to two tiles', { timeout: 60000 }, async () => {
  const hero = (await measure('/', 700, 900)).find((g) => g.name === 'Live home');
  assert.ok(hero.wrap < 688, `the hero grid is ${hero.wrap}px wide`);
  assert.equal(hero.cols, columnsFor(hero.wrap));
  assert.equal(hero.tiles.filter(([, w]) => w > 0).length, 2);
});

/* Edit mode on /widgets with the Home grid's wrapper held at 688px: small tiles are 160px wide. */
const PILL = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(900);
  const g = document.querySelector('.wgrid[aria-label="Home widgets"]');
  g.parentElement.style.width = '688px';
  document.querySelector('.wx-head .btn').click();
  await sleep(500);
  const four = [...g.querySelectorAll('.wtile')].find((t) => t.querySelectorAll('.wtile-sizes button').length === 4);
  if (!four) return JSON.stringify({ found: false });
  four.querySelector('.wtile-sizes button').click();
  await sleep(700);
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
  return JSON.stringify({
    found: true, size: four.dataset.size, cols: getComputedStyle(g).gridTemplateColumns.split(' ').length,
    tile: box(four), remove: box(four.querySelector('.wtile-x')), move: box(four.querySelector('.wtile-move')),
    pill: box(four.querySelector('.wtile-sizes')), buttons: [...four.querySelectorAll('.wtile-sizes button')].map(box),
  });
})()`;

test('edit mode at a 688px container: a 160px small tile holds its four-size pill 2 by 2, inside the tile', { timeout: 60000 }, async () => {
  const page = await run.page({ width: 1400, height: 900, scheme: 'light', reducedMotion: true });
  await page.goto('/widgets');
  const r = JSON.parse(await page.evaluate(PILL));
  await page.close();
  assert.ok(r.found, 'no widget with four sizes on the Home grid');
  assert.equal(r.cols, 4);
  assert.equal(r.size, 's');
  assert.equal(r.tile.r - r.tile.l, 160);
  assert.equal(new Set(r.buttons.map((b) => b.t)).size, 2, 'two rows');
  assert.equal(new Set(r.buttons.map((b) => b.l)).size, 2, 'two columns');
  for (const part of [r.pill, r.move]) {
    assert.ok(part.l >= r.tile.l && part.r <= r.tile.r && part.b <= r.tile.b, `inside the tile: ${JSON.stringify(part)} in ${JSON.stringify(r.tile)}`);
    assert.ok(part.t >= r.remove.b, 'below the remove button');
  }
  assert.ok(r.move.r <= r.pill.l, 'Move sits beside the sizes');
});
