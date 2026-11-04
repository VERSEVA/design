// Class-name rule (1.6): a class components.css adds after 1.5.0 must not be a
// generic word that a consumer app is likely to own. The prototype for 1.6 hit
// this from the consumer side twice: its own .bar and .tab picked up the package's
// globals. Existing names are grandfathered in test/fixtures/classes-1.5.0.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'components.css'), 'utf8');
const baseline = new Set(JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/classes-1.5.0.json'), 'utf8')).classes);

/* Words an app uses for its own parts. A new standalone class may not be one of these. */
const GENERIC = new Set(['active', 'actions', 'avatar', 'bar', 'bars', 'body', 'box', 'btn', 'button', 'card', 'cell', 'chart', 'chip', 'col', 'container', 'content', 'count', 'dot', 'dots', 'footer', 'grid', 'group', 'header', 'hint', 'icon', 'inner', 'item', 'items', 'label', 'layout', 'link', 'list', 'logo', 'main', 'meta', 'more', 'name', 'nav', 'open', 'outer', 'page', 'panel', 'pill', 'preview', 'progress', 'ring', 'row', 'section', 'sidebar', 'stack', 'step', 'tab', 'tabs', 'tag', 'text', 'tile', 'title', 'today', 'toolbar', 'top', 'value', 'week', 'widget', 'wrap', 'wrapper']);

/* Split on a separator at bracket depth 0. */
function splitTop(s, re) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (depth === 0 && re.test(ch)) { if (cur.trim()) out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/* Class names in one compound, after :is/:where/:matches are lifted out (they style what they list)
   and :not/:has/attribute contents dropped (they only filter). Escaped characters stay in the name. */
const NAME = /\.((?:[a-zA-Z_-]|\\.)(?:[\w-]|\\.)*)/g;
function compoundClasses(compound, lifted) {
  let c = compound.replace(/\[[^\]]*\]/g, '');
  c = c.replace(/:(?:is|where|matches)\(((?:[^()]|\([^()]*\))*)\)/g, (_, inner) => { lifted.push(inner); return ''; });
  c = c.replace(/:(?:not|has)\((?:[^()]|\([^()]*\))*\)/g, '').replace(/(?<!\\)::?[\w-]+(\([^)]*\))?/g, '');
  return { lead: /^[a-zA-Z*]*(#[\w-]+)?$/.test(c.split('.')[0]), names: [...c.matchAll(NAME)].map((m) => m[1]) };
}

/* Every class in a selector list, and whether it is ever standalone: the first class of a compound
   (after nothing, a tag or *), or any class compounded onto a generic one (.active.tab styles .tab). */
function selectorUse(list, use) {
  for (const part of splitTop(list, /,/)) {
    for (const compound of splitTop(part.trim(), /[\s>+~]/)) {
      const lifted = [];
      const { lead, names } = compoundClasses(compound, lifted);
      names.forEach((n, i) => use.set(n, use.get(n) || (i === 0 && lead) || (i > 0 && (GENERIC.has(names[0]) || names[0].length <= 3))));
      for (const inner of lifted) selectorUse(inner, use);
    }
  }
}

export function classUse(source) {
  const use = new Map();
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/([^{}]+)\{/g)) {
    const sel = m[1].trim();
    if (sel.startsWith('@') || /^(from|to|\d+%)/.test(sel)) continue;
    selectorUse(sel, use);
  }
  return use;
}

test('the 1.5.0 baseline is complete', () => {
  assert.ok(baseline.size > 200, `baseline has ${baseline.size} classes`);
});

test('no class added after 1.5.0 stands alone under a generic name', () => {
  const bad = [...classUse(css)].filter(([n, standalone]) => !baseline.has(n) && standalone && (GENERIC.has(n) || n.length <= 3)).map(([n]) => n);
  assert.deepEqual(bad, [], `generic standalone classes: ${bad.join(', ')}. Prefix them with their component (e.g. .lact-bar)`);
});

test('the rule catches the names the 1.6 prototype collided on', () => {
  const use = classUse('.bar{x:1} .tab.on{x:1} .lact-item .lact-bar{x:1} .wgrid .ring{x:1} .badge.neutral{x:1}');
  assert.equal(use.get('bar'), true);
  assert.equal(use.get('tab'), true);
  assert.equal(use.get('ring'), true);
  assert.equal(use.get('lact-bar'), true);
  assert.equal(use.get('neutral'), false);
});

test('the rule sees through :is, :where, tags and generic compounds (review of PR #1)', () => {
  const use = classUse(':where(.tabx){x:1} :is(.rowx, .barx){x:1} div.navx{x:1} *.cardx{x:1} .active.tabz{x:1} .lact:not(.hidex){x:1} [data-x="a .attrx"]{x:1} .sm\\:lact{x:1}');
  const more = classUse('.on.taby{x:1} .bd.rowy{x:1} #app.tabw{x:1}');
  for (const n of ['taby', 'rowy', 'tabw']) assert.equal(more.get(n), true, n);
  for (const n of ['tabx', 'rowx', 'barx', 'navx', 'cardx', 'tabz']) assert.equal(use.get(n), true, n);
  assert.notEqual(use.get('hidex'), true);
  assert.equal(use.has('attrx'), false);
  assert.equal(use.has('sm'), false);
});
