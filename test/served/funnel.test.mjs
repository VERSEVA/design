// The step funnel on /data-viz (#funnel): five panel states and the M and L widget tiles, measured in a
// real browser at 375, 768 and 1280px in both schemes. Nothing in a row is clipped or cut: every cell sits
// inside its row, every row inside its panel or tile body, no text overflows its box, and the tile runs
// past neither its own box nor the viewport.
// Runs after `npm run studio:build && npm run assemble` (npm run test:served).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';

let run;
before(async () => { run = await start(); });
after(async () => { await run?.stop(); });

const PROBE = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(1200);
  document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
  await sleep(200);
  const tile = document.querySelector('#funnel');
  if (!tile) return JSON.stringify({ tile: false });
  const bad = [];
  const inside = (a, b, slack = 0.5) => a.left >= b.left - slack && a.right <= b.right + slack && a.top >= b.top - slack && a.bottom <= b.bottom + slack;
  const name = (el) => (el.closest('.wtile[data-size]:not(.stile)') ? 'tile ' + el.closest('.wtile').dataset.size : 'panel') + ' ' + (el.closest('li')?.querySelector('.hlabel')?.textContent ?? '') + ' .' + (el.className || el.localName);
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const lists = [...tile.querySelectorAll('ol.funnel')];
  for (const ol of lists) {
    const box = (ol.closest('.wtile-body') ?? ol.closest('.bd')).getBoundingClientRect();
    for (const li of ol.children) {
      if (!shown(li)) continue;
      const lr = li.getBoundingClientRect();
      if (!inside(lr, box)) bad.push(name(li) + ' row outside its body');
      for (const cell of li.children) {
        if (!shown(cell)) continue;
        const cr = cell.getBoundingClientRect();
        if (cr.width > 0 && !inside(cr, lr)) bad.push(name(cell) + ' outside its row');
        if (cell.scrollWidth > cell.clientWidth + 1 && !cell.classList.contains('htrack')) bad.push(name(cell) + ' text overflows ' + cell.scrollWidth + '>' + cell.clientWidth);
      }
      const chip = li.querySelector('.badge');
      if (chip && !inside(chip.getBoundingClientRect(), lr)) bad.push(name(chip) + ' chip outside its row');
    }
  }
  /* Every studio funnel sits inside a .wtile (the specimen tile is one), so the forms a funnel takes outside
     a tile are measured on clones: the normal panel list at a phone panel's 343px (under 26rem: the track on
     its own line, kept) and at 30rem (26 to 34rem: the two-line form with the share). */
  const loose = [];
  for (const w of ['343px', '30rem']) {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:0;top:0;width:' + w;
    host.appendChild(tile.querySelector('.fpanels ol.funnel[data-share]').cloneNode(true));
    document.body.appendChild(host);
    const li = host.querySelectorAll('li.hbar')[1];
    const lr = li.getBoundingClientRect();
    const cells = [...li.children].filter(shown);
    const track = li.querySelector('.htrack').getBoundingClientRect();
    loose.push({
      w,
      head: shown(host.querySelector('.funnel-head')),
      share: shown(li.querySelector('.funnel-share')),
      track: shown(li.querySelector('.htrack')) && track.width > 0,
      ownLine: track.top >= li.querySelector('.hlabel').getBoundingClientRect().bottom - 0.5,
      clipped: cells.filter((c) => !inside(c.getBoundingClientRect(), lr) || (c.scrollWidth > c.clientWidth + 1 && !c.classList.contains('htrack'))).map((c) => c.className),
    });
    host.remove();
  }
  /* The panels keep a track on every step at every width, even inside the specimen tile. */
  const panelTracks = [...tile.querySelectorAll('.fpanels ol.funnel > li.hbar')]
    .filter((li) => !li.querySelector('.skel')).map((li) => shown(li.querySelector('.htrack')) && li.querySelector('.htrack').getBoundingClientRect().width > 0);
  /* A large tile uses its height: the steps spread evenly, so the last one ends in the bottom fifth of the body. */
  const fill = [...tile.querySelectorAll('.wtile[data-size="l"] > .wtile-body')].map((b) => {
    const cs = getComputedStyle(b);
    const top = b.getBoundingClientRect().top + parseFloat(cs.paddingTop);
    const bottom = b.getBoundingClientRect().bottom - parseFloat(cs.paddingBottom);
    const last = [...b.querySelectorAll('ol.funnel > li')].pop().getBoundingClientRect().bottom;
    return Math.round(((last - top) / (bottom - top)) * 100) / 100;
  });
  const chip = tile.querySelector('.funnel-drop[data-biggest] .badge');
  const tracks = [...tile.querySelectorAll('.wtile[data-size="m"] ol.funnel .htrack')].filter(shown).length;
  return JSON.stringify({
    tile: true, bad, lists: lists.length,
    rows: tile.querySelectorAll('ol.funnel > li.hbar').length,
    sideways: Math.max(tile.scrollWidth - tile.clientWidth, Math.round(tile.getBoundingClientRect().right - document.documentElement.clientWidth)),
    chipColor: chip && getComputedStyle(chip).color,
    tracks, loose, panelTracks, fill,
  });
})()`;

for (const width of [375, 768, 1280]) {
  for (const scheme of ['dark', 'light']) {
    test(`step funnel at ${width}px (${scheme}): no cell clipped in the panel or the M and L tiles`, { timeout: 120000 }, async () => {
      const page = await run.page({ width, height: 900, scheme });
      await page.goto('/data-viz');
      const r = JSON.parse(await page.evaluate(PROBE));
      assert.ok(r.tile, 'the #funnel tile is on /data-viz');
      /* five panels (one empty, so four lists) and seven tiles (one empty, so six lists) */
      assert.equal(r.lists, 10);
      assert.deepEqual(r.bad, []);
      assert.ok(r.sideways <= 0, `the funnel tile runs ${r.sideways}px past its box or the viewport`);
      /* the M tiles keep their tracks from tablet up; a phone tile drops them (the ported 26rem rule) */
      if (width >= 768) assert.ok(r.tracks > 0, 'M tiles draw their tracks');
      else assert.equal(r.tracks, 0);
      assert.ok(r.chipColor, 'the biggest drop carries its chip');
      assert.ok(r.panelTracks.length >= 11 && r.panelTracks.every(Boolean), `panel tracks: ${JSON.stringify(r.panelTracks)}`);
      /* two rows of height above a phone; on a phone an L tile shows its M view in one row */
      if (width >= 768) assert.ok(r.fill.every((f) => f >= 0.8 && f <= 1.001), `large tile fill ${JSON.stringify(r.fill)}`);
      console.log(`fill ${width} ${scheme}: ${JSON.stringify(r.fill)}`);
      assert.deepEqual(r.loose, [
        { w: '343px', head: false, share: false, track: true, ownLine: true, clipped: [] },
        { w: '30rem', head: false, share: true, track: true, ownLine: true, clipped: [] },
      ]);
      await page.close();
    });
  }
}
