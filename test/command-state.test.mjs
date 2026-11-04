// Command bar logic (react/command-state.ts, 1.6). Node strips the types on import.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASK_GROUP, normalize, isQuestion, matches, filterCommands, groupOrder, shouldAsk,
  buildSections, moveSelection, firstSelectable, isAsyncIterable, resultCount,
} from '../react/command-state.ts';

const C = [
  { group: 'Actions', label: 'New invoice' },
  { group: 'Go to', label: 'Invoices' },
  { group: 'Actions', label: 'Deploy studio' },
  { group: 'Recent', label: 'Kestrel Co', keywords: ['client'] },
  { group: 'Go to', label: 'Clients' },
  { group: 'Actions', label: 'Café report', disabled: true },
];
const labels = (list) => list.map((c) => c.label);
const flat = (r) => r.options.map((o) => (o.kind === 'ask' ? `ask:${o.question}` : o.command.label));

describe('normalize and matching', () => {
  test('case, accents and runs of whitespace fold', () => {
    assert.equal(normalize('  Café   REPORT '), 'cafe report');
  });
  test('every word must appear in the label, group or keywords', () => {
    assert.equal(matches(C[0], 'inv new'), true);
    assert.equal(matches(C[0], 'new client'), false);
    assert.equal(matches(C[3], 'client'), true, 'keywords count');
    assert.equal(matches(C[1], 'go'), true, 'group counts');
    assert.equal(matches(C[5], 'cafe'), true, 'accent-insensitive');
  });
  test('an empty query matches everything', () => {
    assert.deepEqual(labels(filterCommands(C, '   ')), labels(C));
  });
});

describe('group order', () => {
  test('groups keep the order they first appear in; commands keep theirs inside a group', () => {
    assert.deepEqual(groupOrder(C), ['Actions', 'Go to', 'Recent']);
    const r = buildSections(C, '', { canAsk: true });
    assert.deepEqual(r.sections.map((s) => s.group), ['Actions', 'Go to', 'Recent']);
    assert.deepEqual(flat(r), ['New invoice', 'Deploy studio', 'Café report', 'Invoices', 'Clients', 'Kestrel Co']);
  });
  test('filtering keeps that order and drops empty groups', () => {
    const r = buildSections(C, 'invoice', { canAsk: false });
    assert.deepEqual(r.sections.map((s) => s.group), ['Actions', 'Go to']);
    assert.deepEqual(flat(r), ['New invoice', 'Invoices']);
  });
  test('the flat index of every option matches its place across sections', () => {
    const r = buildSections(C, '', { canAsk: false });
    const fromSections = r.sections.flatMap((s) => s.options);
    assert.deepEqual(fromSections, r.options);
    r.options.forEach((o, i) => assert.equal(o.index, i));
  });
});

describe('ask detection', () => {
  test('a trailing question mark, a leading question word, Tab, or no matches', () => {
    assert.equal(isQuestion('revenue this month?'), true);
    assert.equal(isQuestion('What was revenue'), true);
    assert.equal(isQuestion('how do I invite'), true);
    assert.equal(isQuestion('can i export'), true);
    assert.equal(shouldAsk('invoices', 1, { canAsk: true, forced: true }), true, 'Tab');
    assert.equal(shouldAsk('zebra', 0, { canAsk: true }), true, 'no matches');
  });
  test('a curly apostrophe (iOS smart punctuation) folds to a straight one', () => {
    assert.equal(normalize('What\u2019s due'), "what's due");
    assert.equal(isQuestion('what\u2019s due today'), true);
    assert.equal(isQuestion('who\u2019s on call'), true);
  });
  test('words that only start like a question word are not questions', () => {
    for (const s of ['whatever', 'issue refund', 'invoices', 'howl', 'canvas', 'dodo']) assert.equal(isQuestion(s), false, s);
  });
  test('a plain match does not ask', () => {
    assert.equal(shouldAsk('invoices', 1, { canAsk: true }), false);
  });
  test('never without onAsk, whatever the query', () => {
    for (const [q, hits, forced] of [['what is up?', 0, true], ['zebra', 0, false], ['invoices', 1, true]]) {
      assert.equal(shouldAsk(q, hits, { canAsk: false, forced }), false, q);
    }
    const r = buildSections(C, 'what was revenue?', { canAsk: false });
    assert.equal(r.asking, false);
    assert.deepEqual(r.options, [], 'no Ask row: the no-results state');
  });
  test('an empty query never asks, even on Tab', () => {
    assert.equal(shouldAsk('   ', 0, { canAsk: true, forced: true }), false);
  });
  test('the Ask row leads, in its own group, carrying the trimmed question', () => {
    const r = buildSections(C, '  which invoices are late? ', { canAsk: true });
    assert.equal(r.asking, true);
    assert.equal(r.sections[0].group, ASK_GROUP);
    assert.deepEqual(flat(r)[0], 'ask:which invoices are late?');
    assert.equal(r.options[0].index, 0);
  });
  test('no matches with onAsk leaves the Ask row alone', () => {
    const r = buildSections(C, 'zebra', { canAsk: true });
    assert.deepEqual(flat(r), ['ask:zebra']);
  });
  test('forced ask keeps the matches under the Ask row', () => {
    const r = buildSections(C, 'invoice', { canAsk: true, forced: true });
    assert.deepEqual(flat(r), ['ask:invoice', 'New invoice', 'Invoices']);
  });
});

describe('results count', () => {
  test('counts commands only, never the Ask row', () => {
    assert.equal(resultCount(buildSections(C, 'zebra', { canAsk: true })), 0);
    assert.equal(resultCount(buildSections(C, 'invoice', { canAsk: true, forced: true })), 2);
    assert.equal(resultCount(buildSections(C, 'invoice', { canAsk: false })), 2);
  });
});

describe('selection', () => {
  const opts = [{}, { disabled: true }, {}, {}];
  test('wraps both ways', () => {
    assert.equal(moveSelection(3, 1, opts), 0);
    assert.equal(moveSelection(0, -1, opts), 3);
  });
  test('skips disabled options', () => {
    assert.equal(moveSelection(0, 1, opts), 2);
    assert.equal(moveSelection(2, -1, opts), 0);
  });
  test('first selectable skips a disabled head', () => {
    assert.equal(firstSelectable([{ disabled: true }, {}]), 1);
  });
  test('nothing to select is -1', () => {
    assert.equal(moveSelection(0, 1, []), -1);
    assert.equal(firstSelectable([{ disabled: true }]), -1);
    assert.equal(moveSelection(0, 1, [{ disabled: true }]), -1);
  });
  test('a stale index (list shrank) recovers to a selectable option', () => {
    assert.equal(moveSelection(9, 1, opts), 0);
    assert.equal(moveSelection(-1, 1, opts), 0);
    assert.equal(moveSelection(-1, -1, opts), 3);
  });
  test('disabled commands carry their flag into the options', () => {
    const r = buildSections(C, 'cafe', { canAsk: false });
    assert.equal(r.options[0].disabled, true);
    assert.equal(firstSelectable(r.options), -1);
  });
});

describe('answers', () => {
  test('async iterables are told apart from plain answers', () => {
    async function* gen() { yield 'a'; }
    assert.equal(isAsyncIterable(gen()), true);
    assert.equal(isAsyncIterable({ text: 'a' }), false);
    assert.equal(isAsyncIterable(null), false);
    assert.equal(isAsyncIterable('text'), false);
  });
});
