// The home route (1.7.0) in headless Chrome over out/ (chrome.mjs): the law 3 accent budget,
// the hero's motion (running, then stopped by Pause motion and by reduced motion, and only ever
// transform or opacity), Get started (copy, Copied, the install section), and the 375px fold.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';
import { ACCENT } from './accent.mjs';

const sleep = 'const sleep = (ms) => new Promise((r) => setTimeout(r, ms));';

/* A page that spends the accent twice outside any focus widget, so the counter must see it. */
const PLANTED = '<!doctype html><link rel="stylesheet" href="/tokens.css"><div id="studio-root"><main class="studio-main"><span style="color:var(--accent)">one</span><b style="background:var(--accent)">two</b></main></div>';

let run;
before(async () => { run = await start({ extra: { '/__probe/accent': PLANTED } }); });
after(async () => { await run?.stop(); });

for (const [width, height] of [[1440, 900], [375, 812]]) for (const scheme of ['dark', 'light']) {
  test(`/ spends the accent on Get started, the active nav and one focus widget only (${width}px, ${scheme})`, { timeout: 60000 }, async () => {
    const page = await run.page({ width, height, scheme });
    await page.goto('/');
    const uses = JSON.parse(await page.evaluate(ACCENT()));
    await page.close();
    const main = uses.filter((u) => u.startsWith('main '));
    const shell = uses.filter((u) => u.startsWith('shell '));
    const focus = uses.filter((u) => u.startsWith('focus widget '));
    assert.deepEqual(main.map((u) => u.replace(/^main a\.[^ ]+ /, '')), ['"Get started"'], uses.join('\n'));
    assert.ok(main[0].includes('btn-primary'), main[0]);
    assert.ok(shell.length <= 1, `shell spends ${shell.length}: ${shell.join(', ')}`);
    assert.ok(shell.every((u) => /aria-current|active|Overview/.test(u)), shell.join(', '));
    assert.deepEqual(focus, ['focus widget revenue']);
  });
}

for (const scheme of ['dark', 'light']) {
  test(`/ keeps the budget with the job panel open, focus on its first control (1440px, ${scheme})`, { timeout: 60000 }, async () => {
    const page = await run.page({ width: 1440, height: 900, scheme });
    await page.goto('/');
    const uses = JSON.parse(await page.evaluate(ACCENT(true)));
    await page.close();
    assert.deepEqual(uses.filter((u) => u.startsWith('main ')).map((u) => u.replace(/^main a\.[^ ]+ /, '')), ['"Get started"'], uses.join('\n'));
    assert.deepEqual(uses.filter((u) => u.startsWith('focus widget ')), ['focus widget revenue']);
    assert.ok(uses.filter((u) => u.startsWith('shell ')).length <= 1, uses.join('\n'));
  });
}

test('the accent counter sees a planted spend', { timeout: 60000 }, async () => {
  const page = await run.page({ width: 375 });
  await page.goto('/__probe/accent');
  const uses = JSON.parse(await page.evaluate(ACCENT()));
  await page.close();
  assert.equal(uses.filter((u) => u.startsWith('main ')).length, 2, uses.join('\n'));
});

/* The hero's animations: names, play states, animated properties; the job's percent over 1.5s. */
const MOTION = (pause) => `(async () => {
  ${sleep}
  await sleep(1500);
  if (${pause ? 'true' : 'false'}) { document.querySelector('button[aria-label="Pause motion"]').click(); await sleep(400); }
  const hero = document.querySelector('.front .hero');
  const anims = hero.getAnimations({ subtree: true }).filter((a) => a.animationName);
  const props = [...new Set(anims.flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k))))].filter((k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k));
  const pct = () => document.querySelector('.hero-live .lact-pc')?.textContent ?? '';
  const a = pct();
  await sleep(1500);
  return JSON.stringify({ live: hero.hasAttribute('data-live'), names: [...new Set(anims.map((x) => x.animationName))].sort(), running: anims.filter((x) => x.playState === 'running').map((x) => x.animationName), props, moved: pct() !== a, pressed: document.querySelector('button[aria-label="Pause motion"]').getAttribute('aria-pressed') });
})()`;

test('the hero moves on its own: sweep, drift, a ticking job; transform and opacity only', { timeout: 60000 }, async () => {
  const page = await run.page({ width: 1440, height: 900 });
  await page.goto('/');
  const r = JSON.parse(await page.evaluate(MOTION(false)));
  await page.close();
  assert.equal(r.live, true);
  for (const n of ['fd-drift-a', 'fd-drift-b', 'fd-sweep']) assert.ok(r.running.includes(n), `${n} not running: ${JSON.stringify(r)}`);
  assert.deepEqual(r.props.filter((p) => p !== 'transform' && p !== 'opacity'), [], `animates ${r.props}`);
  assert.equal(r.moved, true, 'the demo job did not tick');
});

test('Pause motion stops the sweep, the drift and the job', { timeout: 60000 }, async () => {
  const page = await run.page({ width: 1440, height: 900 });
  await page.goto('/');
  const r = JSON.parse(await page.evaluate(MOTION(true)));
  await page.close();
  assert.equal(r.pressed, 'true');
  assert.equal(r.live, false);
  assert.deepEqual(r.running, [], JSON.stringify(r));
  assert.equal(r.moved, false, 'the demo job ticked while paused');
});

test('reduced motion: the hero starts and stays still', { timeout: 60000 }, async () => {
  const page = await run.page({ width: 1440, height: 900, reducedMotion: true });
  await page.goto('/');
  const r = JSON.parse(await page.evaluate(MOTION(false)));
  await page.close();
  assert.equal(r.live, false);
  assert.deepEqual(r.running, [], JSON.stringify(r));
  assert.equal(r.moved, false, 'the demo job ticked under reduced motion');
});

const CTA = (deny = false) => `(async () => {
  ${sleep}
  await sleep(800);
  let copied = null;
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { copied = t; return ${deny} ? Promise.reject(new DOMException('denied', 'NotAllowedError')) : Promise.resolve(); } }, configurable: true });
  const go = [...document.querySelectorAll('.studio-main a')].find((a) => a.textContent.trim() === 'Get started');
  go.click();
  await sleep(50);
  const label = go.textContent.trim();
  const stayed = location.pathname;
  await sleep(1400);
  return JSON.stringify({ copied, label, stayed, landed: location.pathname + location.hash, install: !!document.getElementById('install'), focused: document.activeElement?.id ?? '', h1: document.querySelector('h1')?.textContent });
})()`;

test('Get started copies the install line, says Copied, then lands on /components#install', { timeout: 60000 }, async () => {
  const page = await run.page({ width: 1440, height: 900 });
  await page.goto('/');
  const r = JSON.parse(await page.evaluate(CTA()));
  await page.close();
  assert.deepEqual(r, { copied: 'npm i @verseva/design', label: 'Copied', stayed: '/', landed: '/components#install', install: true, focused: 'install', h1: 'Components' });
});

test('clipboard denied: Get started says Command below, never Copied, and still lands focused on #install', { timeout: 60000 }, async () => {
  const page = await run.page({ width: 1440, height: 900 });
  await page.goto('/');
  const r = JSON.parse(await page.evaluate(CTA(true)));
  await page.close();
  assert.deepEqual(r, { copied: 'npm i @verseva/design', label: 'Command below', stayed: '/', landed: '/components#install', install: true, focused: 'install', h1: 'Components' });
});

const FOLD = `(async () => {
  ${sleep}
  await sleep(1200);
  const go = [...document.querySelectorAll('.studio-main a')].find((a) => a.textContent.trim() === 'Get started');
  const browse = [...document.querySelectorAll('.studio-main a')].find((a) => a.textContent.trim() === 'Browse');
  const tiles = [...document.querySelectorAll('.hero-live .wtile')].filter((t) => t.getClientRects().length).length;
  return JSON.stringify({ go: go.getBoundingClientRect().bottom, browse: browse.getBoundingClientRect().bottom, vh: innerHeight, tiles });
})()`;

test('Get started and Browse sit above the fold at 375px; the live home drops to two tiles', { timeout: 60000 }, async () => {
  for (const [w, h] of [[375, 667], [375, 812], [360, 640]]) {
    const page = await run.page({ width: w, height: h });
    await page.goto('/');
    const r = JSON.parse(await page.evaluate(FOLD));
    await page.close();
    assert.ok(r.go <= r.vh && r.browse <= r.vh, `${w}x${h}: CTA bottom ${r.go}/${r.browse} past ${r.vh}`);
    assert.equal(r.tiles, 2, `${w}x${h}`);
  }
  const page = await run.page({ width: 1440, height: 900 });
  await page.goto('/');
  const r = JSON.parse(await page.evaluate(FOLD));
  await page.close();
  assert.equal(r.tiles, 3);
});
