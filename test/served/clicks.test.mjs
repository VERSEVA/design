// Clicks over out/ in headless Chrome (chrome.mjs), at 375px in light: on every route, every
// in-site anchor that names a studio path must be routed by the studio (its click
// default-prevented), never left to the browser, which would full-reload the page. Files
// (a path with an extension), new-tab, download and other-site links stay native. A planted
// plain anchor proves the probe can fail. Also: the /widgets console specimen shows its
// .navshell below 900px, and the legacy /code.html?f= link lands on a clean code URL.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { routes, start } from './chrome.mjs';

let run;
before(async () => { run = await start(); });
after(async () => { await run?.stop(); });

/* Clicks every anchor in the studio root with pushState recorded instead of applied, so the
   page under test never changes; returns the anchors whose click the browser would have
   followed to another studio path, i.e. a full reload. */
const CLICKS = (plant) => `(async () => {
  await new Promise((r) => setTimeout(r, 800));
  const root = document.getElementById('studio-root');
  if (${plant ? 'true' : 'false'}) root.querySelector('.studio-main').insertAdjacentHTML('afterbegin', '<a id="planted" href="/foundations">planted</a>');
  const pushed = [];
  history.pushState = (s, t, u) => { pushed.push(String(u)); };
  let last = null;
  addEventListener('click', (e) => { last = e.defaultPrevented; e.preventDefault(); });
  const here = location.pathname + location.search;
  const reloads = [];
  let routed = 0, checked = 0;
  for (const a of [...root.querySelectorAll('a[href]')]) {
    if (!a.isConnected) continue;
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.origin !== location.origin || (a.target && a.target !== '_self') || a.hasAttribute('download')) continue;
    if (/\\.[\\w-]+$/.test(url.pathname.split('/').pop())) continue;
    checked++;
    last = null;
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, view: window }));
    if (last === true) { routed++; continue; }
    if (url.pathname + url.search !== here) reloads.push((a.id ? '#' + a.id + ' ' : '') + (a.className ? '.' + String(a.className).split(' ').join('.') + ' ' : '') + a.getAttribute('href'));
  }
  return JSON.stringify({ studio: !!root.querySelector('.studio'), checked, routed, pushed: pushed.length, reloads });
})()`;

test('no in-site anchor on any route full-reloads the page (375px, light)', { timeout: 240000 }, async () => {
  const page = await run.page({ width: 375, scheme: 'light' });
  const bad = [];
  let total = 0;
  for (const r of routes) {
    await page.goto(r.path);
    const res = JSON.parse(await page.evaluate(CLICKS(false)));
    if (!res.studio) bad.push(`${r.path}: not the studio shell`);
    total += res.checked;
    for (const a of res.reloads) bad.push(`${r.path}: ${a} reloads the page`);
  }
  await page.close();
  assert.ok(total > routes.length * 5, `only ${total} in-site anchors clicked`);
  assert.deepEqual(bad, []);
});

test('the click probe is not vacuous: a plain anchor to a studio path fails it', { timeout: 60000 }, async () => {
  const page = await run.page({ width: 375, scheme: 'light' });
  await page.goto('/components');
  const res = JSON.parse(await page.evaluate(CLICKS(true)));
  await page.close();
  assert.deepEqual(res.reloads, ['#planted /foundations']);
  assert.ok(res.routed > 0 && res.pushed > 0, 'routed anchors push history through the router');
});

const NAVSHELL = `(async () => {
  await new Promise((r) => setTimeout(r, 800));
  const n = document.querySelector('.wx-console > .navshell');
  if (!n) return JSON.stringify({ found: false });
  const r = n.getBoundingClientRect();
  return JSON.stringify({ found: true, display: getComputedStyle(n).display, width: Math.round(r.width), tabs: n.querySelectorAll('.tab').length });
})()`;

for (const [width, shown] of [[375, true], [800, true], [1280, false]]) {
  test(`/widgets console specimen ${shown ? 'shows' : 'hides'} its .navshell at ${width}px`, { timeout: 60000 }, async () => {
    const page = await run.page({ width, scheme: 'light' });
    await page.goto('/widgets');
    const n = JSON.parse(await page.evaluate(NAVSHELL));
    await page.close();
    assert.ok(n.found, 'no .navshell in the console specimen');
    if (shown) { assert.equal(n.display, 'flex'); assert.ok(n.width > 200, `navshell is ${n.width}px wide`); assert.equal(n.tabs, 4); }
    else assert.equal(n.display, 'none');
  });
}

test('/code.html?f=examples/pulse.html lands on /gallery/pulse/code with no query', { timeout: 60000 }, async () => {
  const page = await run.page({ width: 375, scheme: 'light' });
  await page.goto('/code.html?f=examples/pulse.html');
  const r = JSON.parse(await page.evaluate(`(async () => { await new Promise((r) => setTimeout(r, 800)); return JSON.stringify({ at: location.pathname + location.search + location.hash, studio: !!document.querySelector('#studio-root .studio') }); })()`));
  await page.close();
  assert.deepEqual(r, { at: '/gallery/pulse/code', studio: true });
});
