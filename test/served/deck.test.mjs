// The deck template (templates/deck.html, issue 198), served from out/ the way Vercel serves it,
// and as `verseva add deck` writes it, opened from file://. One slide on screen at a time, moved
// by the arrow keys and by a swipe; print gives one slide per page; with scripting off every
// slide is on the page as a plain scroll; the added file links no stylesheet and still renders
// on the signature. Runs after `npm run studio:build && npm run assemble` (npm run test:served).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { start, root } from './chrome.mjs';

const SLIDES = 8;
const URL_PATH = '/templates/deck.html';

let run;
let added;
before(async () => {
  run = await start();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsv-deck-'));
  execFileSync(process.execPath, [path.join(root, 'bin/verseva.mjs'), 'add', 'deck', '--dir', 'out'], { cwd: dir, encoding: 'utf8' });
  added = path.join(dir, 'out', 'deck.html');
});
after(async () => { await run?.stop(); });

/* Where the deck stands: slide count, the one on screen, the counter and the hash. */
const STATE = `(() => {
  const slides = [...document.querySelectorAll('.deck-slide')];
  const on = slides.map((s, i) => [i, s]).filter(([, s]) => s.classList.contains('deck-on') && getComputedStyle(s).visibility === 'visible').map(([i]) => i);
  return { n: slides.length, on, count: document.querySelector('.deck-count')?.textContent ?? null, hash: location.hash };
})()`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (p, k, code, keyCode) => {
  await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: keyCode });
  await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: keyCode });
  await wait(60);
};
const swipe = async (p, from, to) => {
  await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y: 360 }] });
  for (const x of [from + (to - from) / 3, from + (2 * (to - from)) / 3, to]) await p.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 362 }] });
  await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(60);
};

test(`the served deck has ${SLIDES} slides and shows exactly the first one`, async () => {
  const p = await run.page({ width: 1280, height: 720 });
  try {
    await p.goto(URL_PATH);
    const s = await p.evaluate(STATE);
    assert.equal(s.n, SLIDES);
    assert.deepEqual(s.on, [0]);
    assert.equal(s.count, `1 / ${SLIDES}`);
  } finally { await p.close(); }
});

test('the arrow keys, Home and End move one slide at a time and keep the hash in step', async () => {
  const p = await run.page({ width: 1280, height: 720 });
  try {
    await p.goto(URL_PATH);
    await key(p, 'ArrowRight', 'ArrowRight', 39);
    await key(p, 'ArrowRight', 'ArrowRight', 39);
    let s = await p.evaluate(STATE);
    assert.deepEqual(s.on, [2]);
    assert.equal(s.count, `3 / ${SLIDES}`);
    assert.equal(s.hash, '#3');
    await key(p, 'ArrowLeft', 'ArrowLeft', 37);
    assert.deepEqual((await p.evaluate(STATE)).on, [1]);
    await key(p, 'End', 'End', 35);
    s = await p.evaluate(STATE);
    assert.deepEqual(s.on, [SLIDES - 1]);
    await key(p, 'ArrowRight', 'ArrowRight', 39);
    assert.deepEqual((await p.evaluate(STATE)).on, [SLIDES - 1], 'the last slide holds');
    await key(p, 'Home', 'Home', 36);
    assert.deepEqual((await p.evaluate(STATE)).on, [0]);
  } finally { await p.close(); }
});

test('a hash opens the deck on that slide', async () => {
  const p = await run.page({ width: 1280, height: 720 });
  try {
    await p.goto(`${URL_PATH}#4`);
    assert.deepEqual((await p.evaluate(STATE)).on, [3]);
  } finally { await p.close(); }
});

test('a swipe left moves forward, a swipe right moves back, a short drag does nothing', async () => {
  const p = await run.page({ width: 1280, height: 720, touch: true });
  try {
    await p.goto(URL_PATH);
    await swipe(p, 1000, 300);
    assert.deepEqual((await p.evaluate(STATE)).on, [1]);
    await swipe(p, 1000, 300);
    assert.deepEqual((await p.evaluate(STATE)).on, [2]);
    await swipe(p, 300, 1000);
    assert.deepEqual((await p.evaluate(STATE)).on, [1]);
    await swipe(p, 640, 620);
    assert.deepEqual((await p.evaluate(STATE)).on, [1]);
  } finally { await p.close(); }
});

test('print gives one slide per page, every slide included', async () => {
  const p = await run.page({ width: 1280, height: 720 });
  try {
    await p.goto(`${URL_PATH}#3`);
    const { data } = await p.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
    const pdf = Buffer.from(data, 'base64').toString('latin1');
    const pages = pdf.match(/\/Type\s*\/Page(?![s\w])/g) ?? [];
    assert.equal(pages.length, SLIDES, `${pages.length} PDF pages for ${SLIDES} slides`);
  } finally { await p.close(); }
});

test('with scripting off every slide is on the page, in order, as a plain scroll, with its title and support line', async () => {
  const p = await run.page({ width: 1280, height: 720, scripts: false });
  try {
    await p.goto(URL_PATH);
    const r = await p.evaluate(`(() => {
      const slides = [...document.querySelectorAll('.deck-slide')];
      const boxes = slides.map((s) => { const b = s.getBoundingClientRect(); const cs = getComputedStyle(s); return { top: b.top + scrollY, h: b.height, w: b.width, vis: cs.visibility, op: Number(cs.opacity), title: s.querySelector('h1, h2')?.textContent.trim() ?? '', sub: s.querySelector('.deck-sub')?.textContent.trim() ?? '' }; });
      return { paged: document.documentElement.classList.contains('deck-paged'), boxes, scrollH: document.documentElement.scrollHeight, ctl: getComputedStyle(document.querySelector('.deck-ctl')).display };
    })()`);
    assert.equal(r.paged, false, 'the page script did not run');
    assert.equal(r.boxes.length, SLIDES);
    for (const [i, b] of r.boxes.entries()) {
      assert.ok(b.h > 200 && b.w > 600, `slide ${i + 1} has a visible box (${b.w}x${b.h})`);
      assert.equal(b.vis, 'visible', `slide ${i + 1} visible`);
      assert.equal(b.op, 1, `slide ${i + 1} opaque`);
      assert.ok(b.title.length > 0 && b.sub.length > 0, `slide ${i + 1} has its title and support line`);
      if (i) assert.ok(b.top >= r.boxes[i - 1].top + r.boxes[i - 1].h - 1, `slide ${i + 1} sits below slide ${i}`);
    }
    assert.ok(r.scrollH > 720 * (SLIDES - 1), 'the slides stack into one scroll');
    assert.equal(r.ctl, 'none', 'no dead controls without the script');
  } finally { await p.close(); }
});

test('the sources sit behind a closed control on every slide that has them', async () => {
  const p = await run.page({ width: 1280, height: 720 });
  try {
    await p.goto(URL_PATH);
    const r = await p.evaluate(`[...document.querySelectorAll('.deck-src')].map((d) => ({ tag: d.localName, open: d.open, summary: d.querySelector('summary')?.textContent.trim(), items: d.querySelectorAll('li').length }))`);
    assert.ok(r.length >= 3, `${r.length} slides carry sources`);
    for (const d of r) {
      assert.equal(d.tag, 'details');
      assert.equal(d.open, false);
      assert.equal(d.summary, 'Sources');
      assert.ok(d.items > 0);
    }
  } finally { await p.close(); }
});

test('the verseva add deck output links no stylesheet, opens from file:// and renders on the signature', async () => {
  const html = fs.readFileSync(added, 'utf8');
  assert.doesNotMatch(html, /<link\b[^>]*rel=["']?stylesheet/i);
  assert.doesNotMatch(html, /@import/);
  const p = await run.page({ width: 1280, height: 720 });
  try {
    await p.goto(pathToFileURL(added).href);
    const r = await p.evaluate(`(() => {
      const probe = document.createElement('button');
      probe.className = 'ibtn';
      document.body.append(probe);
      const w = getComputedStyle(probe).width;
      probe.remove();
      return {
        scheme: location.protocol,
        sheets: [...document.styleSheets].map((s) => s.href),
        accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
        bg: getComputedStyle(document.body).backgroundColor,
        ibtn: w,
      };
    })()`);
    assert.equal(r.scheme, 'file:');
    assert.ok(r.sheets.length >= 2 && r.sheets.every((h) => h === null), `inline sheets only: ${JSON.stringify(r.sheets)}`);
    assert.ok(r.accent.length > 0, 'tokens.css is inlined');
    assert.notEqual(r.bg, 'rgba(0, 0, 0, 0)');
    assert.equal(r.ibtn, '32px', 'components.css is inlined');
    assert.equal((await p.evaluate(STATE)).n, SLIDES);
    await key(p, 'ArrowRight', 'ArrowRight', 39);
    assert.deepEqual((await p.evaluate(STATE)).on, [1]);
  } finally { await p.close(); }
});
