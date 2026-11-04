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

/* Every class in a selector, and whether it is ever the first class of a compound (standalone) or only a modifier. */
export function classUse(source) {
  const use = new Map();
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/([^{}]+)\{/g)) {
    const sel = m[1].trim();
    if (sel.startsWith('@') || /^(from|to|\d+%)/.test(sel)) continue;
    for (const part of sel.split(',')) {
      for (const compound of part.split(/[\s>+~]+/)) {
        const names = [...compound.replace(/\([^)]*\)/g, '').matchAll(/\.([a-zA-Z][\w-]*)/g)].map((x) => x[1]);
        names.forEach((n, i) => {
          const standalone = i === 0 && compound.trim().startsWith('.');
          use.set(n, (use.get(n) || false) || standalone);
        });
      }
    }
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
