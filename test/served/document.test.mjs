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
import { pdfPages } from './pdf-text.mjs';

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
  const p = await run.page({ width: 1280, height: 900 });
  try {
    await p.goto(URL_PATH);
    const { data } = await p.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
    pages = pdfPages(Buffer.from(data, 'base64'));
  } finally { await p.close(); }
});
after(async () => { await run?.stop(); });

test('print carries the running header on every page', () => {
  assert.ok(pages.length >= SECTIONS.length + 1, `${pages.length} printed pages`);
  for (const [i, t] of pages.entries()) assert.ok(t.includes(RUNNING), `page ${i + 1} has the running header`);
});

test('print opens every section after the first on a new page, in order', () => {
  const body = pages.map((t) => t.split(RUNNING).join(''));
  let last = -1;
  for (const [k, h] of SECTIONS.entries()) {
    const at = body.findIndex((t) => t.includes(h));
    assert.ok(at > last, `${h} on page ${at + 1}, after page ${last + 1}`);
    if (k) assert.ok(body[at].startsWith(h), `${h} starts page ${at + 1}: ${body[at].slice(0, 40)}`);
    last = at;
  }
});

test(`print repeats the table header row on every page the ${ROWS}-row table spans`, () => {
  const spans = pages.map((t, i) => [i, t]).filter(([, t]) => Array.from({ length: ROWS }, (_, n) => week(n + 1)).some((w) => t.includes(w)));
  assert.ok(spans.length >= 2, `the table spans ${spans.length} page(s); it must cross a page break`);
  for (const [i, t] of spans) for (const c of HEAD_CELLS) assert.ok(t.includes(c), `page ${i + 1} repeats the header cell ${c}: ${t.slice(0, 120)}`);
  for (let n = 1; n <= ROWS; n++) assert.equal(spans.filter(([, t]) => t.includes(week(n))).length, 1, `${week(n)} prints once`);
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
      targets: [...document.querySelectorAll('.doc-print, .doc-src > summary')].map((e) => ({ t: e.textContent.trim(), h: e.getBoundingClientRect().height })),
    }))()`);
    assert.ok(r.sw <= 375, `page is ${r.sw}px wide`);
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
