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

/* Withheld data (issue 205). A suppressed bar is a short hatched stub: the hatch is the text ladder, so its
   stripes clear 3:1 against the ground they sit on (and against the track fill on a horizontal row); the stub
   is one fixed size, never a bar length; the printed display clears 4.5:1 in the face and size of the numbers
   beside it; nothing is the accent. A gap's band is HTML over the plot with the stub's own 135deg hatch
   at 3:1 (so it cannot stretch with the svg), --s-1 tall, below every drawn mark and inside the plot, and hovering a gap on the live chart names it withheld at
   4.5:1 with no value and no marker. Every colour is composited over the real backdrop:
   each ancestor's background down to the first opaque one. The ratios go to the test log. */
const WITHHELD = `(async () => {
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
  const px = (v) => { probe.style.width = v; return getComputedStyle(probe).width; };
  const over = (c, bg) => [0, 1, 2].map((i) => c[i] * c[3] + bg[i] * (1 - c[3])).concat(1);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  /* What is painted behind el: its ancestors' backgrounds, from the first opaque one up. */
  const ground = (el) => {
    const layers = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      const c = parse(getComputedStyle(p).backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] === 1) break; }
    }
    return layers.reverse().reduce((bg, c) => over(c, bg), resolve('var(--bg)'));
  };
  const accent = resolve('var(--accent)').slice(0, 3).join();
  const root = document.querySelector('[data-chapter="data-viz"]');
  const tile = root.querySelector('#suppressed');
  const out = { stubs: [], labels: [], gaps: [], hover: null, bad: [] };

  for (const el of tile.querySelectorAll('.bar[data-suppressed] .vtrack, .hbar[data-suppressed] .htrack')) {
    const cs = getComputedStyle(el);
    const g = ground(el);
    const own = parse(cs.backgroundColor);
    const fill = over(own, g);
    const hatch = /repeating-linear-gradient\\(135deg/.test(cs.backgroundImage) ? parse(cs.backgroundImage) : null;
    const name = el.className;
    if (!hatch) { out.bad.push(name + ' has no 135deg hatch'); continue; }
    const stripe = over(hatch, fill);
    const box = el.getBoundingClientRect();
    const r = { name, onGround: ratio(stripe, g), onFill: ratio(stripe, fill), w: box.width, h: box.height, stub: name === 'vtrack' ? cs.height : cs.backgroundSize.split(' ')[0] };
    out.stubs.push(r);
    if (r.onGround < 3) out.bad.push(name + ' hatch on ground ' + r.onGround.toFixed(2) + ':1');
    if (r.onFill < 3) out.bad.push(name + ' hatch on its fill ' + r.onFill.toFixed(2) + ':1');
    if (el.children.length) out.bad.push(name + ' holds a fill');
    if (hatch.slice(0, 3).join() === accent) out.bad.push(name + ' spends the accent');
    if (name === 'vtrack') {
      if (cs.height !== px('var(--s-3)')) out.bad.push('vtrack is ' + cs.height + ', not --s-3');
      const fills = [...tile.querySelectorAll('.bar .fill')].map((f) => f.getBoundingClientRect().height).filter((h) => h > 0);
      if (!(box.height < Math.min(...fills))) out.bad.push('vtrack is as tall as a bar: ' + box.height + ' vs ' + fills.join(','));
      const lab = el.previousElementSibling.getBoundingClientRect();
      if (Math.abs(lab.bottom - box.top) > 6) out.bad.push('the display does not sit on the stub');
    } else {
      if (r.stub !== px('var(--s-4)')) out.bad.push('htrack stub is ' + r.stub + ', not --s-4');
      if (cs.backgroundRepeat !== 'no-repeat') out.bad.push('htrack hatch repeats along the track');
      const plain = getComputedStyle(tile.querySelector('.hbar:not([data-suppressed]) .htrack'));
      if (plain.backgroundColor !== cs.backgroundColor || plain.height !== cs.height) out.bad.push('the suppressed track is not the track of its neighbours');
    }
  }
  for (const el of tile.querySelectorAll('[data-suppressed] .vlab, [data-suppressed] .hcount')) {
    const cs = getComputedStyle(el);
    const g = ground(el);
    const r = { name: el.className, text: el.textContent, onGround: ratio(over(parse(cs.color), g), g), size: cs.fontSize, face: cs.fontFamily.split(',')[0].trim() };
    out.labels.push(r);
    if (r.onGround < 4.5) out.bad.push(r.name + ' label ' + r.onGround.toFixed(2) + ':1');
    const plain = getComputedStyle(tile.querySelector(':not([data-suppressed]) > .' + el.className));
    if (plain.fontSize !== cs.fontSize || plain.fontFamily !== cs.fontFamily || plain.color !== cs.color) out.bad.push(r.name + ' label is not set like the numbers beside it');
  }
  if (out.stubs.length === 2) {
    const [v, lab] = [tile.querySelector('.bar[data-suppressed] .vlab'), tile.querySelector('.bar:not([data-suppressed]) .vlab')];
    if (getComputedStyle(v).lineHeight !== getComputedStyle(lab).lineHeight) out.bad.push('display and value sit on different line boxes');
  }

  const gapTile = root.querySelector('#gaps');
  const stubHatch = getComputedStyle(tile.querySelector('.bar[data-suppressed] .vtrack')).backgroundImage;
  for (const el of gapTile.querySelectorAll('i.vizgap')) {
    const cs = getComputedStyle(el);
    const svgEl = el.parentElement.querySelector('svg');
    const g = ground(el);
    const stripe = /repeating-linear-gradient\\(135deg/.test(cs.backgroundImage) ? parse(cs.backgroundImage) : null;
    if (!stripe) { out.bad.push('gap band has no 135deg hatch'); continue; }
    const box = el.getBoundingClientRect(), plot = svgEl.getBoundingClientRect();
    const r = { ratio: ratio(over(stripe, g), g), w: box.width, h: box.height };
    out.gaps.push(r);
    if (r.ratio < 3) out.bad.push('gap band ' + r.ratio.toFixed(2) + ':1');
    if (stripe.slice(0, 3).join() === accent) out.bad.push('gap band spends the accent');
    if (cs.backgroundImage !== stubHatch) out.bad.push('gap band hatch is not the bar stub hatch');
    if (cs.height !== px('var(--s-1)')) out.bad.push('gap band is ' + cs.height + ' tall, not --s-1');
    /* clear of the zero baseline by at least --s-1: the baseline is the custom property the band carries */
    const baseY = plot.top + (plot.height * parseFloat(el.style.getPropertyValue('--vizband-base'))) / 100;
    r.clear = box.top - baseY;
    if (r.clear < parseFloat(px('var(--s-1)')) - 0.5) out.bad.push('gap band is ' + r.clear.toFixed(1) + 'px under the baseline, less than --s-1');
    if (el.closest('svg')) out.bad.push('gap band is inside the stretched svg');
    if (el.getAttribute('aria-hidden') !== 'true' || el.textContent) out.bad.push('gap band is not a silent mark');
    if (box.bottom > plot.bottom + 0.5 || box.left < plot.left - 0.5 || box.right > plot.right + 0.5) out.bad.push('gap band runs out of the plot');
    /* clear of everything drawn: no line or dot of the plot reaches down into the band's row */
    for (const mark of svgEl.querySelectorAll('path[fill="none"], circle')) {
      if (mark.getBoundingClientRect().bottom > box.top + 0.5) out.bad.push('a mark reaches down to the gap band');
    }
  }
  const rows = [...gapTile.querySelectorAll('.vizplot i.vizgap')].map((r) => Math.round(r.getBoundingClientRect().top));
  if (new Set(rows).size > 1) out.bad.push('the two series do not share one band row');

  /* Hover the live chart at W4: Visits is a gap there, Booked is 52. */
  const svg = gapTile.querySelector('.vizplot svg');
  svg.scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 300));
  const box = svg.getBoundingClientRect();
  const at = (i) => box.left + (box.width * (6 + (308 * i) / 7)) / 320;
  svg.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: at(3), clientY: box.top + box.height / 2 }));
  await new Promise((r) => setTimeout(r, 300));
  const tip = gapTile.querySelector('.viztip');
  if (!tip) out.bad.push('no hover readout on the live chart');
  else {
    const rows = [...tip.querySelectorAll('span')];
    const w = tip.querySelector('span[data-withheld]');
    out.hover = { label: tip.querySelector('b').textContent, rows: rows.map((x) => x.textContent), markers: svg.querySelectorAll('circle[r="4"]').length };
    if (w) {
      const g = ground(w);
      out.hover.word = ratio(over(parse(getComputedStyle(w).color), g), g);
      if (out.hover.word < 4.5) out.bad.push('withheld word ' + out.hover.word.toFixed(2) + ':1');
      if (getComputedStyle(w).color !== getComputedStyle(probe).color && getComputedStyle(w).color === getComputedStyle(rows[1]).color) out.bad.push('withheld word is set like a value');
    }
  }
  svg.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }));
  probe.remove();
  return JSON.stringify(out);
})()`;

for (const scheme of ['dark', 'light']) {
  test(`/data-viz withheld data: hatched stubs and gap marks clear 3:1, display and hover word 4.5:1, no accent (${scheme})`, { timeout: 60000 }, async (t) => {
    const page = await run.page({ width: 1440, height: 900, scheme });
    await page.goto('/data-viz');
    const r = JSON.parse(await page.evaluate(WITHHELD));
    await page.close();
    t.diagnostic(`${scheme}: ` + r.stubs.map((x) => `${x.name} hatch ${x.onGround.toFixed(2)}:1 on ground, ${x.onFill.toFixed(2)}:1 on its fill, stub ${x.stub} (box ${Math.round(x.w)}x${Math.round(x.h)})`)
      .concat(r.labels.map((x) => `${x.name} "${x.text}" ${x.onGround.toFixed(2)}:1, ${x.size} ${x.face}`))
      .concat([`gap band ${Math.min(...r.gaps.map((g) => g.ratio)).toFixed(2)}:1, ${r.gaps.map((g) => Math.round(g.w) + 'x' + Math.round(g.h)).join(' ')}, ${Math.min(...r.gaps.map((g) => g.clear)).toFixed(1)}px under the baseline`, `hover word ${r.hover?.word?.toFixed(2)}:1`]).join('; '));
    assert.deepEqual(r.bad, []);
    assert.equal(r.stubs.length, 2, 'one vertical and one horizontal stub');
    assert.equal(r.labels.length, 2);
    assert.equal(r.gaps.length, 3, 'two bands on the chart (three gaps, two touching), one on the sparkline');
    assert.deepEqual(r.hover && { label: r.hover.label, rows: r.hover.rows, markers: r.hover.markers }, { label: 'W4', rows: ['Visits withheld', 'Booked 52'], markers: 1 });
  });
}
