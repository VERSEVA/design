// The bounded section (.bounded) on /components: a section's height never grows with its data.
// The specimen holds the four contract states (empty, fewer than the cap, exactly the cap, more
// than the cap). At the cap and at the cap plus 40 the two sections are the same height, and
// rows pushed into a section at the cap do not move it: the CSS drops them, whatever the host
// sends. The count row reads "+N more" above the cap and is absent at or below it. An override
// (data-cap) changes the cap and a value the CSS does not know falls back to the default, so no
// value leaves a section unbounded. Dark and light, desktop and phone.
// Runs after `npm run studio:build && npm run assemble` (npm run test:served).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';

const CAP = 5;

let run;
before(async () => { run = await start(); });
after(async () => { await run?.stop(); });

const PROBE = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(1200);
  document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
  await sleep(200);
  const tile = document.querySelector('#bounded');
  if (!tile) return JSON.stringify({ tile: false });
  const shown = (sec) => [...sec.querySelector('.bounded-rows').children].filter((r) => r.getClientRects().length > 0).length;
  const read = (sec) => {
    const rows = sec.querySelector('.bounded-rows');
    const more = sec.querySelector('.bounded-more');
    const all = sec.querySelector('.bounded-all');
    const name = document.getElementById(sec.getAttribute('aria-labelledby'))?.textContent ?? '';
    return {
      name,
      rows: rows ? rows.children.length : 0,
      shown: rows ? shown(sec) : 0,
      height: sec.getBoundingClientRect().height,
      more: more ? more.textContent : null,
      moreRole: more ? more.getAttribute('role') : null,
      moreColor: more ? getComputedStyle(more).color : null,
      moreFont: more ? getComputedStyle(more).fontFamily : null,
      moreCase: more ? getComputedStyle(more).textTransform : null,
      all: all ? (all.getAttribute('aria-label') || all.textContent) : null,
      allText: all ? all.textContent : null,
      empty: !!sec.querySelector('.empty'),
    };
  };
  const secs = [...tile.querySelectorAll('.bounded')];
  const states = secs.map(read);
  const atCap = secs.find((s) => s.querySelector('.bounded-rows')?.children.length === ${CAP});
  const over = secs.find((s) => (s.querySelector('.bounded-rows')?.children.length ?? 0) > ${CAP});
  const grown = {};
  if (atCap) {
    const rows = atCap.querySelector('.bounded-rows');
    const before = atCap.getBoundingClientRect().height;
    for (const n of [1, 40]) {
      const added = Array.from({ length: n }, () => rows.appendChild(rows.lastElementChild.cloneNode(true)));
      grown[n] = { before, after: atCap.getBoundingClientRect().height, shown: shown(atCap) };
      added.forEach((r) => r.remove());
    }
  }
  const caps = {};
  if (over) {
    for (const v of ['3', '8', '12', '99', 'x']) {
      over.setAttribute('data-cap', v);
      caps[v] = shown(over);
    }
    over.removeAttribute('data-cap');
  }
  const text2 = getComputedStyle(document.documentElement).getPropertyValue('--text-2').trim();
  const probe = document.createElement('span');
  probe.style.color = 'var(--text-2)';
  document.body.appendChild(probe);
  const text2Rgb = getComputedStyle(probe).color;
  const bodyFont = getComputedStyle(document.body).fontFamily;
  probe.remove();
  const el = document.documentElement;
  return JSON.stringify({ tile: true, mode: el.dataset.theme === 'light' ? 'light' : 'dark', states, grown, caps, text2, text2Rgb, bodyFont, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
})()`;

for (const scheme of ['dark', 'light']) for (const width of [1280, 375]) {
  test(`the bounded section holds its height at ${width}px in ${scheme}`, { timeout: 120000 }, async () => {
    const page = await run.page({ width, height: 900, scheme });
    await page.goto('/components');
    const r = JSON.parse(await page.evaluate(PROBE));
    await page.close();
    assert.ok(r.tile, '/components has no #bounded specimen');
    assert.equal(r.mode, scheme);

    /* the four contract states, in order */
    assert.deepEqual(r.states.map((s) => s.rows), [0, 3, CAP, CAP + 40], 'empty, fewer than the cap, exactly the cap, more than the cap');
    const [none, few, cap, more] = r.states;
    assert.deepEqual([none.shown, few.shown, cap.shown, more.shown], [0, 3, CAP, CAP], 'rows on screen');

    /* the seam: the height at the cap is the height at the cap plus 40 */
    assert.ok(cap.height > 0);
    assert.equal(more.height, cap.height, `at ${CAP} rows ${cap.height}px, at ${CAP + 40} rows ${more.height}px`);
    assert.ok(few.height < cap.height, 'fewer rows, a shorter section');
    assert.ok(none.height <= cap.height, 'the empty state is no taller than a full section');

    /* rows pushed into the section at the cap do not move it */
    for (const n of [1, 40]) {
      assert.equal(r.grown[n].after, r.grown[n].before, `${CAP} + ${n} rows: ${r.grown[n].before}px became ${r.grown[n].after}px`);
      assert.equal(r.grown[n].shown, CAP);
    }

    /* the count row: "+N more" above the cap, absent at or below it */
    assert.equal(more.more, '+40 more');
    assert.deepEqual([none.more, few.more, cap.more], [null, null, null]);
    assert.equal(more.moreRole, 'status', 'the count row is announced');
    assert.equal(more.moreColor, r.text2Rgb, 'quiet body text on --text-2');
    assert.equal(more.moreFont, r.bodyFont, 'never mono');
    assert.equal(more.moreCase, 'none', 'never uppercase');

    /* the action: named Show all, with the section's name in its accessible name */
    for (const s of [few, cap, more]) {
      assert.equal(s.allText, 'Show all', s.name);
      assert.ok(s.name && s.all.startsWith('Show all') && s.all.toLowerCase().includes(s.name.toLowerCase()), `"${s.all}" names "${s.name}"`);
    }
    assert.ok(none.empty, 'the empty state says what belongs here');
    assert.equal(none.all, null, 'nothing to show all of');

    /* the override: 1 to 12 rows; anything else is the default, never unbounded */
    assert.deepEqual(r.caps, { 3: 3, 8: 8, 12: 12, 99: CAP, x: CAP });

    assert.ok(r.scrollWidth <= r.clientWidth, `no sideways scroll (${r.scrollWidth} vs ${r.clientWidth})`);
  });
}
