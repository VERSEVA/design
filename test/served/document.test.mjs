// The document template (templates/document.html, issue 199), served from out/ and as
// `verseva add document` writes it, opened from file://. Printed through Page.printToPDF and
// read back page by page (pdf-text.mjs): a running header on every page, each section after
// the first opening a page, and the long table repeating its header row on every page it
// spans. With scripting off every section is on the page; on a phone the controls are 44px.
// Runs after `npm run studio:build && npm run assemble` (npm run test:served).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { start, root } from './chrome.mjs';
import { pdfPages, pdfPaint, luminance } from './pdf-text.mjs';

const URL_PATH = '/templates/document.html';
const RUNNING = 'Onboardingreview,Q3';
const SECTIONS = ['Summary', 'Findings', 'Weeklyvolume', 'Nextsteps'];
/* Each header cell; checked one by one, since glyph order in a PDF can vary with the font. */
const HEAD_CELLS = ['Newaccounts', 'Startedwithin7days', 'Mediandaystofirstuse'];
const ROWS = 36;
const week = (n) => `Week${String(n).padStart(2, '0')}`;

let run;
let added;
let pages;
before(async () => {
  run = await start();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsv-doc-'));
  execFileSync(process.execPath, [path.join(root, 'bin/verseva.mjs'), 'add', 'document', '--dir', 'out'], { cwd: dir, encoding: 'utf8' });
  added = path.join(dir, 'out', 'document.html');
  pdf.light = await printed('light');
  pdf.dark = await printed('dark');
  pages = pdfPages(pdf.light);
});
const pdf = {};
/* The template printed to PDF from light (its default) or from dark (data-theme removed). */
async function printed(theme) {
  const p = await run.page({ width: 1280, height: 900 });
  try {
    await p.goto(URL_PATH);
    if (theme === 'dark') await p.evaluate(`delete document.documentElement.dataset.theme`);
    const { data } = await p.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
    return Buffer.from(data, 'base64');
  } finally { await p.close(); }
}
after(async () => { await run?.stop(); });

test('print carries the running header on every page', () => {
  assert.ok(pages.length >= 2, `${pages.length} printed pages`);
  for (const [i, t] of pages.entries()) assert.ok(t.includes(RUNNING), `page ${i + 1} has the running header`);
});

test('print breaks a page only before the table section; the others flow', () => {
  const body = pages.map((t) => t.split(RUNNING).join(''));
  const at = (h) => body.findIndex((t) => t.includes(h));
  let last = -1;
  for (const h of SECTIONS) { assert.ok(at(h) >= last, `${h} in order`); last = at(h); }
  assert.ok(body[at('Weeklyvolume')].startsWith('Weeklyvolume'), 'the table section opens a page');
  for (const h of ['Findings', 'Nextsteps']) assert.ok(!body[at(h)].startsWith(h), `${h} flows on from the section before it`);
});

test(`print repeats the table header row on every page the ${ROWS}-row table spans`, () => {
  const spans = pages.map((t, i) => [i, t]).filter(([, t]) => Array.from({ length: ROWS }, (_, n) => week(n + 1)).some((w) => t.includes(w)));
  assert.equal(spans.length, 2, `the table spans ${spans.length} pages; it must cross one page break and fit two pages`);
  for (const [i, t] of spans) {
    const rows = Array.from({ length: ROWS }, (_, n) => week(n + 1)).filter((w) => t.includes(w)).length;
    assert.ok(rows >= 2, `page ${i + 1} holds ${rows} table row(s): no orphan row under a repeated header`);
  }
  for (const [i, t] of spans) for (const c of HEAD_CELLS) assert.ok(t.includes(c), `page ${i + 1} repeats the header cell ${c}: ${t.slice(0, 120)}`);
  for (let n = 1; n <= ROWS; n++) assert.equal(spans.filter(([, t]) => t.includes(week(n))).length, 1, `${week(n)} prints once`);
});

test('print is white paper with dark text, from light and from dark mode', () => {
  for (const theme of ['light', 'dark']) {
    for (const [i, pg] of pdfPaint(pdf[theme]).entries()) {
      /* the largest opaque fill on the page is the paper's background, if one is painted at all */
      const opaque = pg.fills.filter((f) => f.alpha >= 0.5);
      const big = opaque.reduce((m, f) => (f.w * f.h > (m?.w ?? 0) * (m?.h ?? 0) ? f : m), null);
      if (big) assert.ok(luminance(big.color) >= 0.98, `${theme}, page ${i + 1}: the largest fill is ${JSON.stringify(big)}, not white`);
      const light = pg.text.filter((c) => c.alpha >= 0.5 && luminance(c.color) > 0.5);
      assert.deepEqual(light, [], `${theme}, page ${i + 1}: light text on paper`);
    }
  }
});

test('print leaves the controls and the sources off the page', () => {
  const all = pages.join('');
  assert.ok(!all.includes('Print'), 'no Print button on paper');
  assert.ok(!all.includes('Sources'), 'no Sources control on paper');
});

test('with scripting off every section, the table and the numbers are on the page', async () => {
  const p = await run.page({ width: 1280, height: 900, scripts: false });
  try {
    await p.goto(URL_PATH);
    const r = await p.evaluate(`(() => ({
      ran: document.documentElement.classList.contains('doc-js'),
      h1: document.querySelector('h1')?.textContent.trim() ?? '',
      sections: [...document.querySelectorAll('.doc-section')].map((s) => ({ h: s.querySelector('h2')?.textContent.trim(), box: s.getBoundingClientRect().height, vis: getComputedStyle(s).visibility })),
      rows: [...document.querySelectorAll('.doc-table tbody tr')].filter((r) => r.getBoundingClientRect().height > 0).length,
      print: getComputedStyle(document.querySelector('.doc-print')).display,
    }))()`);
    assert.equal(r.ran, false, 'the page script did not run');
    assert.ok(r.h1.length > 0);
    assert.equal(r.sections.length, SECTIONS.length);
    for (const s of r.sections) assert.ok(s.box > 40 && s.vis === 'visible' && s.h, `${s.h} visible`);
    assert.equal(r.rows, ROWS);
    assert.equal(r.print, 'none', 'no dead Print button without the script');
  } finally { await p.close(); }
});

test('on a 375 by 812 phone the controls are 44px targets and nothing scrolls sideways', async () => {
  const p = await run.page({ width: 375, height: 812, touch: true });
  try {
    await p.goto(URL_PATH);
    const r = await p.evaluate(`(() => ({
      sw: document.documentElement.scrollWidth,
      printTop: document.querySelector('.doc-print').getBoundingClientRect().top,
      metaTop: document.querySelector('.doc-meta span').getBoundingClientRect().top,
      printLeft: document.querySelector('.doc-print').getBoundingClientRect().left,
      metaLeft: document.querySelector('.doc-meta span').getBoundingClientRect().left,
      targets: [...document.querySelectorAll('.doc-print, .doc-src > summary')].map((e) => ({ t: e.textContent.trim(), h: e.getBoundingClientRect().height })),
    }))()`);
    assert.ok(r.sw <= 375, `page is ${r.sw}px wide`);
    if (r.printTop > r.metaTop + 4) assert.ok(Math.abs(r.printLeft - r.metaLeft) <= 1, `a wrapped Print control starts its line (left ${r.printLeft}, line starts ${r.metaLeft})`);
    assert.ok(r.targets.length >= 2);
    for (const t of r.targets) assert.ok(t.h >= 44, `${t.t} is ${t.h}px tall`);
  } finally { await p.close(); }
});

test('the verseva add document output links no stylesheet, opens from file:// and renders on the signature', async () => {
  const html = fs.readFileSync(added, 'utf8');
  assert.doesNotMatch(html, /<link\b[^>]*rel=["']?stylesheet/i);
  assert.doesNotMatch(html, /@import/);
  const p = await run.page({ width: 1280, height: 900 });
  try {
    await p.goto(pathToFileURL(added).href);
    const r = await p.evaluate(`(() => ({
      scheme: location.protocol,
      sheets: [...document.styleSheets].map((s) => s.href),
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      badge: getComputedStyle(document.querySelector('.badge.neutral')).backgroundColor,
      rows: document.querySelectorAll('.doc-table tbody tr').length,
    }))()`);
    assert.equal(r.scheme, 'file:');
    assert.ok(r.sheets.length >= 2 && r.sheets.every((h) => h === null), `inline sheets only: ${JSON.stringify(r.sheets)}`);
    assert.ok(r.accent.length > 0, 'tokens.css is inlined');
    assert.notEqual(r.badge, 'rgba(0, 0, 0, 0)', 'components.css is inlined');
    assert.equal(r.rows, ROWS);
  } finally { await p.close(); }
});
