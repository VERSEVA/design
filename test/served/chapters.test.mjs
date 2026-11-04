// The tiled chapters in headless Chrome over out/ (chrome.mjs). Data viz keeps law 3 the way a
// product must: one focus tile (Line + area) spends the data accent, every other chart is on the
// text ladder, and nothing else in the page spends it (the shell's active nav aside), in both modes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';
import { ACCENT } from './accent.mjs';

let run;
before(async () => { run = await start(); });
after(async () => { await run?.stop(); });

for (const scheme of ['dark', 'light']) for (const width of [1440, 375]) {
  test(`/data-viz spends the accent on the focus tile and the active nav only (${width}px, ${scheme})`, { timeout: 60000 }, async () => {
    const page = await run.page({ width, height: 900, scheme });
    await page.goto('/data-viz');
    const uses = JSON.parse(await page.evaluate(ACCENT()));
    await page.close();
    assert.deepEqual(uses.filter((u) => u.startsWith('focus widget ')), ['focus widget lines'], uses.join('\n'));
    assert.deepEqual(uses.filter((u) => u.startsWith('main ')), [], uses.join('\n'));
    const shell = uses.filter((u) => u.startsWith('shell '));
    assert.ok(shell.length <= 1 && shell.every((u) => /aria-current|active|Data viz/.test(u)), shell.join(', '));
  });
}

/* Computed contrast on /data-viz (law 3 recipes are dialed, so the marks pass too): every chart mark and
   category swatch at least 3:1 against the surface it sits on, every label on a mark at least 4.5:1
   against the mark. Level-0 intensity cells and their legend swatch are the empty level (no data), the
   same as a blank cell, so they are not marks. Colours are composited over the surface before measuring. */
const CONTRAST = `(async () => {
  await new Promise((r) => setTimeout(r, 1500));
  document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
  const probe = document.createElement('i'); document.body.appendChild(probe);
  const parse = (s) => {
    let m = s.match(/rgba?\\(([^)]*)\\)/);
    if (m) { const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] ?? 1]; }
    m = s.match(/color\\(srgb ([^)]*)\\)/);
    if (m) { const v = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [v[0] * 255, v[1] * 255, v[2] * 255, v[3] ?? 1]; }
    return null;
  };
  const resolve = (v) => { probe.style.backgroundColor = v; return parse(getComputedStyle(probe).backgroundColor); };
  const over = (c, bg) => [0, 1, 2].map((i) => c[i] * c[3] + bg[i] * (1 - c[3])).concat(1);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const surfaceOf = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (p.classList.contains('wtile')) break;
      const c = parse(getComputedStyle(p).backgroundColor);
      if (c && c[3] > 0.5) return over(c, resolve('var(--surface)'));
    }
    return resolve('var(--surface)');
  };
  const MARKS = '.bar .fill, .stackcol i, .vizlegend i, .hbar .htrack i, .actstrip i[data-l]:not([data-l="0"]), .actcal i[data-l]:not([data-l="0"]), .srcdot i, .stat .microbar i, .ring .ringfill';
  const bad = [];
  let marks = 0, labels = 0;
  for (const el of document.querySelectorAll('[data-chapter="data-viz"] ' + MARKS)) {
    if (el.matches('.vizlegend i[data-l="0"]') || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    const fill = parse(el instanceof SVGElement ? cs.stroke : cs.backgroundColor);
    if (!fill) { bad.push('no colour: ' + el.outerHTML.slice(0, 60)); continue; }
    const surf = surfaceOf(el);
    const mark = over(fill, surf);
    const tile = el.closest('section.stile').id;
    marks++;
    const r = ratio(mark, surf);
    if (r < 3) bad.push(tile + ' mark ' + el.outerHTML.slice(0, 50) + ' ' + r.toFixed(2) + ':1');
    if (!(el instanceof SVGElement) && el.textContent.trim()) {
      labels++;
      const lr = ratio(over(parse(cs.color), mark), mark);
      if (lr < 4.5) bad.push(tile + ' label "' + el.textContent.trim() + '" ' + lr.toFixed(2) + ':1');
    }
  }
  /* The bar rungs stay monotonic: a higher rung is further from the surface. */
  const rungs = [1, 2, 3].map((l) => { const el = document.querySelector('#bars .fill[data-l="' + l + '"]'); const s = surfaceOf(el); return ratio(over(parse(getComputedStyle(el).backgroundColor), s), s); });
  if (!(rungs[0] < rungs[1] && rungs[1] < rungs[2])) bad.push('bar rungs not monotonic: ' + rungs.map((r) => r.toFixed(2)).join(' < '));
  probe.remove();
  return JSON.stringify({ marks, labels, bad });
})()`;

for (const scheme of ['dark', 'light']) {
  test(`/data-viz chart marks clear 3:1 on their surface and labels on marks 4.5:1 (${scheme})`, { timeout: 60000 }, async () => {
    const page = await run.page({ width: 1440, height: 900, scheme });
    await page.goto('/data-viz');
    const r = JSON.parse(await page.evaluate(CONTRAST));
    await page.close();
    assert.ok(r.marks > 40 && r.labels >= 9, `saw ${r.marks} marks, ${r.labels} labels`);
    assert.deepEqual(r.bad, []);
  });
}
