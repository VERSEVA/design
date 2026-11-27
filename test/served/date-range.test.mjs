// The date range control on /components: the segmented presets (#range) and the menu variant
// (#range-menu), driven as a user drives them. Each specimen is controlled by the page and
// writes the value it was last handed to data-value and the number of onChange calls to
// data-emits, so "emits the expected value" and "emits nothing" are read, not inferred.
// The specimen's dates are fixed (the week of 23 Nov 2026) and its snap is whole weeks,
// Monday to Sunday.
// Runs after `npm run studio:build && npm run assemble` (npm run test:served).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';

let run;
before(async () => { run = await start(); });
after(async () => { await run?.stop(); });

const WEEK = { range: '7', from: '2026-11-23', to: '2026-11-29', compare: false };
const FOUR = { range: '28', from: '2026-11-02', to: '2026-11-29', compare: false };
const THIRTEEN = { range: '91', from: '2026-08-31', to: '2026-11-29', compare: false };

/* Helpers every probe shares. A key is a dispatched keydown; a date is typed through the
   native setter and an input event (what React listens to); leaving a field is a real blur,
   with a dispatched focusout when the headless page holds no focus. */
const LIB = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tick = () => sleep(80);
  const spec = (tile, i) => document.querySelectorAll('#' + tile + ' .specimen')[i];
  const val = (s) => JSON.parse(s.dataset.value);
  const emits = (s) => Number(s.dataset.emits);
  const shown = (el) => !!el && el.getClientRects().length > 0;
  const radios = (s) => [...s.querySelectorAll('[role="radio"]')];
  const radio = (s, v) => s.querySelector('[role="radio"][data-v="' + v + '"]');
  const checked = (s) => radios(s).filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.dataset.v);
  const key = async (el, k) => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); await tick(); };
  const click = async (el) => { el.click(); await tick(); };
  const setDate = async (inp, v) => {
    inp.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, v);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
  };
  const leave = async (inp) => {
    let fired = false;
    inp.addEventListener('focusout', () => { fired = true; }, { once: true });
    inp.blur();
    await tick();
    if (!fired) inp.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await tick();
  };
  const field = (scope, k) => {
    const inp = scope.querySelector('input[data-k="' + k + '"]');
    const box = inp.closest('.field');
    const help = box.querySelector('.help');
    return { value: inp.value, error: box.classList.contains('error'), invalid: inp.getAttribute('aria-invalid'), help: shown(help) ? help.textContent : null, described: inp.getAttribute('aria-describedby') === help.id };
  };
  const active = () => { const a = document.activeElement; return a ? (a.dataset.v || a.dataset.k || a.id || a.localName) : null; };
  await sleep(1200);
  document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
  await sleep(200);
`;
const probe = async (page, body) => JSON.parse(await page.evaluate(`(async () => { ${LIB} ${body} })()`));
const open = async (opts) => { const page = await run.page({ height: 900, ...opts }); await page.goto('/components'); return page; };

test('segmented: choosing each preset emits the expected value, and the part leaves the URL alone', { timeout: 120000 }, async () => {
  const page = await open({ width: 1280, scheme: 'dark' });
  const r = await probe(page, `
    const s = spec('range', 0);
    if (!s) return JSON.stringify({ tile: false });
    const url = location.href;
    const steps = [{ value: val(s), emits: emits(s), checked: checked(s), line: s.querySelector('.range-ctl > .metaline').textContent, fields: shown(s.querySelector('.range-fields')) }];
    for (const v of ['28', '91', 'custom', '7']) {
      await click(radio(s, v));
      steps.push({ value: val(s), emits: emits(s), checked: checked(s), line: s.querySelector('.range-ctl > .metaline').textContent, fields: shown(s.querySelector('.range-fields')) });
    }
    await click(radio(s, '7'));
    const again = emits(s);
    const cmp = s.querySelector('.fchip');
    await click(cmp);
    const on = { value: val(s), pressed: cmp.getAttribute('aria-pressed'), line: s.querySelector('.range-ctl > .metaline').textContent, name: cmp.getAttribute('aria-label'), text: cmp.textContent };
    await click(cmp);
    return JSON.stringify({ tile: true, steps, again, on, off: val(s), sameUrl: location.href === url, search: location.search, group: s.querySelector('.seg').getAttribute('role'), labels: radios(s).map((b) => b.textContent) });
  `);
  await page.close();
  assert.ok(r.tile, '/components has no #range specimen');
  assert.equal(r.group, 'radiogroup');
  assert.deepEqual(r.labels, ['This week', '4 weeks', '13 weeks', 'Custom']);
  assert.deepEqual(r.steps.map((s) => s.value), [WEEK, FOUR, THIRTEEN, { ...THIRTEEN, range: 'custom' }, WEEK]);
  assert.deepEqual(r.steps.map((s) => s.emits), [0, 1, 2, 3, 4], 'one onChange per choice');
  assert.deepEqual(r.steps.map((s) => s.checked), [['7'], ['28'], ['91'], ['custom'], ['7']], 'one radio checked, the value\'s');
  assert.deepEqual(r.steps.map((s) => s.fields), [false, false, false, true, false], 'Custom shows the date fields; a preset hides them');
  assert.equal(r.steps[0].line, '23 Nov to 29 Nov 2026 · UTC');
  assert.equal(r.steps[2].line, '31 Aug to 29 Nov 2026 · UTC');
  assert.equal(r.again, 4, 'choosing the current preset again emits nothing');
  assert.deepEqual(r.on.value, { ...WEEK, compare: true });
  assert.deepEqual([r.on.pressed, r.on.text, r.on.name, r.on.line], ['true', 'Compare', 'Compare with previous period', '23 Nov to 29 Nov 2026 · UTC · vs previous']);
  assert.deepEqual(r.off, WEEK);
  assert.ok(r.sameUrl && r.search === '', 'the part never writes the URL');
});

test('segmented: custom dates snap on blur, never while typing; an invalid range shows the field error and emits nothing', { timeout: 120000 }, async () => {
  const page = await open({ width: 1280, scheme: 'dark' });
  const r = await probe(page, `
    const s = spec('range', 0);
    await click(radio(s, 'custom'));
    const from = s.querySelector('input[data-k="from"]'), to = s.querySelector('input[data-k="to"]');
    const base = emits(s);
    const start = { from: field(s, 'from'), to: field(s, 'to'), type: from.type, labels: [...s.querySelectorAll('.range-fields label')].map((l) => l.textContent) };
    await setDate(from, '2026-11-04');
    const typing = { input: from.value, emits: emits(s) - base, value: val(s) };
    await leave(from);
    const snapped = { input: from.value, emits: emits(s) - base, value: val(s) };
    await setDate(to, '2026-10-21');
    await leave(to);
    const bad = { from: field(s, 'from'), to: field(s, 'to'), emits: emits(s) - base, value: val(s) };
    await setDate(to, '');
    await leave(to);
    const empty = { to: field(s, 'to'), emits: emits(s) - base };
    await setDate(to, '2026-11-11');
    to.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await tick();
    const fixed = { to: field(s, 'to'), emits: emits(s) - base, value: val(s) };
    const still = spec('range', 3);
    return JSON.stringify({ start, typing, snapped, bad, empty, fixed, invalidSpecimen: { from: field(still, 'from'), to: field(still, 'to'), fields: shown(still.querySelector('.range-fields')), checked: checked(still), emits: emits(still), value: val(still), line: still.querySelector('.range-ctl > .metaline').textContent } });
  `);
  await page.close();
  assert.deepEqual([r.start.type, r.start.labels, r.start.from.value, r.start.to.value], ['date', ['From', 'To'], '2026-11-23', '2026-11-29']);
  assert.deepEqual(r.typing, { input: '2026-11-04', emits: 0, value: { ...WEEK, range: 'custom' } }, 'typing changes nothing but the field');
  assert.deepEqual(r.snapped, { input: '2026-11-02', emits: 1, value: { range: 'custom', from: '2026-11-02', to: '2026-11-29', compare: false } }, 'the host snap runs on blur');
  assert.deepEqual(r.bad.to, { value: '2026-10-25', error: true, invalid: 'true', help: 'End is before start', described: true });
  assert.deepEqual([r.bad.from.error, r.bad.from.help, r.bad.emits], [false, null, 1], 'only the end is wrong, and nothing was emitted');
  assert.deepEqual(r.bad.value, r.snapped.value, 'the value is still the last valid one');
  assert.deepEqual([r.empty.to.error, r.empty.to.help, r.empty.emits], [true, 'Enter an end date', 1]);
  assert.deepEqual(r.fixed, { to: { value: '2026-11-15', error: false, invalid: null, help: null, described: false }, emits: 2, value: { range: 'custom', from: '2026-11-02', to: '2026-11-15', compare: false } }, 'Enter commits, snapped, and the error clears');
  /* the invalid state as a specimen: the value stays valid, only the field that was typed is wrong */
  assert.deepEqual([r.invalidSpecimen.checked, r.invalidSpecimen.fields, r.invalidSpecimen.to.error, r.invalidSpecimen.to.help, r.invalidSpecimen.to.value, r.invalidSpecimen.from.error, r.invalidSpecimen.emits], [['custom'], true, true, 'End is before start', '2026-10-25', false, 0]);
  assert.deepEqual(r.invalidSpecimen.value, { range: 'custom', from: '2026-11-02', to: '2026-11-15', compare: false });
  assert.equal(r.invalidSpecimen.line, '2 Nov to 15 Nov 2026 · UTC', 'the range line never shows a range that cannot be emitted');
});

test('segmented: arrows, Home and End move and choose; one tab stop; focus order follows the row', { timeout: 120000 }, async () => {
  const page = await open({ width: 1280, scheme: 'dark' });
  const r = await probe(page, `
    const s = spec('range', 0);
    const stops = () => radios(s).filter((b) => b.tabIndex === 0).map((b) => b.dataset.v);
    const steps = [{ stops: stops() }];
    radio(s, '7').focus();
    for (const k of ['ArrowRight', 'ArrowDown', 'End', 'Home', 'ArrowLeft', 'ArrowUp']) {
      await key(document.activeElement, k);
      steps.push({ k, active: active(), range: val(s).range, stops: stops(), checked: checked(s) });
    }
    await key(document.activeElement, 'End');
    const order = [...s.querySelectorAll('button, input')].filter((e) => shown(e) && e.tabIndex === 0 && !e.disabled).map((e) => e.dataset.v || e.dataset.k || e.className);
    const ring = getComputedStyle(radio(s, 'custom')).outlineStyle;
    return JSON.stringify({ steps, order, emits: emits(s), ring });
  `);
  await page.close();
  assert.deepEqual(r.steps[0].stops, ['7'], 'the checked radio is the one tab stop');
  assert.deepEqual(r.steps.slice(1).map((s) => [s.k, s.active, s.range]), [
    ['ArrowRight', '28', '28'], ['ArrowDown', '91', '91'], ['End', 'custom', 'custom'], ['Home', '7', '7'], ['ArrowLeft', 'custom', 'custom'], ['ArrowUp', '91', '91'],
  ]);
  for (const s of r.steps.slice(1)) { assert.deepEqual(s.stops, [s.active]); assert.deepEqual(s.checked, [s.active]); }
  assert.deepEqual(r.order, ['custom', 'from', 'to', 'fchip'], 'presets, the custom dates, then Compare');
  assert.equal(r.emits, 7);
});

test('menu: one trigger shows the preset; arrows, Home, End; Escape closes and returns focus to the trigger', { timeout: 120000 }, async () => {
  const page = await open({ width: 1280, scheme: 'dark' });
  const r = await probe(page, `
    const s = spec('range-menu', 0);
    if (!s) return JSON.stringify({ tile: false });
    const trig = s.querySelector('.menu > .btn'), list = s.querySelector('.menu-list');
    const items = () => [...list.querySelectorAll('.menu-item')];
    const at = () => items().indexOf(document.activeElement);
    const state = () => ({ open: shown(list), expanded: trig.getAttribute('aria-expanded'), at: at(), onTrigger: document.activeElement === trig });
    const face = () => trig.textContent;
    const out = { tile: true, start: { ...state(), face: face(), popup: trig.getAttribute('aria-haspopup'), controls: trig.getAttribute('aria-controls') === list.id, roles: items().map((b) => b.getAttribute('role')), names: items().map((b) => b.textContent), checked: items().map((b) => b.getAttribute('aria-checked')), value: val(s) } };
    trig.focus();
    await click(trig);
    out.opened = state();
    const moves = [];
    for (const k of ['ArrowDown', 'End', 'ArrowDown', 'Home', 'ArrowUp']) { await key(document.activeElement, k); moves.push(at()); }
    out.moves = moves;
    await key(document.activeElement, 'Escape');
    out.escaped = { ...state(), emits: emits(s) };
    await key(trig, 'ArrowDown');
    out.arrowOpen = state();
    await click(items()[1]);
    out.picked = { ...state(), value: val(s), face: face(), checked: items().map((b) => b.getAttribute('aria-checked')) };
    await click(trig);
    out.reopened = state();
    await click(items()[4]);
    out.compared = { ...state(), value: val(s), face: face(), checked: items().map((b) => b.getAttribute('aria-checked')) };
    await click(trig);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await tick();
    out.outside = state();
    await click(trig);
    await click(items()[3]);
    const dlg = document.querySelector('dialog.sheet, dialog.modal');
    dlg.getAnimations().forEach((x) => { try { x.finish(); } catch (e) {} });
    const mbox = dlg.getBoundingClientRect();
    out.centred = { dx: Math.abs(mbox.left + mbox.width / 2 - innerWidth / 2), dy: Math.abs(mbox.top + mbox.height / 2 - innerHeight / 2), left: mbox.left, top: mbox.top };
    out.custom = { dialog: !!dlg && dlg.matches(':modal'), kind: dlg ? dlg.className : null, title: dlg?.querySelector('h4')?.textContent, labelled: dlg ? document.getElementById(dlg.getAttribute('aria-labelledby'))?.textContent : null, active: active(), menu: shown(list), close: dlg?.querySelector('.bd > .btn.icon')?.getAttribute('aria-label'), buttons: dlg ? [...dlg.querySelectorAll('.ft .btn')].map((b) => b.textContent) : [] };
    const before = emits(s);
    dlg.dispatchEvent(new Event('cancel', { cancelable: true }));
    await tick();
    out.cancelled = { dialog: !!document.querySelector('dialog.sheet, dialog.modal'), onTrigger: document.activeElement === trig, emits: emits(s) - before };
    await click(trig);
    await click(items()[3]);
    const d2 = document.querySelector('dialog.sheet, dialog.modal');
    await setDate(d2.querySelector('input[data-k="from"]'), '2026-10-07');
    await setDate(d2.querySelector('input[data-k="to"]'), '2026-10-01');
    await click(d2.querySelector('.ft .btn-primary'));
    out.badApply = { dialog: !!document.querySelector('dialog.sheet, dialog.modal'), to: field(d2, 'to'), active: active(), emits: emits(s) - before };
    await setDate(d2.querySelector('input[data-k="to"]'), '2026-10-14');
    await click(d2.querySelector('.ft .btn-primary'));
    out.applied = { dialog: !!document.querySelector('dialog.sheet, dialog.modal'), onTrigger: document.activeElement === trig, emits: emits(s) - before, value: val(s), face: face() };
    const few = spec('range-menu', 1);
    out.few = { roles: [...few.querySelectorAll('.menu-item')].map((b) => b.getAttribute('role')), names: [...few.querySelectorAll('.menu-item > span:first-child')].map((b) => b.textContent), sep: !!few.querySelector('.menu-sep') };
    out.search = location.search;
    return JSON.stringify(out);
  `);
  await page.close();
  assert.ok(r.tile, '/components has no #range-menu specimen');
  assert.deepEqual(r.start.value, WEEK);
  assert.deepEqual([r.start.open, r.start.expanded, r.start.popup, r.start.controls], [false, 'false', 'menu', true]);
  assert.equal(r.start.face, 'Range: This week23 Nov to 29 Nov 2026', 'the trigger names the control, the preset and its dates');
  assert.deepEqual(r.start.roles, ['menuitemradio', 'menuitemradio', 'menuitemradio', 'menuitemradio', 'menuitemcheckbox']);
  assert.deepEqual(r.start.names, ['This week23 Nov to 29 Nov 2026', '4 weeks2 Nov to 29 Nov 2026', '13 weeks31 Aug to 29 Nov 2026', 'Custom', 'Compare with previous period']);
  assert.deepEqual(r.start.checked, ['true', 'false', 'false', 'false', 'false']);
  assert.deepEqual(r.opened, { open: true, expanded: 'true', at: 0, onTrigger: false }, 'opening moves focus to the checked item');
  assert.deepEqual(r.moves, [1, 4, 0, 0, 4], 'ArrowDown, End, ArrowDown (wraps), Home, ArrowUp (wraps)');
  assert.deepEqual(r.escaped, { open: false, expanded: 'false', at: -1, onTrigger: true, emits: 0 }, 'Escape closes, returns focus and emits nothing');
  assert.deepEqual(r.arrowOpen, { open: true, expanded: 'true', at: 0, onTrigger: false });
  assert.deepEqual(r.picked.value, FOUR);
  assert.deepEqual([r.picked.open, r.picked.onTrigger, r.picked.face, r.picked.checked], [false, true, 'Range: 4 weeks2 Nov to 29 Nov 2026', ['false', 'true', 'false', 'false', 'false']]);
  assert.equal(r.reopened.at, 1, 'reopening lands on the checked preset');
  assert.deepEqual(r.compared.value, { ...FOUR, compare: true });
  assert.deepEqual([r.compared.open, r.compared.onTrigger, r.compared.face, r.compared.checked[4]], [false, true, 'Range: 4 weeks2 Nov to 29 Nov 2026 · vs previous', 'true']);
  assert.deepEqual([r.outside.open, r.outside.expanded], [false, 'false'], 'a press outside closes it');
  /* Custom from the menu on a desktop: the existing modal on a native dialog */
  assert.deepEqual(r.custom, { dialog: true, kind: 'modal', title: 'Custom range', labelled: 'Custom range', active: 'from', menu: false, close: 'Close', buttons: ['Cancel', 'Apply'] });
  assert.ok(r.centred.dx < 1 && r.centred.dy < 1 && r.centred.left > 100 && r.centred.top > 100, `the modal opens centred, not pinned to a corner (${JSON.stringify(r.centred)})`);
  assert.deepEqual(r.cancelled, { dialog: false, onTrigger: true, emits: 0 }, 'Escape on the dialog closes it, returns focus and emits nothing');
  assert.deepEqual([r.badApply.dialog, r.badApply.to.error, r.badApply.to.help, r.badApply.active, r.badApply.emits], [true, true, 'End is before start', 'to', 0], 'an invalid range stays open on the field that is wrong');
  assert.deepEqual(r.applied, { dialog: false, onTrigger: true, emits: 1, value: { range: 'custom', from: '2026-10-05', to: '2026-10-18', compare: true }, face: 'Range: Custom5 Oct to 18 Oct 2026 · vs previous' });
  /* no Custom and no Compare unless the host passes them */
  assert.deepEqual(r.few, { roles: ['menuitemradio', 'menuitemradio'], names: ['This week', '4 weeks'], sep: false });
  assert.equal(r.search, '');
});

test('at 375px the custom dates open in a sheet, from the presets and from the menu', { timeout: 120000 }, async () => {
  const page = await open({ width: 375, scheme: 'dark' });
  const r = await probe(page, `
    const s = spec('range', 0);
    const custom = radio(s, 'custom');
    const seg = s.querySelector('.seg').getBoundingClientRect(), row = s.querySelector('.range-ctl').getBoundingClientRect();
    const out = { popup: custom.getAttribute('aria-haspopup'), segFills: Math.abs(seg.width - row.width) < 1, oneRow: new Set(radios(s).map((b) => Math.round(b.getBoundingClientRect().top))).size === 1 };
    radio(s, '7').focus();
    await key(document.activeElement, 'End');
    out.keyed = { active: active(), range: val(s).range, dialog: !!document.querySelector('dialog.sheet, dialog.modal'), stops: radios(s).filter((b) => b.tabIndex === 0).map((b) => b.dataset.v), emits: emits(s) };
    await click(custom);
    let dlg = document.querySelector('dialog.sheet, dialog.modal');
    const box = dlg ? dlg.getBoundingClientRect() : null;
    out.opened = { dialog: !!dlg && dlg.matches(':modal'), kind: dlg?.className, grab: !!dlg?.querySelector('.grab'), title: dlg?.querySelector('h4')?.textContent, inline: shown(s.querySelector('.range-ctl > .range-fields')), fields: dlg ? [...dlg.querySelectorAll('.range-fields input')].map((i) => [i.dataset.k, i.type, i.value]) : [], active: active(), emits: emits(s), range: val(s).range, atBottom: box ? innerHeight - box.bottom < 24 && box.top > 0 : false, inside: box ? box.left >= 0 && box.right <= innerWidth : false, buttons: dlg ? [...dlg.querySelectorAll('.ft .btn')].map((b) => b.textContent) : [] };
    await click(dlg.querySelector('.ft .btn-secondary'));
    out.cancelled = { dialog: !!document.querySelector('dialog.sheet, dialog.modal'), emits: emits(s), active: active() };
    await click(custom);
    dlg = document.querySelector('dialog.sheet, dialog.modal');
    await setDate(dlg.querySelector('input[data-k="from"]'), '2026-11-18');
    await setDate(dlg.querySelector('input[data-k="to"]'), '2026-11-11');
    await click(dlg.querySelector('.ft .btn-primary'));
    out.bad = { dialog: !!document.querySelector('dialog.sheet, dialog.modal'), to: field(dlg, 'to'), emits: emits(s) };
    await setDate(dlg.querySelector('input[data-k="to"]'), '2026-11-25');
    await click(dlg.querySelector('.ft .btn-primary'));
    out.applied = { dialog: !!document.querySelector('dialog.sheet, dialog.modal'), emits: emits(s), value: val(s), active: active(), checked: checked(s), inline: shown(s.querySelector('.range-ctl > .range-fields')) };
    const m = spec('range-menu', 0);
    const trig = m.querySelector('.menu > .btn');
    await click(trig);
    await click(m.querySelectorAll('.menu-item')[3]);
    dlg = document.querySelector('dialog.sheet, dialog.modal');
    out.menu = { kind: dlg?.className, modal: !!dlg && dlg.matches(':modal'), emits: emits(m) };
    dlg.dispatchEvent(new Event('cancel', { cancelable: true }));
    await tick();
    out.menuClosed = { dialog: !!document.querySelector('dialog.sheet, dialog.modal'), onTrigger: document.activeElement === trig, emits: emits(m) };
    out.coarse = matchMedia('(pointer:coarse)').matches;
    out.coarseRules = [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules]; } catch (e) { return []; } }).filter((x) => x.media && /pointer:\\s*coarse/.test(x.conditionText))
      .flatMap((x) => [...x.cssRules]).filter((x) => /range-ctl|range-fields|data-range/.test(x.selectorText) && x.style.minHeight === '44px').map((x) => x.selectorText).join(',');
    out.heights = { seg: custom.getBoundingClientRect().height, chip: s.querySelector('.fchip').getBoundingClientRect().height, trigger: trig.getBoundingClientRect().height };
    out.scrollWidth = document.documentElement.scrollWidth; out.clientWidth = document.documentElement.clientWidth;
    return JSON.stringify(out);
  `);
  await page.close();
  assert.equal(r.popup, 'dialog', 'at phone width Custom says it opens a dialog');
  assert.ok(r.segFills && r.oneRow, 'the presets share the row, full width');
  assert.deepEqual(r.keyed, { active: 'custom', range: '7', dialog: false, stops: ['custom'], emits: 0 }, 'an arrow onto Custom moves focus only; the sheet waits for Enter or a tap');
  assert.deepEqual(r.opened, { dialog: true, kind: 'sheet', grab: true, title: 'Custom range', inline: false, fields: [['from', 'date', '2026-11-23'], ['to', 'date', '2026-11-29']], active: 'from', emits: 0, range: '7', atBottom: true, inside: true, buttons: ['Cancel', 'Apply'] });
  assert.deepEqual(r.cancelled, { dialog: false, emits: 0, active: 'custom' }, 'Cancel emits nothing and returns focus to Custom');
  assert.deepEqual([r.bad.dialog, r.bad.to.error, r.bad.to.help, r.bad.emits], [true, true, 'End is before start', 0]);
  assert.deepEqual(r.applied, { dialog: false, emits: 1, value: { range: 'custom', from: '2026-11-16', to: '2026-11-29', compare: false }, active: 'custom', checked: ['custom'], inline: false });
  assert.deepEqual(r.menu, { kind: 'sheet', modal: true, emits: 0 });
  assert.deepEqual(r.menuClosed, { dialog: false, onTrigger: true, emits: 0 });
  /* 44px for a finger: the served sheet carries the rules, and the controls follow the pointer they have */
  for (const sel of ['.range-ctl > .seg button', '.range-ctl > .fchip', '.range-fields .field input', '.menu[data-range] > .btn', '.menu[data-range] .menu-item']) assert.ok(r.coarseRules.includes(sel), `no 44px coarse rule for ${sel} (${r.coarseRules})`);
  if (r.coarse) for (const [k, h] of Object.entries(r.heights)) assert.ok(h >= 44, `${k} is ${h}px on a coarse pointer`);
  assert.ok(r.scrollWidth <= r.clientWidth, `no sideways scroll (${r.scrollWidth} vs ${r.clientWidth})`);
});

for (const scheme of ['dark', 'light']) {
  test(`every contract state renders in ${scheme}: custom open, compare on, invalid, disabled; the checked preset reads as pressed`, { timeout: 120000 }, async () => {
    const page = await open({ width: 1280, scheme });
    const r = await probe(page, `
      const probeEl = document.createElement('span');
      probeEl.style.cssText = 'background:var(--surface);color:var(--text-1)';
      document.body.appendChild(probeEl);
      const surface = getComputedStyle(probeEl).backgroundColor, text1 = getComputedStyle(probeEl).color;
      probeEl.remove();
      const a = spec('range', 0), few = spec('range', 1), c = spec('range', 2), dis = spec('range', 4), mcustom = spec('range-menu', 2), mcmp = spec('range-menu', 3), mdis = spec('range-menu', 4);
      const chip = a.querySelector('.fchip');
      const face = (m) => m.querySelector('.menu > .btn').textContent;
      const on = getComputedStyle(radio(a, '7')), off = getComputedStyle(radio(a, '28'));
      return JSON.stringify({
        mode: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
        on: { bg: on.backgroundColor === surface, color: on.color === text1, weight: on.fontWeight }, off: { bg: off.backgroundColor },
        few: { labels: radios(few).map((b) => b.textContent), chip: !!few.querySelector('.fchip'), fields: !!few.querySelector('.range-fields') },
        custom: { checked: checked(c), fields: shown(c.querySelector('.range-fields')), pressed: c.querySelector('.fchip').getAttribute('aria-pressed'), line: c.querySelector('.range-ctl > .metaline').textContent, from: field(c, 'from'), to: field(c, 'to') },
        disabled: { all: [...dis.querySelectorAll('button, input')].every((e) => e.disabled), count: dis.querySelectorAll('button, input').length, opacity: getComputedStyle(radio(dis, '7')).opacity, cursor: getComputedStyle(radio(dis, '7')).cursor },
        menuDisabled: mdis.querySelector('.menu > .btn').disabled,
        states: [document.querySelectorAll('#range .specimen').length, document.querySelectorAll('#range-menu .specimen').length],
        names: ['range', 'range-menu'].map((t) => [...document.querySelectorAll('#' + t + ' .range-state > .range-state-name')].map((n) => n.textContent)),
        named: [...document.querySelectorAll('#range .range-state, #range-menu .range-state')].every((b) => b.children.length === 2 && b.lastElementChild.classList.contains('specimen')),
        chip: { font: getComputedStyle(chip).fontFamily, parent: getComputedStyle(chip.parentElement).fontFamily },
        live: a.querySelector('.range-ctl > .metaline').getAttribute('aria-live'),
        menuCustom: { face: face(mcustom), checked: [...mcustom.querySelectorAll('.menu-item')].map((b) => b.getAttribute('aria-checked')) },
        menuCompare: { face: face(mcmp), checked: [...mcmp.querySelectorAll('.menu-item')].map((b) => b.getAttribute('aria-checked')) },
      });
    `);
    await page.close();
    assert.equal(r.mode, scheme);
    assert.deepEqual(r.on, { bg: true, color: true, weight: '600' }, 'aria-checked carries the pressed look: --surface, --text-1, 600');
    assert.deepEqual(r.off, { bg: 'rgba(0, 0, 0, 0)' });
    assert.deepEqual(r.few, { labels: ['This week', '4 weeks'], chip: false, fields: false }, 'no Custom and no Compare unless the host passes them');
    assert.deepEqual([r.custom.checked, r.custom.fields, r.custom.pressed, r.custom.line], [['custom'], true, 'true', '5 Oct to 1 Nov 2026 · UTC · vs previous']);
    assert.deepEqual([r.custom.from.value, r.custom.to.value, r.custom.from.error, r.custom.to.error], ['2026-10-05', '2026-11-01', false, false]);
    assert.ok(r.disabled.all && r.disabled.count >= 5, 'every control in the disabled specimen is disabled');
    assert.deepEqual([r.disabled.opacity, r.disabled.cursor, r.menuDisabled], ['0.45', 'not-allowed', true]);
    assert.deepEqual(r.states, [5, 5]);
    assert.deepEqual(r.names, [['Default', 'Two presets', 'Custom, compare on', 'Invalid range', 'Disabled'], ['Default', 'Two presets', 'Custom range', 'Compare on', 'Disabled']]);
    assert.ok(r.named, 'each state is a name over its specimen');
    assert.equal(r.chip.font, r.chip.parent, 'a filter chip is set in the face of the text around it');
    assert.equal(r.live, 'polite');
    assert.deepEqual(r.menuCustom, { face: 'Range: 4 weeks5 Oct to 1 Nov 2026', checked: ['false', 'false', 'false', 'true', 'false'] });
    assert.deepEqual(r.menuCompare, { face: 'Range: This week23 Nov to 29 Nov 2026 · vs previous', checked: ['true', 'false', 'false', 'false', 'true'] });
  });
}

test('at 375px each menu trigger keeps its label on one line and nothing in it overflows', { timeout: 120000 }, async () => {
  const page = await open({ width: 375, scheme: 'dark' });
  const r = await probe(page, `
    return JSON.stringify([...document.querySelectorAll('#range-menu .specimen')].map((s) => {
      const trig = s.querySelector('.menu > .btn'), box = s.getBoundingClientRect(), t = trig.getBoundingClientRect();
      /* lines of the label, read from the text itself: a flex item reports one box however it wraps */
      const lines = [...trig.querySelectorAll('[data-lbl]')].map((el) => { const g = document.createRange(); g.selectNodeContents(el); return new Set([...g.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size; });
      return { face: trig.textContent, lines, w: Math.round(t.width), box: Math.round(box.width), inside: t.left >= box.left - 0.5 && t.right <= box.right + 0.5, overflow: trig.scrollWidth > trig.clientWidth + 1 || trig.scrollHeight > trig.clientHeight + 1 };
    }));
  `);
  await page.close();
  assert.equal(r.length, 5);
  for (const t of r) {
    assert.deepEqual(t.lines, [1], `the trigger label wraps: ${t.face} (${t.lines}, ${t.w}px in ${t.box}px)`);
    assert.ok(t.inside && !t.overflow, `the trigger leaves its specimen: ${t.face}`);
  }
});
