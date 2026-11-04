// On this page over out/ in headless Chrome (chrome.mjs), at 1440px and 1280px where the rail
// shows: clicking each rail item marks that item (aria-current="location"). Tiles that share a
// bento row share a top, so the scroll-spy must keep the one the reader asked for, not the last
// in the row (PR #28 review: Button marked Field on /components at 1440).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';

/* The pages whose sections are tiles in a bento grid. */
export const RAIL_PAGES = ['/components', '/foundations'];
export const RAIL_WIDTHS = [1440, 1280];

let run;
before(async () => { run = await start(); });
after(async () => { await run?.stop(); });

const RAIL = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frames = (n) => new Promise((r) => { const f = () => (n-- ? requestAnimationFrame(f) : r()); f(); });
  await sleep(1200);
  const links = [...document.querySelectorAll('.pagetoc .toc a')];
  const visible = links.length > 0 && links[0].getClientRects().length > 0;
  const wrong = [];
  for (const a of links) {
    a.click();
    await frames(3);
    await sleep(60);
    const on = document.querySelector('.pagetoc .toc a[aria-current="location"]');
    if (on !== a) wrong.push(a.textContent + ' marked ' + (on ? on.textContent : 'nothing'));
  }
  return JSON.stringify({ count: links.length, visible, wrong });
})()`;

for (const width of RAIL_WIDTHS) {
  test(`every On this page item is marked when clicked, at ${width}px`, { timeout: 180000 }, async () => {
    const page = await run.page({ width, height: 900, scheme: 'dark' });
    const bad = [];
    for (const p of RAIL_PAGES) {
      await page.goto(p);
      const r = JSON.parse(await page.evaluate(RAIL));
      if (!r.visible || r.count === 0) bad.push(`${p}: no visible rail (${r.count} items)`);
      for (const w of r.wrong) bad.push(`${p}: ${w}`);
    }
    assert.deepEqual(bad, []);
  });
}
