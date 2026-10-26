// Console shell logic (react/console-state.ts). Node strips the types on import.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEEN_KEY, COLLAPSE_KEY, COLLAPSE_SHORTCUT, KIND_ORDER, KIND_LABEL,
  parseVersion, compareVersions, displayVersion, isUnread, safeStorage,
  readSeen, writeSeen, readCollapsed, writeCollapsed, isTypingTarget,
  isCollapseShortcut, isSearchShortcut, shortcutLabel, visibleReleases,
  isFresh, sortChanges, kindLabel, changeTone, formatReleaseDate,
  unreadCount, badgeCount, initials, railTipPosition, safeHref, withDefaults,
} from '../react/console-state.ts';

const memory = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, m };
};
const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
const el = (tagName, extra = {}) => ({ tagName, getAttribute: (n) => (extra.attrs ?? {})[n] ?? null, ...extra });

describe('constants', () => {
  test('keys, shortcut and kinds are fixed', () => {
    assert.equal(SEEN_KEY, 'verseva.whatsnew.seen');
    assert.equal(COLLAPSE_KEY, 'verseva.shell.collapsed');
    assert.equal(COLLAPSE_SHORTCUT, '[');
    assert.deepEqual(KIND_ORDER, ['new', 'improved', 'fixed']);
    assert.deepEqual(KIND_LABEL, { new: 'New', improved: 'Improved', fixed: 'Fixed' });
  });
});

describe('parseVersion', () => {
  test('optional v, missing parts are 0, whitespace trimmed', () => {
    assert.deepEqual(parseVersion('v1.2'), { major: 1, minor: 2, patch: 0, pre: [] });
    assert.deepEqual(parseVersion(' V3 '), { major: 3, minor: 0, patch: 0, pre: [] });
    assert.deepEqual(parseVersion('0.3.0'), { major: 0, minor: 3, patch: 0, pre: [] });
  });
  test('prerelease identifiers split on dots, numeric ones as numbers; build ignored', () => {
    assert.deepEqual(parseVersion('1.2.3-beta.2+sha'), { major: 1, minor: 2, patch: 3, pre: ['beta', 2] });
  });
  test('anything else is null', () => {
    for (const bad of ['latest', '', '1.2.3.4', 'v', '1..2', '1.2.3-', 'x1.2.3']) assert.equal(parseVersion(bad), null, bad);
  });
});

describe('compareVersions', () => {
  test('numeric, not lexical', () => {
    assert.equal(compareVersions('0.10.0', '0.9.9'), 1);
    assert.equal(compareVersions('0.9.9', '0.10.0'), -1);
  });
  test('prerelease sorts below its release', () => {
    assert.equal(compareVersions('1.0.0-rc.1', '1.0.0'), -1);
    assert.equal(compareVersions('1.0.0', '1.0.0-rc.1'), 1);
  });
  test('v prefix and build metadata do not matter', () => {
    assert.equal(compareVersions('v0.3.0', '0.3.0'), 0);
    assert.equal(compareVersions('1.0.0+a', '1.0.0+b'), 0);
  });
  test('numeric identifiers below alphanumeric; shorter prerelease below longer', () => {
    assert.equal(compareVersions('1.0.0-1', '1.0.0-alpha'), -1);
    assert.equal(compareVersions('1.0.0-alpha', '1.0.0-alpha.1'), -1);
    assert.equal(compareVersions('1.0.0-alpha.beta', '1.0.0-beta'), -1);
    assert.equal(compareVersions('1.0.0-beta.2', '1.0.0-beta.11'), -1);
  });
  test('invalid sorts below every valid; two invalid compare 0', () => {
    assert.equal(compareVersions('nope', '0.0.1'), -1);
    assert.equal(compareVersions('0.0.1', 'nope'), 1);
    assert.equal(compareVersions('nope', 'also nope'), 0);
  });
});

describe('displayVersion', () => {
  test('prefixes v on valid versions, keeps an existing v, returns invalid trimmed', () => {
    assert.equal(displayVersion('0.3.0'), 'v0.3.0');
    assert.equal(displayVersion('v0.3.0'), 'v0.3.0');
    assert.equal(displayVersion(' latest '), 'latest');
  });
});

describe('isUnread', () => {
  test('never unread when the current version is invalid', () => {
    assert.equal(isUnread(null, 'latest'), false);
    assert.equal(isUnread('0.1.0', ''), false);
  });
  test('missing or invalid last-seen is unread (first visit)', () => {
    assert.equal(isUnread(null, '0.3.0'), true);
    assert.equal(isUnread('garbage', '0.3.0'), true);
  });
  test('unread only while last-seen is older', () => {
    assert.equal(isUnread('0.2.0', '0.3.0'), true);
    assert.equal(isUnread('0.3.0', '0.3.0'), false);
    assert.equal(isUnread('v0.3.0', '0.3.0'), false);
    assert.equal(isUnread('0.4.0', '0.3.0'), false);
  });
});

describe('safeStorage', () => {
  const swap = (descriptor, fn) => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...descriptor });
    try { return fn(); } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete globalThis.localStorage;
    }
  };
  test('returns a usable localStorage', () => {
    const store = memory();
    swap({ value: store }, () => assert.equal(safeStorage(), store));
  });
  test('null when reading localStorage throws, when it is missing, or when it lacks the methods', () => {
    swap({ get() { throw new Error('SecurityError'); } }, () => assert.equal(safeStorage(), null));
    swap({ value: undefined }, () => assert.equal(safeStorage(), null));
    swap({ value: { getItem() { return null; } } }, () => assert.equal(safeStorage(), null));
  });
});

describe('seen and collapsed persistence', () => {
  test('readSeen: value, null store, throwing store', () => {
    assert.equal(readSeen(memory({ [SEEN_KEY]: '0.2.0' })), '0.2.0');
    assert.equal(readSeen(memory({ custom: '1.0.0' }), 'custom'), '1.0.0');
    assert.equal(readSeen(memory()), null);
    assert.equal(readSeen(null), null);
    assert.equal(readSeen(throwing), null);
  });
  test('writeSeen writes the version as given; null and throwing stores are no-ops', () => {
    const s = memory();
    writeSeen(s, '0.3.0');
    assert.equal(s.m.get(SEEN_KEY), '0.3.0');
    writeSeen(s, 'v0.4.0', 'custom');
    assert.equal(s.m.get('custom'), 'v0.4.0');
    assert.doesNotThrow(() => writeSeen(null, '0.3.0'));
    assert.doesNotThrow(() => writeSeen(throwing, '0.3.0'));
  });
  test('readCollapsed maps 1 and 0, everything else falls back', () => {
    assert.equal(readCollapsed(memory({ [COLLAPSE_KEY]: '1' })), true);
    assert.equal(readCollapsed(memory({ [COLLAPSE_KEY]: '0' }), COLLAPSE_KEY, true), false);
    assert.equal(readCollapsed(memory({ [COLLAPSE_KEY]: 'yes' })), false);
    assert.equal(readCollapsed(memory({ [COLLAPSE_KEY]: 'yes' }), COLLAPSE_KEY, true), true);
    assert.equal(readCollapsed(memory(), COLLAPSE_KEY, true), true);
    assert.equal(readCollapsed(null), false);
    assert.equal(readCollapsed(null, COLLAPSE_KEY, true), true);
    assert.equal(readCollapsed(throwing, COLLAPSE_KEY, true), true);
  });
  test('writeCollapsed writes 1 or 0; null and throwing stores are no-ops', () => {
    const s = memory();
    writeCollapsed(s, true);
    assert.equal(s.m.get(COLLAPSE_KEY), '1');
    writeCollapsed(s, false, 'k');
    assert.equal(s.m.get('k'), '0');
    assert.doesNotThrow(() => writeCollapsed(null, true));
    assert.doesNotThrow(() => writeCollapsed(throwing, true));
  });
});

describe('isTypingTarget', () => {
  test('text fields, textarea, select, contenteditable and text roles are typing targets', () => {
    assert.equal(isTypingTarget(el('INPUT', { type: 'text' })), true);
    assert.equal(isTypingTarget(el('input', { type: 'search' })), true);
    assert.equal(isTypingTarget(el('INPUT')), true);
    assert.equal(isTypingTarget(el('TEXTAREA')), true);
    assert.equal(isTypingTarget(el('SELECT')), true);
    assert.equal(isTypingTarget(el('DIV', { isContentEditable: true })), true);
    for (const role of ['textbox', 'searchbox', 'combobox', 'spinbutton']) {
      assert.equal(isTypingTarget(el('DIV', { attrs: { role } })), true, role);
    }
  });
  test('button-like inputs and plain elements are not', () => {
    for (const type of ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']) {
      assert.equal(isTypingTarget(el('INPUT', { type })), false, type);
    }
    for (const tag of ['BUTTON', 'A', 'DIV']) assert.equal(isTypingTarget(el(tag)), false, tag);
    assert.equal(isTypingTarget(null), false);
    assert.equal(isTypingTarget('INPUT'), false);
    assert.equal(isTypingTarget(undefined), false);
  });
});

describe('shortcuts', () => {
  test('[ toggles only bare, outside text fields', () => {
    assert.equal(isCollapseShortcut({ key: '[' }), true);
    assert.equal(isCollapseShortcut({ key: '[', target: el('BUTTON') }), true);
    assert.equal(isCollapseShortcut({ key: ']' }), false);
    for (const mod of ['metaKey', 'ctrlKey', 'altKey', 'repeat', 'isComposing', 'defaultPrevented']) {
      assert.equal(isCollapseShortcut({ key: '[', [mod]: true }), false, mod);
    }
    assert.equal(isCollapseShortcut({ key: '[', target: el('INPUT', { type: 'text' }) }), false);
    assert.equal(isCollapseShortcut({ key: '[', target: el('INPUT', { type: 'checkbox' }) }), true);
  });
  test('a custom shortcut key', () => {
    assert.equal(isCollapseShortcut({ key: '\\' }, '\\'), true);
    assert.equal(isCollapseShortcut({ key: '[' }, '\\'), false);
  });
  test('search chord is Meta or Ctrl plus K, also while typing, never with Alt or Shift', () => {
    assert.equal(isSearchShortcut({ key: 'k', metaKey: true }), true);
    assert.equal(isSearchShortcut({ key: 'K', ctrlKey: true }), true);
    assert.equal(isSearchShortcut({ key: 'k', ctrlKey: true, target: el('INPUT', { type: 'text' }) }), true);
    assert.equal(isSearchShortcut({ key: 'k' }), false);
    assert.equal(isSearchShortcut({ key: 'k', metaKey: true, altKey: true }), false);
    assert.equal(isSearchShortcut({ key: 'k', metaKey: true, shiftKey: true }), false);
    assert.equal(isSearchShortcut({ key: 'j', metaKey: true }), false);
  });
  test('shortcut label per platform', () => {
    assert.equal(shortcutLabel(true), '⌘K');
    assert.equal(shortcutLabel(false), 'Ctrl K');
  });
});

describe('releases', () => {
  const rel = (version, date = '2026-01-01') => ({ version, date, changes: [] });
  test('visibleReleases drops invalid and future versions, sorts newest first, does not mutate', () => {
    const input = [rel('0.2.0'), rel('bad'), rel('0.4.0'), rel('0.3.0'), rel('0.10.0')];
    const copy = JSON.stringify(input);
    assert.deepEqual(visibleReleases(input, '0.3.0').map((r) => r.version), ['0.3.0', '0.2.0']);
    assert.deepEqual(visibleReleases(input, 'v0.10.0').map((r) => r.version), ['0.10.0', '0.4.0', '0.3.0', '0.2.0']);
    assert.equal(JSON.stringify(input), copy);
    assert.notEqual(visibleReleases(input, '0.3.0'), input);
  });
  test('isFresh: first visit brightens only the newest; later, everything after last-seen', () => {
    assert.equal(isFresh('0.3.0', null, '0.3.0'), true);
    assert.equal(isFresh('0.2.0', null, '0.3.0'), false);
    assert.equal(isFresh('0.3.0', 'junk', '0.3.0'), true);
    assert.equal(isFresh('0.3.0', '0.2.0', '0.3.0'), true);
    assert.equal(isFresh('0.2.0', '0.2.0', '0.3.0'), false);
    assert.equal(isFresh('0.1.0', '0.2.0', '0.3.0'), false);
  });
  test('sortChanges is stable by kind, unknown kinds last, input untouched', () => {
    const input = [
      { kind: 'fixed', text: 'f1' }, { kind: 'odd', text: 'x1' }, { kind: 'new', text: 'n1' },
      { kind: 'improved', text: 'i1' }, { kind: 'new', text: 'n2' }, { kind: 'other', text: 'x2' },
    ];
    const copy = JSON.stringify(input);
    assert.deepEqual(sortChanges(input).map((c) => c.text), ['n1', 'n2', 'i1', 'f1', 'x1', 'x2']);
    assert.equal(JSON.stringify(input), copy);
  });
  test('kindLabel and changeTone', () => {
    assert.equal(kindLabel('new'), 'New');
    assert.equal(kindLabel('improved'), 'Improved');
    assert.equal(kindLabel('fixed'), 'Fixed');
    assert.equal(kindLabel('constructor'), 'Changed');
    assert.equal(kindLabel('removed'), 'Changed');
    assert.equal(changeTone('new', true), 'bloom');
    assert.equal(changeTone('improved', true), 'neutral');
    assert.equal(changeTone('fixed', true), 'ok');
    assert.equal(changeTone('removed', true), 'neutral');
    for (const k of ['new', 'improved', 'fixed', 'removed']) assert.equal(changeTone(k, false), 'neutral', k);
  });
  test('formatReleaseDate formats ISO dates in UTC; anything else passes through', () => {
    assert.equal(formatReleaseDate('2026-10-23'), 'Oct 23, 2026');
    assert.equal(formatReleaseDate('2026-01-01', 'en-US'), 'Jan 1, 2026');
    assert.equal(formatReleaseDate('next week'), 'next week');
    assert.equal(formatReleaseDate('2026-02-30'), '2026-02-30');
  });
  test('malformed release input fails closed instead of throwing', () => {
    assert.equal(formatReleaseDate('2026-10-26', 'en_US'), '2026-10-26');
    assert.equal(formatReleaseDate('2026-10-26', 'en_US!!'), '2026-10-26');
    assert.equal(formatReleaseDate('2026-10-26', ''), '2026-10-26');
    assert.deepEqual(sortChanges(undefined), []);
    assert.deepEqual(sortChanges(null), []);
    assert.deepEqual(sortChanges([null, { kind: 'new', text: 'n1' }]).map((c) => c.text), ['n1']);
    assert.deepEqual(visibleReleases(null, '1.0.0'), []);
    assert.deepEqual(visibleReleases([null], '1.0.0'), []);
    const noChanges = { version: '0.9.0', date: '2026-01-01' };
    const numeric = { version: 1, date: '2026-01-01', changes: [] };
    assert.deepEqual(visibleReleases([noChanges, numeric, null, rel('0.8.0')], '1.0.0').map((r) => r.version), ['0.8.0']);
  });
});

describe('counts, initials, rail tip', () => {
  test('unreadCount counts unread === true only', () => {
    assert.equal(unreadCount([{ unread: true }, { unread: false }, { unread: true }]), 2);
    assert.equal(unreadCount([]), 0);
  });
  test('badgeCount: nothing at zero or below, 99+ above 99, whole numbers otherwise', () => {
    assert.equal(badgeCount(0), null);
    assert.equal(badgeCount(-3), null);
    assert.equal(badgeCount(Number.NaN), null);
    assert.equal(badgeCount(Number.POSITIVE_INFINITY), null);
    assert.equal(badgeCount(0.5), null);
    assert.equal(badgeCount(3), '3');
    assert.equal(badgeCount(4.7), '4');
    assert.equal(badgeCount(99), '99');
    assert.equal(badgeCount(100), '99+');
  });
  test('initials: two words, one word, hyphens, empty', () => {
    assert.equal(initials('Northwind Labs'), 'NL');
    assert.equal(initials('kai webb'), 'KW');
    assert.equal(initials('Orbit'), 'OR');
    assert.equal(initials('Jean-Luc Picard'), 'JL');
    assert.equal(initials('  '), '?');
    assert.equal(initials(''), '?');
    assert.equal(initials('émile zola'), 'ÉZ');
  });
  test('railTipPosition sits the tip beside the anchor, vertically centred', () => {
    assert.deepEqual(railTipPosition({ top: 100, right: 72, height: 40 }), { x: 84, y: 120 });
    assert.deepEqual(railTipPosition({ top: 0, right: 60, height: 20 }, 4), { x: 64, y: 10 });
  });
});

describe('safeHref', () => {
  test('relative paths, fragments, http, https and mailto pass through', () => {
    for (const ok of ['/path', '#a', 'https://a.b', 'mailto:a@b.c', 'http://a.b/x', 'page?x=1', 'HTTPS://A.B']) assert.equal(safeHref(ok), ok, ok);
  });
  test('every other scheme, in any case and behind whitespace or control chars, becomes #', () => {
    for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:x', 'data:text/html,x', '\u0000javascript:x', 'java\tscript:x', 'vbscript:x', 'file:///etc/passwd']) assert.equal(safeHref(bad), '#', JSON.stringify(bad));
  });
  test('non-strings become #', () => {
    assert.equal(safeHref(undefined), '#');
    assert.equal(safeHref(null), '#');
  });
});

describe('withDefaults', () => {
  test('undefined values keep the default; other values win; defaults are not mutated', () => {
    const d = { a: 'A', b: 'B', f: (n) => `n${n}` };
    const out = withDefaults(d, { a: undefined, b: 'b', f: undefined });
    assert.equal(out.a, 'A');
    assert.equal(out.b, 'b');
    assert.equal(out.f(2), 'n2');
    assert.equal(d.b, 'B');
    assert.deepEqual(withDefaults(d, undefined), d);
  });
});
