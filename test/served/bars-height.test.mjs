// Issue 214: a bar's fill is a share of the PLOT, not of the bar column with its label rows. Before
// the fix the value and name rows squeezed every tall fill to the same height (42 and 57 both drew
// at 69px). Each pair below is the markup `Bars` renders, served only by this run on the package's
// own tokens.css and components.css, with and without the value row, in both modes; the live
// specimen on /data-viz is measured too. HBars is held to the same rule along its track.
// Runs after `npm run studio:build && npm run assemble` (npm run test:served).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';

const PAIRS = [[42, 57], [10, 90], [64, 70]];
const PAGE = (theme) => `/__probe/bars-height-${theme}`;
/* Exactly what Bars renders with table={false}: the scale top is the larger value. */
const bars = (id, [a, b], showValues, height = 120) => {
  const top = Math.max(a, b, 1);
  const bar = (label, v) => `<div class="bar" title="${label}: ${v}">${showValues ? `<span class="vlab">${v}</span>` : ''}<div class="fill" style="height: ${(v / top) * 100}%;"></div><span class="mlab">${label}</span></div>`;
  return `<div id="${id}"><div class="bars" style="height: ${height}px;">${bar('a', a)}${bar('b', b)}</div></div>`;
};
const hbars = (id, [a, b]) => {
  const top = Math.max(a, b, 1);
  const row = (label, v) => `<div class="hbar" title="${label}: ${v}"><span class="hlabel">${label}</span><span class="htrack"><i style="width: ${(v / top) * 100}%;"></i></span><span class="hcount">${v}</span></div>`;
  return `<div class="hbars" id="${id}">${row('a', a)}${row('b', b)}</div>`;
};
const page = (theme) => `<!doctype html><html data-theme="${theme}"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/components.css"><body style="width: 320px">
${PAIRS.map((p, i) => bars(`v${i}`, p, true) + bars(`q${i}`, p, false) + bars(`s${i}`, p, true, 80) + hbars(`h${i}`, p)).join('\n')}
</body></html>`;

let run;
before(async () => { run = await start({ extra: { [PAGE('dark')]: page('dark'), [PAGE('light')]: page('light') } }); });
after(async () => { await run?.stop(); });

/* For each chart: the two fill heights, the room the plot has (the bars box less the value and name rows),
   and whether every label stays inside the chart box. */
const MEASURE = (ids) => `(async () => {
  await new Promise((r) => setTimeout(r, 400));
  return JSON.stringify(${JSON.stringify(ids)}.map((sel) => {
    const root = document.querySelector(sel);
    const box = root.querySelector('.bars').getBoundingClientRect();
    const fills = [...root.querySelectorAll('.bar .fill')].map((f) => f.getBoundingClientRect());
    const labs = [...root.querySelectorAll('.bar .vlab, .bar .mlab')].map((l) => l.getBoundingClientRect());
    return { sel, values: [...root.querySelectorAll('.bar')].map((b) => Number(b.title.split(': ')[1])),
      h: fills.map((f) => f.height), base: fills.map((f) => f.bottom),
      inside: labs.every((l) => l.top >= box.top - 0.5 && l.bottom <= box.bottom + 0.5),
      overlap: labs.some((l) => fills.some((f) => f.height > 0 && l.right > f.left && l.left < f.right && l.bottom > f.top + 0.5 && l.top < f.bottom - 0.5)) };
  }));
})()`;
const HMEASURE = (ids) => `JSON.stringify(${JSON.stringify(ids)}.map((sel) => [...document.querySelectorAll(sel + ' .hbar')].map((r) => ({
  v: Number(r.title.split(': ')[1]), w: r.querySelector('.htrack i').getBoundingClientRect().width, track: r.querySelector('.htrack').getBoundingClientRect().width }))))`;

/* Proportional: the shorter fill is the taller one scaled by the value ratio, within 1px. */
const proportional = (m) => {
  const [a, b] = m.values;
  const [ha, hb] = m.h;
  const want = (hb * a) / b;
  assert.ok(Math.abs(ha - want) <= 1, `${m.sel}: ${a} drew ${ha.toFixed(1)}px, ${b} drew ${hb.toFixed(1)}px; ${a}:${b} wants ${want.toFixed(1)}px`);
  assert.ok(Math.abs(m.base[0] - m.base[1]) <= 0.5, `${m.sel}: the fills do not share a baseline`);
  assert.ok(m.inside, `${m.sel}: a label runs out of the chart box`);
  assert.ok(!m.overlap, `${m.sel}: a label sits on a fill`);
};

for (const scheme of ['dark', 'light']) {
  test(`Bars: fill heights are proportional to their values at ${PAIRS.length} pairs, with and without the value row (${scheme})`, { timeout: 60000 }, async (t) => {
    const p = await run.page({ width: 400, height: 900, scheme });
    await p.goto(PAGE(scheme));
    const ids = PAIRS.flatMap((_, i) => [`#v${i}`, `#q${i}`, `#s${i}`]);
    const ms = JSON.parse(await p.evaluate(MEASURE(ids)));
    const hs = JSON.parse(await p.evaluate(HMEASURE(PAIRS.map((_, i) => `#h${i}`))));
    await p.close();
    t.diagnostic(ms.map((m) => `${m.sel} ${m.values.join(':')} -> ${m.h.map((h) => h.toFixed(1)).join(' / ')}px`).join('; '));
    ms.forEach(proportional);
    for (const [a, b] of hs) {
      assert.ok(Math.abs(a.w - (b.w * a.v) / b.v) <= 1, `HBars ${a.v}:${b.v} drew ${a.w.toFixed(1)} and ${b.w.toFixed(1)}px`);
      assert.ok(Math.abs(b.w - b.track) <= 0.5, 'HBars: the top value fills its track');
    }
  });

  test(`/data-viz: the Suppressed values specimen draws 42 and 57 in proportion (${scheme})`, { timeout: 60000 }, async (t) => {
    const p = await run.page({ width: 1440, height: 900, scheme });
    await p.goto('/data-viz');
    const [m] = JSON.parse(await p.evaluate(MEASURE(['#suppressed .specimen'])));
    await p.close();
    t.diagnostic(`${m.values.join(':')} -> ${m.h.map((h) => h.toFixed(1)).join(' / ')}px`);
    /* Mon 42, Wed 0 and Thu 57 draw a fill; the suppressed Tue (title "<5", null here) draws a stub. */
    const pick = (v) => m.h[m.values.filter((x) => x !== null).indexOf(v)];
    const [h42, h57] = [pick(42), pick(57)];
    assert.ok(Math.abs(h42 - (h57 * 42) / 57) <= 1, `42 drew ${h42}px, 57 drew ${h57}px`);
    assert.ok(m.inside, 'a label runs out of the chart box');
  });
}

/* The hand-built Bars tile on /data-viz: its fills are inline shares of the plot (53, 65, 41, 71, 79%) and
   its goal line marks 28% from the plot top, so the line sits where a fill of 72% would end. */
const GOAL = `(async () => {
  await new Promise((r) => setTimeout(r, 400));
  const tile = document.querySelector('#bars .goal');
  const fills = [...tile.querySelectorAll('.bar .fill')].map((f) => ({ pct: parseFloat(f.style.height), r: f.getBoundingClientRect() }));
  const line = tile.querySelector('.goalline').getBoundingClientRect().top;
  const tag = tile.querySelector('.reftag').getBoundingClientRect();
  return JSON.stringify({ fills: fills.map((f) => ({ pct: f.pct, h: f.r.height, bottom: f.r.bottom })), line, tag: tag.top + tag.height / 2 });
})()`;

for (const scheme of ['dark', 'light']) {
  test(`/data-viz: the Bars tile draws its fills in proportion and its goal line on the plot (${scheme})`, { timeout: 60000 }, async (t) => {
    const p = await run.page({ width: 1440, height: 900, scheme });
    await p.goto('/data-viz');
    const r = JSON.parse(await p.evaluate(GOAL));
    await p.close();
    const top = r.fills.reduce((a, f) => (f.pct > a.pct ? f : a));
    const plot = top.h / (top.pct / 100);
    t.diagnostic(`${r.fills.map((f) => `${f.pct}% ${f.h.toFixed(1)}px`).join(', ')}; plot ${plot.toFixed(1)}px; goal at ${(top.bottom - r.line).toFixed(1)}px above the baseline`);
    for (const f of r.fills) assert.ok(Math.abs(f.h - (plot * f.pct) / 100) <= 1, `${f.pct}% drew ${f.h.toFixed(1)}px of a ${plot.toFixed(1)}px plot`);
    assert.ok(Math.abs(top.bottom - r.line - plot * 0.72) <= 1, `goal line ${(top.bottom - r.line).toFixed(1)}px above the baseline, wants ${(plot * 0.72).toFixed(1)}`);
    assert.ok(Math.abs(r.tag - r.line) <= 1, 'the goal tag is not centred on its line');
  });
}

/* The goal tag sits in its own column beside the plot, so a proportional bar can never run under it. */
const TAG = `(async () => {
  await new Promise((r) => setTimeout(r, 400));
  const tile = document.querySelector('#bars .goal');
  tile.scrollIntoView({ block: 'center' });
  const tag = tile.querySelector('.reftag').getBoundingClientRect();
  const hits = [...tile.querySelectorAll('.bar, .bar .fill, .bar .vlab')].map((b) => b.getBoundingClientRect())
    .filter((b) => b.width && b.height && b.left < tag.right && b.right > tag.left && b.top < tag.bottom && b.bottom > tag.top);
  return JSON.stringify({ tag: [tag.left, tag.top, tag.width, tag.height].map(Math.round), hits: hits.length });
})()`;

for (const width of [1280, 375]) {
  test(`/data-viz: the Bars tile's goal tag covers no bar (${width}px)`, { timeout: 60000 }, async (t) => {
    const p = await run.page({ width, height: 900, scheme: 'dark' });
    await p.goto('/data-viz');
    const r = JSON.parse(await p.evaluate(TAG));
    await p.close();
    t.diagnostic(`tag at ${r.tag.join(',')}`);
    assert.equal(r.hits, 0, 'the goal tag overlaps a bar');
  });
}
