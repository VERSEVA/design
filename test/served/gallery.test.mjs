// The gallery bento (1.7.0) in headless Chrome over out/ (chrome.mjs): scrolling the whole
// page never holds more than MAX_LIVE thumbnail frames at once (3 on a phone, 6 wide) and every
// thumbnail loads on its turn; thumbnails take no pointer events and are inert; a thumbnail
// plays only while its tile is hovered, and never under reduced motion.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';

const MAX = { phone: 3, wide: 6 };
let run;
before(async () => { run = await start(); });
after(async () => { await run?.stop(); });

const SCROLL = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(800);
  const thumbs = [...document.querySelectorAll('.gthumb')];
  const seen = new Set();
  let most = 0;
  for (let y = 0; y <= document.documentElement.scrollHeight; y += Math.round(innerHeight / 3)) {
    scrollTo(0, y);
    await sleep(350);
    const live = thumbs.filter((t) => t.querySelector('iframe'));
    live.forEach((t) => seen.add(thumbs.indexOf(t)));
    most = Math.max(most, live.length);
  }
  return JSON.stringify({ count: thumbs.length, most, seen: seen.size });
})()`;

for (const [width, height, max] of [[375, 812, MAX.phone], [1440, 900, MAX.wide]]) {
  test(`/gallery holds at most ${max} live thumbnails while scrolling, and loads each on its turn (${width}px)`, { timeout: 90000 }, async () => {
    const page = await run.page({ width, height });
    await page.goto('/gallery');
    const r = JSON.parse(await page.evaluate(SCROLL));
    await page.close();
    assert.equal(r.count, 8);
    assert.ok(r.most <= max, `${r.most} frames live at once, over ${max}`);
    assert.equal(r.seen, r.count, `only ${r.seen} of ${r.count} thumbnails ever loaded`);
  });
}

/* The motion state after each step, waited for up to 2s (a busy CI runner renders late). */
const HOVER = (reduced) => `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const settle = async (want) => { for (let t = 0; t < 40 && motion() !== want; t++) await sleep(50); return motion(); };
  await sleep(2500);
  const box = [...document.querySelectorAll('.gthumb')].find((t) => t.querySelector('iframe[data-loaded]'));
  if (!box) return JSON.stringify({ error: 'no loaded thumbnail' });
  const tile = box.closest('.gtile');
  const f = box.querySelector('iframe');
  const motion = () => f.contentDocument.documentElement.dataset.motion ?? 'running';
  const pre = { playing: box.dataset.playing !== undefined, motion: motion(), focus: tile.contains(document.activeElement), hover: tile.matches(':hover') };
  /* The headless pointer may rest over a tile after load: start from no hover and no focus. */
  tile.dispatchEvent(new PointerEvent('pointerleave'));
  document.activeElement?.blur?.();
  await settle('paused');
  const r = box.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const out = { inert: box.inert, hidden: box.getAttribute('aria-hidden'), hitInThumb: box.contains(hit), still: motion() };
  tile.dispatchEvent(new PointerEvent('pointerenter'));
  out.hovered = await settle(${reduced} ? 'paused' : 'running');
  ${reduced} && await sleep(500);
  out.hovered = motion();
  tile.dispatchEvent(new PointerEvent('pointerleave'));
  out.left = await settle('paused');
  return JSON.stringify({ out, pre });
})()`;

for (const reducedMotion of [false, true]) {
  test(`a thumbnail is inert, takes no pointer events, and plays on hover only with motion allowed (reduced motion ${reducedMotion})`, { timeout: 60000 }, async () => {
    const page = await run.page({ width: 1440, height: 900, reducedMotion });
    await page.goto('/gallery');
    const { out: r, pre } = JSON.parse(await page.evaluate(HOVER(reducedMotion)));
    await page.close();
    console.log('before idle reset', JSON.stringify(pre));
    assert.deepEqual(r, { inert: true, hidden: 'true', hitInThumb: false, still: 'paused', hovered: reducedMotion ? 'paused' : 'running', left: 'paused' });
  });
}

/* Every chip, as rendered by the browser over the built CSS: exactly the chip's count of tiles is
   displayed, and every row of the bento is full (the tiles on a row span the grid's width). */
const FILTER = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(800);
  const out = [];
  for (const chip of document.querySelectorAll('#gfilter .fchip')) {
    chip.click();
    await sleep(250);
    const grid = document.querySelector('#mock-sites ~ .sgrid');
    /* Layout boxes (offset*), not painted ones: a tile the filter brings in rises into place with a transform. */
    const gw = grid.clientWidth;
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    const shown = [...grid.children].filter((t) => getComputedStyle(t).display !== 'none' && t.offsetHeight > 0);
    const rows = new Map();
    for (const t of shown) rows.set(t.offsetTop, (rows.get(t.offsetTop) ?? -gap) + t.offsetWidth + gap);
    const short = [...rows.values()].filter((w) => Math.abs(w - gw) > 2).length;
    out.push({ f: chip.dataset.f, want: Number(chip.querySelector('.cnt').textContent), shown: shown.length, short, said: document.querySelector('#gfilter-status')?.textContent ?? null });
  }
  return JSON.stringify(out);
})()`;

for (const width of [1440, 800, 375]) {
  test(`every filter chip displays exactly its tiles, with no hole in the bento (${width}px)`, { timeout: 60000 }, async () => {
    const page = await run.page({ width, height: 900 });
    await page.goto('/gallery');
    const r = JSON.parse(await page.evaluate(FILTER));
    await page.close();
    assert.equal(r.length, 10);
    for (const x of r) {
      assert.equal(x.shown, x.want, `${x.f}: ${x.shown} tiles displayed, the chip says ${x.want}`);
      assert.equal(x.short, 0, `${x.f}: ${x.short} rows with a hole`);
      assert.equal(x.said, `${x.want} ${x.want === 1 ? 'example' : 'examples'}`, `${x.f}: announced`);
    }
  });
}
