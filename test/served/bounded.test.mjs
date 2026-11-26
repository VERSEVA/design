// The bounded section (.bounded) on /components: a section's height never grows with its data.
// The specimen holds the four contract states (empty, fewer than the cap, exactly the cap, more
// than the cap). At the cap and at the cap plus 40 the two sections are the same height, and
// rows pushed into a section at the cap do not move it: the CSS drops them, whatever the host
// sends. The count row reads "+N more" above the cap and is absent at or below it. An override
// (data-cap) changes the cap and a value the CSS does not know falls back to the default, so no
// value leaves a section unbounded. Dark and light, desktop and phone.
// A second page, served only by this run from the package's own tokens.css and components.css,
// holds the table form (rows on a tbody), plain and inside .glass, and the Show all rule: the
// action shows at the cap and above, and below the cap only with data-all="always".
// Runs after `npm run studio:build && npm run assemble` (npm run test:served).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';

const CAP = 5;

/* The table form and the Show all rule, on the shipped CSS alone. */
const TABLE_PAGE = (theme) => `/__probe/bounded-${theme}`;
const tr = (i) => `<tr><td>Q-${2081 - i}</td><td>Northline Foods</td><td class="num">${48220 - i * 917}.00</td></tr>`;
const lrow = (i) => `<div class="lrow"><span class="tx"><b>Q-${2081 - i}</b><span class="metaline">Northline Foods</span></span><span class="val">${48220 - i * 917}.00</span></div>`;
const foot = (n, cap, more = n > cap ? `+${n - cap} more` : '') => `<div class="bounded-foot"><p class="bounded-more" role="status">${more}</p><button class="btn btn-secondary sm bounded-all" type="button" aria-label="Show all Quotes">Show all</button></div>`;
const head = (id) => `<h3 class="bounded-name" id="${id}-n">Quotes</h3>`;
const table = (id, n) => `<section class="bounded" id="${id}" aria-labelledby="${id}-n">${head(id)}${n === 0
  ? '<div class="empty"><b>No quotes yet</b><button class="btn btn-secondary sm" type="button">New quote</button></div>'
  : `<table class="table"><thead><tr><th>Quote</th><th>Client</th><th class="num">Amount</th></tr></thead><tbody class="bounded-rows">${Array.from({ length: n }, (_, i) => tr(i)).join('')}</tbody></table>${foot(n, CAP)}`}</section>`;
/* the glass panel inside the section, round the table alone */
const inner = (id, n) => `<section class="bounded" id="${id}" aria-labelledby="${id}-n">${head(id)}<div class="glass"><table class="table"><thead><tr><th>Quote</th><th>Client</th><th class="num">Amount</th></tr></thead><tbody class="bounded-rows">${Array.from({ length: n }, (_, i) => tr(i)).join('')}</tbody></table></div>${foot(n, CAP)}</section>`;
const list = (id, n, attrs = '', cap = CAP, more) => `<section class="bounded" id="${id}" aria-labelledby="${id}-n"${attrs}>${head(id)}<div class="lrows bounded-rows">${Array.from({ length: n }, (_, i) => lrow(i)).join('')}</div>${foot(n, cap, more)}</section>`;
const tablePage = (theme) => `<!doctype html><html data-theme="${theme}"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/components.css"><body>
${[0, 3, CAP, CAP + 40].map((n) => table(`t${n}`, n)).join('')}
${[3, CAP, CAP + 40].map((n) => `<div class="glass">${table(`g${n}`, n)}</div>`).join('')}
${[CAP, CAP + 40].map((n) => inner(`i${n}`, n)).join('')}
${list('below', 3)}${list('below-always', 3, ' data-all="always"')}${list('at', CAP)}${list('cap3-at', 3, ' data-cap="3"', 3)}${list('cap8-below', CAP, ' data-cap="8"', 8)}${list('cap8-always', CAP, ' data-cap="8" data-all="always"', 8)}${list('odd-below', 3, ' data-cap="99"')}${list('short-page', 3, '', CAP, '+7 more')}${list('short-page-cap8', 3, ' data-cap="8"', 8, '+7 more')}
</body></html>`;

let run;
before(async () => { run = await start({ extra: { [TABLE_PAGE('dark')]: tablePage('dark'), [TABLE_PAGE('light')]: tablePage('light') } }); });
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
      moreHeight: more ? more.getBoundingClientRect().height : null,
      allShown: !!all && all.getClientRects().length > 0,
      allHeight: all ? all.getBoundingClientRect().height : 0,
      allGap: all && more ? all.getBoundingClientRect().left - more.getBoundingClientRect().right : null,
      allRight: all ? rows.getBoundingClientRect().right - all.getBoundingClientRect().right : null,
      nameSize: getComputedStyle(sec.querySelector('.bounded-name')).fontSize,
      rowSize: rows && rows.querySelector('b') ? getComputedStyle(rows.querySelector('b')).fontSize : null,
      radius: sec.querySelector('.empty') ? getComputedStyle(sec.querySelector('.empty')).borderRadius : getComputedStyle(rows).borderRadius,
      moreRole: more ? more.getAttribute('role') : null,
      moreColor: more ? getComputedStyle(more).color : null,
      moreFont: more ? getComputedStyle(more).fontFamily : null,
      moreCase: more ? getComputedStyle(more).textTransform : null,
      all: all ? (all.getAttribute('aria-label') || all.textContent) : null,
      allText: all ? all.textContent : null,
      empty: !!sec.querySelector('.empty'),
    };
  };
  const secs = [...tile.querySelectorAll('.bounded')].filter((s) => !s.querySelector('.table'));
  const states = secs.map(read);
  const tableSec = tile.querySelector('.bounded:has(.table)');
  let table = null;
  if (tableSec) {
    table = read(tableSec);
    table.columns = tableSec.querySelectorAll('thead th').length;
    table.closing = getComputedStyle(tableSec.querySelector('.table')).borderBottomWidth;
    const hidden = [...tableSec.querySelector('.bounded-rows').children].slice(${CAP});
    const parent = tableSec.querySelector('.bounded-rows');
    hidden.forEach((r) => r.remove());
    table.heightAtCap = tableSec.getBoundingClientRect().height;
    hidden.forEach((r) => parent.appendChild(r));
  }
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
  return JSON.stringify({ tile: true, mode: el.dataset.theme === 'light' ? 'light' : 'dark', states, table, grown, caps, text2, text2Rgb, bodyFont, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
})()`;

for (const scheme of ['dark', 'light']) for (const width of [1280, 375]) {
  test(`the bounded section holds its height at ${width}px in ${scheme}`, { timeout: 120000 }, async (t) => {
    const page = await run.page({ width, height: 900, scheme });
    await page.goto('/components');
    const r = JSON.parse(await page.evaluate(PROBE));
    await page.close();
    assert.ok(r.tile, '/components has no #bounded specimen');
    assert.equal(r.mode, scheme);
    t.diagnostic(`list ${scheme} ${width}px: ${r.states.map((s) => `${s.rows} rows ${s.height}px`).join(', ')}`);

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

    /* the count: "+N more" above the cap, no text at or below it. The status line is there
       whenever the section has rows, so the step from 5 rows to 6 is announced. */
    assert.equal(more.more, '+40 more');
    assert.deepEqual([none.more, few.more, cap.more], [null, '', '']);
    assert.deepEqual([few.moreRole, cap.moreRole, more.moreRole], ['status', 'status', 'status']);
    assert.deepEqual([few.moreHeight, cap.moreHeight], [0, 0], 'an empty count takes no room');
    assert.equal(more.moreColor, r.text2Rgb, 'quiet body text on --text-2');
    assert.equal(more.moreFont, r.bodyFont, 'never mono');
    assert.equal(more.moreCase, 'none', 'never uppercase');

    /* the action: at the cap and above, named Show all, with the section's name in its accessible name */
    for (const s of [cap, more]) {
      assert.equal(s.allText, 'Show all', s.name);
      assert.ok(s.allShown, s.name);
      assert.ok(s.name && s.all.startsWith('Show all') && s.all.toLowerCase().includes(s.name.toLowerCase()), `"${s.all}" names "${s.name}"`);
      assert.ok(Math.abs(s.allRight) < 0.5, `${s.name}: the action sits on the trailing edge (${s.allRight}px off)`);
    }
    assert.ok(none.empty, 'the empty state says what belongs here');
    assert.equal(none.all, null, 'nothing to show all of');
    assert.equal(few.allShown, false, 'below the cap nothing is hidden, so there is no Show all');

    /* the count sits beside its own action, 12px away (--s-3), not across the section */
    assert.equal(more.allGap, 12);
    /* the name leads: at least the row label's size */
    assert.ok(parseFloat(more.nameSize) >= 16 && parseFloat(more.nameSize) > parseFloat(more.rowSize), `name ${more.nameSize}, row ${more.rowSize}`);
    /* one radius across states */
    assert.equal(none.radius, more.radius);

    /* the override: 1 to 12 rows; anything else is the default, never unbounded */
    assert.deepEqual(r.caps, { 3: 3, 8: 8, 12: 12, 99: CAP, x: CAP });

    /* the table specimen: the same rule on a tbody */
    assert.ok(r.table, '#bounded has no bounded table');
    t.diagnostic(`table specimen ${scheme} ${width}px: ${r.table.rows} rows ${r.table.height}px, ${CAP} rows ${r.table.heightAtCap}px`);
    assert.deepEqual([r.table.rows, r.table.shown, r.table.more, r.table.allShown, r.table.closing], [CAP + 40, CAP, '+40 more', true, '1px']);
    assert.equal(r.table.height, r.table.heightAtCap, `table: ${r.table.heightAtCap}px at ${CAP} rows, ${r.table.height}px at ${CAP + 40}`);
    assert.ok(r.table.name && r.table.all.toLowerCase().includes(r.table.name.toLowerCase()));

    assert.ok(r.scrollWidth <= r.clientWidth, `no sideways scroll (${r.scrollWidth} vs ${r.clientWidth})`);
  });
}

const TABLE_PROBE = `(async () => {
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 300));
  const out = {};
  for (const sec of document.querySelectorAll('.bounded')) {
    const rows = sec.querySelector('.bounded-rows');
    const all = sec.querySelector('.bounded-all');
    out[sec.id] = {
      height: sec.getBoundingClientRect().height,
      shown: rows ? [...rows.children].filter((r) => r.getClientRects().length > 0).length : 0,
      all: !!all && all.getClientRects().length > 0,
      allHeight: all ? all.getBoundingClientRect().height : 0,
      closing: sec.querySelector('.table') ? getComputedStyle(sec.querySelector('.table')).borderBottomWidth : null,
    };
  }
  const t = document.querySelector('#t${CAP} .bounded-rows');
  const before = out.t${CAP}.height;
  const added = Array.from({ length: 40 }, () => t.appendChild(t.lastElementChild.cloneNode(true)));
  out.grown = { before, after: document.querySelector('#t${CAP}').getBoundingClientRect().height };
  added.forEach((r) => r.remove());
  out.coarse = matchMedia('(pointer:coarse)').matches;
  out.coarseRule = [...document.styleSheets].flatMap((sh) => [...sh.cssRules]).filter((r) => r.media && /pointer:\\s*coarse/.test(r.conditionText))
    .flatMap((r) => [...r.cssRules]).filter((r) => r.selectorText === '.bounded-all').map((r) => r.style.minHeight)[0] ?? null;
  out.theme = document.documentElement.dataset.theme;
  out.scrollWidth = document.documentElement.scrollWidth; out.clientWidth = document.documentElement.clientWidth;
  return JSON.stringify(out);
})()`;

for (const scheme of ['dark', 'light']) for (const width of [1280, 375]) {
  test(`a bounded table holds its height, plain and in glass, at ${width}px in ${scheme}`, { timeout: 60000 }, async (ctx) => {
    const page = await run.page({ width, height: 900, scheme });
    await page.goto(TABLE_PAGE(scheme));
    const r = JSON.parse(await page.evaluate(TABLE_PROBE));
    await page.close();
    assert.equal(r.theme, scheme);
    const t = (n) => r[`t${n}`], g = (n) => r[`g${n}`];
    ctx.diagnostic(`table ${scheme} ${width}px: ${[0, 3, CAP, CAP + 40].map((n) => `${n} rows ${t(n).height}px`).join(', ')}; in glass: ${[3, CAP, CAP + 40].map((n) => `${n} rows ${g(n).height}px`).join(', ')}`);

    assert.deepEqual([t(0).shown, t(3).shown, t(CAP).shown, t(CAP + 40).shown], [0, 3, CAP, CAP]);
    assert.ok(t(CAP).height > 0);
    assert.equal(t(CAP + 40).height, t(CAP).height, `plain table: ${t(CAP).height}px at ${CAP} rows, ${t(CAP + 40).height}px at ${CAP + 40}`);
    assert.equal(g(CAP + 40).height, g(CAP).height, `table in glass: ${g(CAP).height}px at ${CAP} rows, ${g(CAP + 40).height}px at ${CAP + 40}`);
    assert.equal(r.grown.after, r.grown.before, 'rows pushed into the table at the cap do not move it');
    assert.ok(t(3).height < t(CAP).height && g(3).height < g(CAP).height && t(0).height <= t(CAP).height);

    /* Show all: at the cap and above; below the cap only with data-all="always". The cap is the section's own.
       A first page shorter than the cap with more rows behind it (3 shown, "+7 more") keeps its way to them. */
    assert.deepEqual(
      { shortPage: r['short-page'].all, shortPageCap8: r['short-page-cap8'].all, below: r.below.all, belowAlways: r['below-always'].all, at: r.at.all, cap3At: r['cap3-at'].all, cap8Below: r['cap8-below'].all, cap8Always: r['cap8-always'].all, oddBelow: r['odd-below'].all, table3: t(3).all, table5: t(CAP).all, glass3: g(3).all },
      { shortPage: true, shortPageCap8: true, below: false, belowAlways: true, at: true, cap3At: true, cap8Below: false, cap8Always: true, oddBelow: false, table3: false, table5: true, glass3: false },
    );
    /* a table outside glass closes with a line above the foot; glass draws its own edge */
    assert.deepEqual([t(CAP).closing, t(CAP + 40).closing, g(CAP).closing], ['1px', '1px', '0px']);
    /* either nesting: glass round the section, or glass inside it round the table */
    const i = (n) => r[`i${n}`];
    assert.deepEqual([i(CAP).closing, i(CAP + 40).closing, i(CAP).shown, i(CAP + 40).shown], ['0px', '0px', CAP, CAP]);
    assert.equal(i(CAP + 40).height, i(CAP).height, `glass inside the section: ${i(CAP).height}px at ${CAP} rows, ${i(CAP + 40).height}px at ${CAP + 40}`);
    /* no dead room under a section with nothing more to show */
    assert.ok(r['below-always'].height > r.below.height);

    /* a 44px target for a finger: the served sheet carries the rule, and the action follows the pointer it has */
    assert.equal(r.coarseRule, '44px');
    assert.equal(r.at.allHeight, r.coarse ? 44 : 32);
    assert.ok(r.scrollWidth <= r.clientWidth, `no sideways scroll (${r.scrollWidth} vs ${r.clientWidth})`);
  });
}
