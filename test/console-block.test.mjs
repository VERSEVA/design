// The console block (blocks/console.html, byte-locked to site/examples/console.html):
// shell anatomy, fictional data, no page-local shell CSS, and parity of its inline
// rules with react/console-state.ts (the block cannot import the module, so it copies it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as state from '../react/console-state.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'blocks/console.html'), 'utf8');
const between = (a, b) => {
  const i = html.indexOf(a);
  const j = html.indexOf(b, i);
  assert.ok(i >= 0 && j > i, `markers ${a} .. ${b} missing`);
  return html.slice(i + a.length, j);
};
/* Values built inside a vm context carry that realm's prototypes; compare them as plain data. */
const plain = (x) => JSON.parse(JSON.stringify(x ?? null));
const rules = () => vm.runInNewContext(`${between('/* shell-rules:start */', '/* shell-rules:end */')}\nRULES`, {});

test('the block runs on the console shell anatomy', () => {
  for (const needle of [
    '<div class="cshell">',
    '<a class="skip" href="#main">Skip to content</a>',
    '<div class="cside" id="cside" role="region" aria-label="Sidebar">',
    'class="switcher" aria-haspopup="menu" aria-expanded="false" aria-controls="org-menu"',
    'role="menu" aria-label="Organizations" hidden',
    '<div class="cside-nav">',
    '<div class="cside-ft">',
    'class="collapse-row" aria-controls="cside" aria-keyshortcuts="[" aria-label="Collapse sidebar"',
    '<div class="capsule">',
    'role="menu" aria-label="Account" hidden',
    'class="platform" aria-label="Quarry v0.3.0, What\'s new"',
    '<header class="tbar">',
    '<nav class="crumbs" aria-label="Breadcrumb">',
    'aria-keyshortcuts="Meta+K Control+K"',
    'aria-label="Notifications, 3 unread" aria-haspopup="dialog"',
    'role="dialog" aria-labelledby="notif-title" tabindex="-1" hidden',
    'aria-label="Guides, What\'s new unread" aria-haspopup="menu"',
    '<main class="cbody" id="main" tabindex="-1">',
    '<div class="railtip" aria-hidden="true" hidden></div>',
    '<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="wn-title" hidden>',
    '<div class="drawer-bd" tabindex="0" role="region" aria-label="Release notes"></div>',
    /* names read like the React parts: a space before every trailing slot */
    'Northwind Labs <small>Owner</small>',
    '<b>Kai Webb</b> <small>kai@northwind.example</small>',
    'Kestrel Co <span class="mhint">Admin</span>',
    'M. Reyes <span class="metaline">',
  ]) assert.ok(html.includes(needle), `missing: ${needle}`);
  assert.doesNotMatch(html, /orgchip|<h2\b/);
  assert.deepEqual(html.match(/<span class="otile[^"]*"(?![^>]*aria-hidden="true")[^>]*>/g) ?? [], [], 'org tiles are aria-hidden');
});

test('every aria-controls and aria-labelledby target exists', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const refs = [...html.matchAll(/aria-(?:controls|labelledby)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 7, `only ${refs.length} references`);
  assert.deepEqual(refs.filter((r) => !ids.has(r)), []);
});

test('decorative svgs are hidden and every button has a type', () => {
  const svgs = html.match(/<svg\b[^>]*>/g) ?? [];
  assert.deepEqual(svgs.filter((s) => !s.includes('aria-hidden="true"')), []);
  const buttons = html.match(/<button\b[^>]*>/g) ?? [];
  assert.deepEqual(buttons.filter((b) => !b.includes('type="button"')), []);
});

test('no page-local shell css in the block', () => {
  const style = between('<style>', '</style>').replace('  .cshell { --sticky-top: 57px; }\n', '');
  assert.doesNotMatch(style, /\.(cshell|cside|cmain|cbody|switcher|otile|oname|capsule|acct|who|collapse-row|platform|tbar|ibtn|notifs?|panel|drawer|scrim|railtip|snav|sgroup|grouplabel|menu-list|menu-item|chgs?|rel)\b/);
});

test('fictional example data only', () => {
  for (const s of ['Northwind Labs', 'Kestrel Co', 'Orbit Studio', 'Kai Webb', 'kai@northwind.example', 'Search quotes, clients', 'v0.3.0']) {
    assert.ok(html.includes(s), `missing: ${s}`);
  }
  assert.doesNotMatch(html, /Acme Console/);
});

test('the block release data is templates/releases.json', () => {
  const data = vm.runInNewContext(`${between('/* shell-data:start */', '/* shell-data:end */')}\n({ VERSION, RELEASES })`, {});
  const tpl = JSON.parse(fs.readFileSync(path.join(root, 'templates/releases.json'), 'utf8'));
  assert.equal(data.VERSION, '0.3.0');
  assert.deepEqual(plain(data.RELEASES), tpl);
});

const V = ['0.3.0', 'v0.3.0', 'V0.3.0', ' 0.3.0 ', '0.2.0', '0.10.0', '0.9.9', '1', '1.2', '1.2.3-beta.2+sha', '1.0.0-alpha',
  '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0', 'latest', ''];

test('rules parity: keys, semver, unread', () => {
  const R = rules();
  assert.equal(R.SEEN_KEY, state.SEEN_KEY);
  assert.equal(R.COLLAPSE_KEY, state.COLLAPSE_KEY);
  for (const v of V) assert.deepEqual(plain(R.parseVersion(v)), plain(state.parseVersion(v)), `parseVersion(${JSON.stringify(v)})`);
  for (const a of V) for (const b of V) assert.equal(R.compareVersions(a, b), state.compareVersions(a, b), `compareVersions(${JSON.stringify(a)}, ${JSON.stringify(b)})`);
  for (const v of ['0.3.0', 'v0.3.0', 'latest']) assert.equal(R.displayVersion(v), state.displayVersion(v), `displayVersion(${v})`);
  for (const seen of [null, ...V]) for (const cur of V) assert.equal(R.isUnread(seen, cur), state.isUnread(seen, cur), `isUnread(${JSON.stringify(seen)}, ${JSON.stringify(cur)})`);
});

test('rules parity: releases', () => {
  const R = rules();
  const rel = (version) => ({ version, date: '2026-10-23', changes: [] });
  const list = [rel('0.2.0'), rel('0.10.0'), rel('latest'), rel('0.3.0'), rel('1.0.0-rc.1'), rel('0.9.9')];
  for (const cur of ['0.3.0', '0.10.0', '1.0.0', '0.1.0']) assert.deepEqual(plain(R.visibleReleases(list, cur)), plain(state.visibleReleases(list, cur)), `visibleReleases(${cur})`);
  for (const v of ['0.3.0', '0.2.0', '0.1.0']) {
    for (const seen of [null, 'junk', '0.2.0', '0.3.0']) assert.equal(R.isFresh(v, seen, '0.3.0'), state.isFresh(v, seen, '0.3.0'), `isFresh(${v}, ${seen})`);
  }
  const changes = [{ kind: 'fixed', text: 'a' }, { kind: 'other', text: 'b' }, { kind: 'new', text: 'c' }, { kind: 'improved', text: 'd' }, { kind: 'new', text: 'e' }, { kind: 'zzz', text: 'f' }];
  assert.deepEqual(plain(R.sortChanges(changes)), plain(state.sortChanges(changes)));
  for (const k of ['new', 'improved', 'fixed', 'other']) {
    assert.equal(R.kindLabel(k), state.kindLabel(k), `kindLabel(${k})`);
    for (const fresh of [true, false]) assert.equal(R.changeTone(k, fresh), state.changeTone(k, fresh), `changeTone(${k}, ${fresh})`);
  }
  for (const d of ['2026-10-23', '2026-09-30', '2026-01-01', '2026-02-30', 'soon']) assert.equal(R.formatReleaseDate(d), state.formatReleaseDate(d), `formatReleaseDate(${d})`);
});

test('rules parity: shortcuts, storage, counts, rail tip', () => {
  const R = rules();
  const el = (tagName, extra = {}) => ({ tagName, getAttribute: (n) => (n === 'role' ? extra.role ?? null : null), ...extra });
  const targets = [null, 'x', el('INPUT', { type: 'text' }), el('INPUT', { type: 'search' }), el('INPUT', { type: 'checkbox' }), el('INPUT', { type: 'radio' }),
    el('INPUT', { type: 'range' }), el('TEXTAREA'), el('SELECT'), el('BUTTON'), el('A'), el('DIV'), el('DIV', { isContentEditable: true }),
    el('DIV', { role: 'textbox' }), el('DIV', { role: 'TEXTBOX' }), el('DIV', { role: 'combobox' }), el('SPAN', { role: 'button' })];
  for (const t of targets) assert.equal(R.isTypingTarget(t), state.isTypingTarget(t), `isTypingTarget(${JSON.stringify(t)})`);
  const keys = [{ key: '[' }, { key: '[', metaKey: true }, { key: '[', ctrlKey: true }, { key: '[', altKey: true }, { key: '[', shiftKey: true },
    { key: '[', repeat: true }, { key: '[', isComposing: true }, { key: '[', defaultPrevented: true }, { key: '[', target: el('INPUT', { type: 'text' }) },
    { key: '[', target: el('BUTTON') }, { key: ']' }, { key: 'k', metaKey: true }, { key: 'K', ctrlKey: true }, { key: 'k', metaKey: true, shiftKey: true },
    { key: 'k', ctrlKey: true, altKey: true }, { key: 'k' }, { key: 'k', metaKey: true, target: el('INPUT', { type: 'text' }) }];
  for (const e of keys) {
    assert.equal(!!R.isCollapseShortcut(e), !!state.isCollapseShortcut(e), `isCollapseShortcut(${JSON.stringify(e)})`);
    assert.equal(!!R.isSearchShortcut(e), !!state.isSearchShortcut(e), `isSearchShortcut(${JSON.stringify(e)})`);
  }
  assert.equal(R.shortcutLabel(true), state.shortcutLabel(true));
  assert.equal(R.shortcutLabel(false), state.shortcutLabel(false));
  const mem = (init = {}) => {
    const m = new Map(Object.entries(init));
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, m };
  };
  const boom = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  for (const store of [null, boom, mem(), mem({ [state.COLLAPSE_KEY]: '1' }), mem({ [state.COLLAPSE_KEY]: '0' }), mem({ [state.COLLAPSE_KEY]: 'yes' })]) {
    for (const fallback of [false, true]) assert.equal(R.readCollapsed(store, undefined, fallback), state.readCollapsed(store, undefined, fallback));
  }
  for (const store of [null, boom, mem(), mem({ [state.SEEN_KEY]: '0.2.0' })]) assert.equal(R.readSeen(store), state.readSeen(store));
  const a = mem();
  const b = mem();
  R.writeCollapsed(a, true);
  state.writeCollapsed(b, true);
  R.writeSeen(a, '0.3.0');
  state.writeSeen(b, '0.3.0');
  assert.deepEqual([...a.m], [...b.m]);
  assert.doesNotThrow(() => { R.writeCollapsed(boom, true); R.writeSeen(boom, '1'); R.writeSeen(null, '1'); R.writeCollapsed(null, false); });
  for (const n of [0, -1, NaN, Infinity, 0.5, 1, 3, 99, 99.5, 100, 2.7]) assert.equal(R.badgeCount(n), state.badgeCount(n), `badgeCount(${n})`);
  const items = [{ unread: true }, { unread: false }, { unread: true }];
  assert.equal(R.unreadCount(items), state.unreadCount(items));
  const rect = { top: 100, right: 84, height: 36 };
  assert.deepEqual(plain(R.railTipPosition(rect)), plain(state.railTipPosition(rect)));
});

test('toast text is never parsed as markup', () => {
  const src = between('const toast = (text) => {', '\n  };');
  const made = [];
  const node = () => {
    const n = { style: {}, kids: [], innerHTML: '', setAttribute() {}, remove() {}, replaceChildren() { this.kids = []; } };
    n.append = (...xs) => { n.kids.push(...xs); };
    return n;
  };
  const wrap = node();
  const document = {
    getElementById: () => wrap,
    createElement: () => { const n = node(); made.push(n); return n; },
  };
  const toast = vm.runInNewContext(`(text) => {${src}\n}`, { document, setTimeout: () => 0, String });
  const hostile = '<img src=x onerror="alert(1)">';
  toast(`Switched to ${hostile}.`);
  const t = made.at(-1);
  assert.ok(!t.innerHTML.includes('<img'), 'toast text reached innerHTML');
  assert.deepEqual(t.kids, [`Switched to ${hostile}.`]);
});
