// The widget grid's container mode (issue 207), in headless Chrome over out/ (chrome.mjs).
// Default mode is what staging rendered: a bare .wgrid that steps down on the viewport (1100px,
// 560px), with className on the grid element, so a consumer's placement, shrink-to-fit parent,
// percentage height and sticky rules keep working. Container mode is opt-in (.wgrid-wrap, or the
// React part's container prop): the grid counts columns from the wrapper's width, 4 from 688px,
// 2 from 560px, 1 below, whatever the viewport. On /widgets only the Container specimen opts in.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';

const TILES = ['s', 'm', 'l', 'xl', 's'].map((s) => `<div class="wtile" data-size="${s}"></div>`).join('');
const GRID = `<div class="wgrid">${TILES}</div>`;
const WRAPPED = `<div class="wgrid-wrap">${GRID}</div>`;
const doc = (body, css = '') => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/components.css"><style>html,body{margin:0}${css}</style></head><body>${body}</body></html>`;

/* Wrapper width, viewport, columns. 768 and 688 run at a 1000px viewport, where the viewport rule
   alone would give 2 columns; 687, 560 and 559 at 1400px, where it would give 4. */
const CONTAINERS = [[1112, 1400, 4], [952, 1400, 4], [768, 1000, 4], [688, 1000, 4], [687, 1400, 2], [560, 1400, 2], [559, 1400, 1]];

/* A grid in default mode, as the React part renders it: tiles with 100px of content. */
const FILLED = `<div class="wgrid">${['s', 's', 's', 's'].map((s) => `<div class="wtile" data-size="${s}"><div style="width:100px;height:40px"></div></div>`).join('')}</div>`;
/* Edit mode markup for one small tile with four sizes, as the React part renders it. */
const BTN = (n) => Array.from({ length: n }, () => '<button type="button"></button>').join('');
const EDITING = `<div style="width:688px"><div class="wgrid-wrap"><div class="wgrid" data-editing><div class="wtile" data-size="s"><button type="button" class="wtile-x"></button><div class="wtile-body"></div><div class="wtile-edit"><div class="wtile-move">${BTN(2)}</div><div class="wtile-sizes">${BTN(4)}</div></div></div></div></div></div>`;

const EXTRA = {
  ...Object.fromEntries(CONTAINERS.map(([w]) => [`/__probe/wgrid-${w}`, doc(`<div style="width:${w}px">${WRAPPED}</div>`)])),
  '/__probe/wgrid-full': doc(WRAPPED),
  '/__probe/wgrid-full-bare': doc(GRID),
  '/__probe/default-placed': doc(`<div class="gp" style="display:grid;grid-template-columns:232px 1fr">${FILLED}</div>`, '.gp > .wgrid{grid-column:1 / -1}'),
  '/__probe/default-inline-block': doc(`<div style="display:inline-block">${FILLED}</div>`),
  '/__probe/default-auto-track': doc(`<div style="display:grid;grid-template-columns:auto 1fr"><div>${FILLED}</div><div></div></div>`),
  '/__probe/default-height': doc(`<div class="ph" style="height:300px">${FILLED}</div>`, '.ph .wgrid{height:100%;overflow:auto}'),
  '/__probe/default-sticky': doc(`<div style="height:3000px">${FILLED}</div>`, '.wgrid{position:sticky;top:0}'),
  '/__probe/editing-688': doc(EDITING),
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

for (const [w, viewport, cols] of CONTAINERS) {
  test(`container mode: a ${w}px wrapper shows ${cols} column${cols > 1 ? 's' : ''} at a ${viewport}px viewport`, { timeout: 60000 }, async () => {
    const [g] = await measure(`/__probe/wgrid-${w}`, viewport);
    assert.equal(g.wrap, w);
    assert.equal(g.cols, cols);
    assert.equal(g.gap, cols === 1 ? '12px' : '16px');
    const col = (w - (cols - 1) * 16) / cols;
    const span = (n) => (cols === 1 ? w : Math.min(n, cols) * col + (Math.min(n, cols) - 1) * 16);
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
for (const [path, label, rows] of [['/__probe/wgrid-full-bare', 'default grid is unchanged', BEFORE], ['/__probe/wgrid-full', 'container-mode grid follows its width', WRAPPED_FULL]]) {
  for (const [width, cols, gap, widths] of rows) {
    test(`a full-width ${label} at ${width}px: ${cols} column${cols > 1 ? 's' : ''}`, { timeout: 60000 }, async () => {
      const [g] = await measure(path, width);
      assert.equal(g.cols, cols);
      assert.equal(g.gap, gap);
      assert.deepEqual(g.tiles.slice(0, 4).map(([, w]) => w), widths);
    });
  }
}

/* The four ways an always-on wrapper broke existing consumers. Default mode must match staging,
   measured there at a 1280px viewport: 1280px and 4 columns placed across a 232px + 1fr grid;
   four 102px tiles (456px, 4 columns) in a shrink-to-fit parent, never 0px; 300px tall at height:100%; stuck at the top. */
const BOX = (scroll = 0) => `(async () => {
  scrollTo(0, ${scroll});
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const g = document.querySelector('.wgrid');
  const r = g.getBoundingClientRect();
  return JSON.stringify({ direct: !g.parentElement.classList.contains('wgrid-wrap'), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, tile: Math.round(g.firstElementChild.getBoundingClientRect().width) });
})()`;
async function box(path, scroll = 0) {
  const page = await run.page({ width: 1280, height: 900, scheme: 'light' });
  await page.goto(path);
  const r = JSON.parse(await page.evaluate(BOX(scroll)));
  await page.close();
  return r;
}

test('default mode: a consumer rule that places .wgrid across its parent grid still applies (1280px, 4 columns)', { timeout: 60000 }, async () => {
  const g = await box('/__probe/default-placed');
  assert.deepEqual([g.w, g.cols, g.tile], [1280, 4, 308]);
});

for (const [path, label] of [['/__probe/default-inline-block', 'an inline-block parent'], ['/__probe/default-auto-track', 'an auto track']]) {
  test(`default mode: in ${label} the grid takes its width from its content (456px, 4 columns)`, { timeout: 60000 }, async () => {
    const g = await box(path);
    assert.deepEqual([g.w, g.cols, g.tile], [456, 4, 102]);
  });
}

test('default mode: height:100% and overflow on .wgrid resolve against the parent (300px)', { timeout: 60000 }, async () => {
  const g = await box('/__probe/default-height');
  assert.equal(g.h, 300);
});

test('default mode: position:sticky on .wgrid sticks', { timeout: 60000 }, async () => {
  const g = await box('/__probe/default-sticky', 800);
  assert.equal(g.top, 0);
});

const viewportColumns = (w) => (w >= 1100 ? 4 : w >= 560 ? 2 : 1);
const containerColumns = (w) => (w >= 688 ? 4 : w >= 560 ? 2 : 1);
for (const width of [1400, 1280, 1100, 1000, 500]) {
  test(`/widgets at ${width}px: only the Container specimen is in container mode, and every grid fits its tiles`, { timeout: 60000 }, async () => {
    const grids = await measure('/widgets', width, 900);
    assert.deepEqual(grids.filter((g) => g.wrap !== null).map((g) => g.name), ['Container widgets']);
    assert.ok(grids.length >= 5, `found ${grids.length} grids`);
    for (const g of grids) {
      assert.equal(g.cols, g.wrap === null ? viewportColumns(width) : containerColumns(g.wrap), `${g.name} at ${g.wrap ?? width}px`);
      const sizes = g.tiles.map(([s]) => s);
      if (g.cols < 4) assert.ok(!sizes.includes('xl'), `${g.name}: XL view in ${g.cols} columns`);
      if (g.cols < 2) assert.ok(!sizes.includes('l'), `${g.name}: L view in 1 column`);
    }
  });
}

test('/widgets at 1100px: beside its rail the Container specimen shows 2 columns while the viewport grids show 4', { timeout: 60000 }, async () => {
  const grids = await measure('/widgets', 1100, 900);
  const beside = grids.find((g) => g.name === 'Container widgets');
  assert.ok(beside.wrap < 688 && beside.wrap >= 560, `the specimen grid is ${beside.wrap}px wide`);
  assert.equal(beside.cols, 2);
  assert.equal(grids.find((g) => g.name === 'Revenue sizes').cols, 4);
});

/* The same four cases on a live React grid in default mode (/widgets, Revenue sizes, 1280px): the
   grid is moved into a consumer-style parent and styled by class, as a consumer would. With a
   wrapper between the parent and .wgrid each of these fails. */
const LIVE = (kind) => `(async () => {
  await new Promise((r) => setTimeout(r, 900));
  const g = document.querySelector('.wgrid[aria-label="Revenue sizes"]');
  const root = g.parentElement.classList.contains('wgrid-wrap') ? g.parentElement : g;
  const css = document.createElement('style');
  css.textContent = '.gp{display:grid;grid-template-columns:232px 1fr}.gp > .wgrid{grid-column:1 / -1}.ib{display:inline-block}.ph{height:300px}.ph .wgrid{height:100%;overflow:auto}.st{height:3000px}.st .wgrid{position:sticky;top:0}';
  document.head.append(css);
  const box = document.createElement('div');
  box.className = '${kind}';
  root.replaceWith(box);
  box.append(root);
  if ('${kind}' === 'st') { const mark = document.createElement('div'); mark.style.cssText = 'position:absolute;height:1px;width:1px'; box.style.position = 'relative'; mark.style.top = '1200px'; box.append(mark); mark.scrollIntoView({ block: 'start' }); }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const r = g.getBoundingClientRect(), q = box.getBoundingClientRect();
  return JSON.stringify({ direct: root === g, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), boxW: Math.round(q.width), boxTop: Math.round(q.top), cols: getComputedStyle(g).gridTemplateColumns.split(' ').length });
})()`;
async function live(kind) {
  const page = await run.page({ width: 1280, height: 900, scheme: 'light' });
  await page.goto('/widgets');
  const r = JSON.parse(await page.evaluate(LIVE(kind)));
  await page.close();
  assert.ok(r.direct, 'the grid has a wrapper in default mode');
  return r;
}

test('/widgets, live default-mode React grid: a parent rule places it across both tracks', { timeout: 60000 }, async () => {
  const r = await live('gp');
  assert.ok(r.boxW > 600, `the parent is ${r.boxW}px wide`);
  assert.equal(r.w, r.boxW);
  assert.equal(r.cols, 4);
});

test('/widgets, live default-mode React grid: a shrink-to-fit parent does not collapse it', { timeout: 60000 }, async () => {
  const r = await live('ib');
  assert.ok(r.w > 400, `the grid is ${r.w}px wide`);
  assert.equal(r.cols, 4);
});

test('/widgets, live default-mode React grid: height:100% resolves against a 300px parent', { timeout: 60000 }, async () => {
  const r = await live('ph');
  assert.equal(r.h, 300);
});

test('/widgets, live default-mode React grid: position:sticky holds it while its parent scrolls away', { timeout: 60000 }, async () => {
  const r = await live('st');
  assert.ok(r.boxTop < -500, `the parent scrolled to ${r.boxTop}px`);
  assert.ok(r.top >= 0, `the grid is at ${r.top}px`);
});

test('the home hero is in default mode: 4 columns at a 1400px viewport, as on staging', { timeout: 60000 }, async () => {
  const hero = (await measure('/', 1400, 900)).find((g) => g.name === 'Live home');
  assert.equal(hero.wrap, null);
  assert.equal(hero.forced, null);
  assert.equal(hero.cols, 4);
  assert.deepEqual(hero.tiles, [['l', 290.67], ['m', 290.67], ['m', 290.67]]);
});

/* Edit mode in container mode at a 688px wrapper and a 1000px viewport: the small tile is 160px wide. */
const PILL = `(() => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
  const t = document.querySelector('.wtile');
  return JSON.stringify({
    cols: getComputedStyle(t.parentElement).gridTemplateColumns.split(' ').length,
    tile: box(t), remove: box(t.querySelector('.wtile-x')), move: box(t.querySelector('.wtile-move')),
    pill: box(t.querySelector('.wtile-sizes')), buttons: [...t.querySelectorAll('.wtile-sizes button')].map(box),
  });
})()`;

test('container mode, edit mode at a 688px wrapper: a 160px small tile holds its four-size pill 2 by 2, inside the tile', { timeout: 60000 }, async () => {
  const page = await run.page({ width: 1000, height: 900, scheme: 'light', reducedMotion: true });
  await page.goto('/__probe/editing-688');
  const r = JSON.parse(await page.evaluate(PILL));
  await page.close();
  assert.equal(r.cols, 4);
  assert.equal(r.tile.r - r.tile.l, 160);
  assert.equal(r.buttons.length, 4);
  assert.equal(new Set(r.buttons.map((b) => b.t)).size, 2, 'two rows');
  assert.equal(new Set(r.buttons.map((b) => b.l)).size, 2, 'two columns');
  for (const part of [r.pill, r.move]) {
    assert.ok(part.l >= r.tile.l && part.r <= r.tile.r && part.b <= r.tile.b, `inside the tile: ${JSON.stringify(part)} in ${JSON.stringify(r.tile)}`);
    assert.ok(part.t >= r.remove.b, 'below the remove button');
  }
  assert.ok(r.move.r <= r.pill.l, 'Move sits beside the sizes');
});
