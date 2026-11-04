// The side nav stays put while the page scrolls, expanded and collapsed to the rail: at 1280
// in headless Chrome (chrome.mjs), /components scrolled to its end, the sidebar's top sits at
// the header's bottom, it fills the viewport below the header, and its collapse toggle is in
// view. A long nav scrolls inside the sidebar, never with the page.
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
  scrollTo(0, document.documentElement.scrollHeight);
  await sleep(600);
  const head = document.querySelector('.studio-head').getBoundingClientRect();
  const side = document.querySelector('.studio-side').getBoundingClientRect();
  const view = document.querySelector(document.documentElement.dataset.rail === 'collapsed' ? '.side-rail' : '.side-full');
  const toggle = view.querySelector('.collapse-row').getBoundingClientRect();
  return JSON.stringify({ scrollY, max: document.documentElement.scrollHeight - innerHeight, vh: innerHeight, headBottom: head.bottom, sideTop: side.top, sideBottom: side.bottom, toggleTop: toggle.top, toggleBottom: toggle.bottom, rail: document.documentElement.dataset.rail || 'expanded' });
})()`;

for (const state of ['expanded', 'collapsed']) {
  test(`the ${state} side nav stays fixed while /components scrolls to its end at 1280`, { timeout: 120000 }, async () => {
    const page = await run.page({ width: 1280, height: 800 });
    await page.goto('/components');
    await page.evaluate(`(() => { localStorage.clear(); ${state === 'collapsed' ? "localStorage.setItem('verseva-rail', '1');" : ''} location.reload(); return 1; })()`);
    await new Promise((r) => setTimeout(r, 1500));
    const r = JSON.parse(await page.evaluate(PROBE));
    await page.close();
    assert.equal(r.rail, state);
    assert.ok(r.scrollY > 2000 && r.scrollY >= r.max - 2, `the page scrolled to its end (${r.scrollY} of ${r.max})`);
    assert.ok(Math.abs(r.sideTop - r.headBottom) <= 1, `sidebar top ${r.sideTop} sits at the header bottom ${r.headBottom}`);
    assert.ok(Math.abs(r.sideBottom - r.vh) <= 1, `sidebar fills to the viewport bottom (${r.sideBottom} of ${r.vh})`);
    assert.ok(r.toggleTop >= r.headBottom && r.toggleBottom <= r.vh, `collapse toggle in view (${r.toggleTop} to ${r.toggleBottom}, viewport ${r.headBottom} to ${r.vh})`);
  });
}
