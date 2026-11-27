// verseva board in headless Chrome (chrome.mjs): the switcher lists the manifest's themes,
// picking one applies it (data-brand, the theme sheet, the theme's own --accent), ?brand= opens
// one directly, an unknown id falls back to Baseline, and a hostile label stays text.
// Each test starts its own board and stops only that child, by the PID it spawned.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { start, root } from './chrome.mjs';

let run;
before(async () => { run = await start(); });
after(async () => { await run?.stop(); });

function board(manifest, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'bin', 'verseva.mjs'), 'board', '--manifest', manifest], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const t = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`board did not start: ${out}`)); }, 15000);
    child.stdout.on('data', (d) => {
      out += d;
      const m = out.match(/^verseva board: (http:\/\/127\.0\.0\.1:\d+\/)/m);
      if (m) { clearTimeout(t); resolve({ url: m[1], stop: () => new Promise((r) => { child.once('exit', r); child.kill('SIGTERM'); }) }); }
    });
    child.stderr.on('data', (d) => { out += d; });
    child.once('exit', (code) => { clearTimeout(t); reject(new Error(`board exited ${code}: ${out}`)); });
  });
}

const example = JSON.parse(fs.readFileSync(path.join(root, 'templates', 'theme-manifest.example.json'), 'utf8'));
/* the dark-mode accent each preset sets in its first [data-brand] block */
const accentOf = (id) => fs.readFileSync(path.join(root, 'themes', `${id}.css`), 'utf8').match(/\[data-brand="[^"]+"\] \{[^}]*--accent:\s*([^;]+);/)[1].trim();

const STATE = `JSON.stringify({
  brand: document.documentElement.dataset.brand ?? null,
  sheet: document.getElementById('board-theme')?.getAttribute('href') ?? null,
  accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  current: document.getElementById('board-current').textContent,
  checked: [...document.querySelectorAll('#board-themes [aria-checked="true"]')].map((i) => i.dataset.boardTheme),
  query: location.search,
})`;

const sleep = 'const sleep = (ms) => new Promise((r) => setTimeout(r, ms));';

test('the switcher lists the manifest themes and picking one applies it', { timeout: 90000 }, async () => {
  const b = await board('templates/theme-manifest.example.json', root);
  const page = await run.page({ width: 1440, height: 900 });
  try {
    await page.goto(b.url);
    const listed = JSON.parse(await page.evaluate(`JSON.stringify([...document.querySelectorAll('#board-themes [data-board-theme]')].map((i) => [i.dataset.boardTheme, i.textContent]))`));
    assert.deepEqual(listed, [['', 'Baseline'], ...example.themes.map((t) => [t.id, t.label])]);
    const base = JSON.parse(await page.evaluate(STATE));
    assert.deepEqual({ ...base, accent: undefined }, { brand: null, sheet: null, accent: undefined, current: 'Baseline', checked: [''], query: '' });

    for (const t of example.themes) {
      const s = JSON.parse(await page.evaluate(`(async () => { ${sleep}
        document.getElementById('board-current').click();
        /* the menu opens through the page's own inline script: it runs only if its CSP hash matches */
        if (document.getElementById('board-themes').hidden) throw new Error('menu did not open');
        document.querySelector('#board-themes [data-board-theme="${t.id}"]').click();
        await new Promise((r) => { const l = document.getElementById('board-theme'); if (l.sheet) r(); else l.addEventListener('load', r, { once: true }); });
        await sleep(50);
        if (!document.getElementById('board-themes').hidden) throw new Error('menu did not close');
        return ${STATE};
      })()`));
      assert.equal(s.brand, t.id);
      assert.equal(s.sheet, `/theme/${t.id}.css`);
      assert.equal(s.accent.toLowerCase(), accentOf(t.id).toLowerCase(), t.id);
      assert.notEqual(s.accent, base.accent, t.id);
      assert.equal(s.current, t.label);
      assert.deepEqual(s.checked, [t.id]);
      assert.equal(s.query, `?brand=${t.id}`);
    }

    /* back to Baseline: the theme sheet and data-brand both go */
    const back = JSON.parse(await page.evaluate(`(() => {
      document.getElementById('board-current').click();
      document.querySelector('#board-themes [data-board-theme=""]').click();
      return ${STATE};
    })()`));
    assert.deepEqual(back, base);

    /* a deep link opens a theme; an id the manifest does not name is Baseline */
    await page.goto(`${b.url}?brand=forest`);
    await page.evaluate(`new Promise((r) => { const l = document.getElementById('board-theme'); if (l.sheet) r(); else l.addEventListener('load', r, { once: true }); })`);
    const deep = JSON.parse(await page.evaluate(STATE));
    assert.equal(deep.brand, 'forest');
    assert.equal(deep.accent.toLowerCase(), accentOf('forest').toLowerCase());
    await page.goto(`${b.url}?brand=..%2Fpackage`);
    const bogus = JSON.parse(await page.evaluate(STATE));
    assert.equal(bogus.brand, null);
    assert.equal(bogus.sheet, null);
    assert.equal(bogus.query, '');
  } finally {
    await page.close();
    await b.stop();
  }
});

test('a hostile label renders as text in the switcher', { timeout: 60000 }, async () => {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-board-served-')));
  const label = '</script><b id="pwn">x</b><img src=x onerror="window.pwned=1">';
  fs.writeFileSync(path.join(cwd, 'probe.css'), '[data-brand="probe"] { --accent: var(--text-1); }\n');
  fs.writeFileSync(path.join(cwd, 'manifest.json'), JSON.stringify({ themes: [{ id: 'probe', label: label.slice(0, 64), css: 'probe.css' }] }));
  const b = await board('manifest.json', cwd);
  const page = await run.page({ width: 1440, height: 900 });
  try {
    await page.goto(b.url);
    const r = JSON.parse(await page.evaluate(`JSON.stringify({
      text: document.querySelector('#board-themes [data-board-theme="probe"]').textContent,
      pwn: !!document.getElementById('pwn'),
      pwned: !!window.pwned,
      switcher: !!document.getElementById('board-current'),
    })`));
    assert.deepEqual(r, { text: label.slice(0, 64), pwn: false, pwned: false, switcher: true });
  } finally {
    await page.close();
    await b.stop();
  }
});

/* --- Ratios and bans (P-8b) ------------------------------------------------------------- */

/** A working directory with the given themes ({ id, css, bans }) and a manifest naming them. */
function fixture(themes) {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-board-checks-')));
  for (const t of themes) fs.writeFileSync(path.join(cwd, `${t.id}.css`), t.css);
  fs.writeFileSync(path.join(cwd, 'manifest.json'), JSON.stringify({ themes: themes.map((t) => ({ id: t.id, label: t.id, css: `${t.id}.css`, ...(t.bans ? { bans: t.bans } : {}) })) }));
  return cwd;
}

/* Opens ?brand=<id> and waits until the checks were drawn for that brand and mode. */
async function checked(page, url, brand, mode = 'dark') {
  await page.goto(`${url}?brand=${brand}`);
  if (mode === 'light') await page.evaluate(`document.documentElement.dataset.theme = 'light'`);
  await page.evaluate(`new Promise((resolve, reject) => {
    const want = '${brand}|${mode}';
    const t = setTimeout(() => reject(new Error('checks never drawn for ' + want + ', got ' + document.getElementById('board-contrast').dataset.boardFor)), 10000);
    const poll = () => document.getElementById('board-contrast').dataset.boardFor === want && document.getElementById('board-bans').dataset.boardFor === want ? (clearTimeout(t), resolve()) : requestAnimationFrame(poll);
    poll();
  })`);
}

const RATIOS = `JSON.stringify([...document.querySelectorAll('#board-contrast tbody tr')].map((tr) => ({
  fg: tr.cells[0].textContent, bg: tr.cells[1].textContent, ratio: tr.cells[2].textContent, floor: tr.cells[3].textContent,
  result: tr.cells[4].textContent, pass: tr.dataset.pass, badge: tr.cells[4].querySelector('.badge')?.className,
})).concat([{ count: document.querySelector('#board-contrast [data-board-count]')?.textContent }]))`;

const BANS_STATE = `JSON.stringify({
  summary: [...document.querySelectorAll('#board-bans [data-board-ban]')].map((b) => [b.dataset.boardBan, b.dataset.pass, b.className, b.textContent]),
  rows: [...document.querySelectorAll('#board-bans tbody tr')].map((tr) => ({ ban: tr.cells[0].textContent, check: tr.cells[1].textContent, specimen: tr.cells[2].textContent, property: tr.cells[3].textContent, expect: tr.cells[4].textContent, checked: Number(tr.cells[5].textContent), pass: tr.dataset.pass, result: tr.cells[6].textContent })),
  head: [...document.querySelectorAll('#board-bans thead th')].map((th) => th.textContent),
})`;

/** The contrast gate's own verbose lines for a theme file: "<fg> on <chain>" -> "r.rr:1". */
function gateRatios(themeFile, slug, mode) {
  const out = execFileSync(process.execPath, [path.join(root, 'bin', 'contrast-gate.mjs'), '--tokens', path.join(root, 'tokens.css'), '--tokens', themeFile], { encoding: 'utf8', env: { ...process.env, VERSEVA_GATE_VERBOSE: '1' } });
  const rows = new Map();
  for (const m of out.matchAll(/ok \[([^\]]+)\] (\S+) on (\S+) {2}([\d.]+):1/g)) if (m[1] === `${slug}·${mode}`) rows.set(`${m[2]} on ${m[3]}`, `${m[4]}:1`);
  return rows;
}

test('ratios render live for every pair, equal to the contrast gate, in dark and light', { timeout: 90000 }, async () => {
  const { PAIRS } = await import('../../bin/contrast-pairs.mjs');
  const b = await board('templates/theme-manifest.example.json', root);
  const page = await run.page({ width: 1440, height: 900 });
  try {
    for (const mode of ['dark', 'light']) {
      await checked(page, b.url, 'cobalt', mode);
      const rows = JSON.parse(await page.evaluate(RATIOS));
      const count = rows.pop().count;
      assert.equal(rows.length, PAIRS.length);
      const gate = gateRatios(path.join(root, 'themes', 'cobalt.css'), 'cobalt', mode);
      assert.equal(gate.size, PAIRS.length, `gate printed ${gate.size} cobalt·${mode} pairs`);
      rows.forEach((row, i) => {
        const [fg, chain, floor] = PAIRS[i];
        assert.equal(row.fg, fg);
        assert.equal(row.bg, chain.join(' + '));
        assert.equal(row.floor, String(floor));
        assert.equal(row.ratio, gate.get(`${fg} on ${chain.join('+')}`), `${fg} on ${chain.join('+')} (${mode})`);
        assert.equal(row.pass, 'true');
        assert.equal(row.result, 'Pass');
        assert.equal(row.badge, 'badge ok');
      });
      assert.equal(count, `${PAIRS.length} of ${PAIRS.length} pass`);
    }
  } finally {
    await page.close();
    await b.stop();
  }
});

test('a failing pair is marked failed', { timeout: 60000 }, async () => {
  const cwd = fixture([{ id: 'lowc', css: '[data-brand="lowc"] { --text-3: var(--surface-2); }\n' }]);
  const b = await board('manifest.json', cwd);
  const page = await run.page({ width: 1440, height: 900 });
  try {
    await checked(page, b.url, 'lowc');
    const rows = JSON.parse(await page.evaluate(RATIOS));
    const count = rows.pop().count;
    const failed = rows.filter((r) => r.pass === 'false');
    assert.deepEqual(failed.map((r) => `${r.fg} on ${r.bg}`), ['text-3 on bg', 'text-3 on surface', 'text-3 on surface-2']);
    for (const r of failed) {
      assert.equal(r.result, 'Fail');
      assert.equal(r.badge, 'badge err');
      assert.ok(Number.parseFloat(r.ratio) < 4.5, r.ratio);
    }
    assert.equal(count, `${rows.length - 3} of ${rows.length} pass`);
  } finally {
    await page.close();
    await b.stop();
  }
});

test('a theme that bans glass and nulls it passes; one that bans glass and leaves it on fails visibly', { timeout: 90000 }, async () => {
  const { BANS } = await import('../../bin/board-bans.mjs');
  const cwd = fixture([
    { id: 'nullglass', css: '[data-brand="nullglass"] { --glass-blur: 0px; }\n', bans: ['glass'] },
    { id: 'onglass', css: '[data-brand="onglass"] { --accent: var(--text-1); }\n', bans: ['glass'] },
    { id: 'nobans', css: '[data-brand="nobans"] { --accent: var(--text-1); }\n' },
  ]);
  const b = await board('manifest.json', cwd);
  const page = await run.page({ width: 1440, height: 900 });
  try {
    await checked(page, b.url, 'nullglass');
    const ok = JSON.parse(await page.evaluate(BANS_STATE));
    assert.deepEqual(ok.summary, [['glass', 'true', 'badge ok', 'glass Pass']]);
    assert.deepEqual(ok.head, ['Ban', 'Check', 'Specimen', 'Property', 'Expected', 'Checked', 'Result']);
    assert.deepEqual(ok.rows.map((r) => [r.ban, r.check, r.specimen, r.property, r.expect]), BANS.glass.map((g) => ['glass', g.check, g.specimen, g.property, g.expect]));
    /* the .card row says what it proves: the theme added no glass, not the package default */
    assert.equal(ok.rows.find((r) => r.specimen === '.card').check, 'theme adds no glass');
    for (const r of ok.rows) {
      assert.ok(r.checked > 0, `${r.specimen} matched no specimen`);
      assert.equal(r.pass, 'true', r.specimen);
      assert.equal(r.result, 'Pass');
    }

    await checked(page, b.url, 'onglass');
    const bad = JSON.parse(await page.evaluate(BANS_STATE));
    assert.deepEqual(bad.summary, [['glass', 'false', 'badge err', 'glass Fail']]);
    const failing = bad.rows.filter((r) => r.pass === 'false').map((r) => r.specimen);
    assert.deepEqual(failing, ['.navshell', '.bulkbar']);
    assert.ok(bad.rows.filter((r) => r.pass === 'false').every((r) => r.result.startsWith('Fail')));

    await checked(page, b.url, 'nobans');
    const none = JSON.parse(await page.evaluate(BANS_STATE));
    assert.deepEqual({ summary: none.summary, rows: none.rows }, { summary: [], rows: [] });
    assert.equal(await page.evaluate(`document.querySelector('#board-bans [data-board-count]').textContent`), '0 bans');
  } finally {
    await page.close();
    await b.stop();
  }
});

test('every row of the ban table matches at least one specimen on the page', { timeout: 60000 }, async () => {
  const { BANS } = await import('../../bin/board-bans.mjs');
  const cwd = fixture([{ id: 'all', css: '[data-brand="all"] { --glass-blur: 0px; --accent-bloom: none; }\n', bans: Object.keys(BANS) }]);
  const b = await board('manifest.json', cwd);
  const page = await run.page({ width: 1440, height: 900 });
  try {
    await checked(page, b.url, 'all');
    const s = JSON.parse(await page.evaluate(BANS_STATE));
    assert.equal(s.rows.length, Object.values(BANS).flat().length);
    for (const r of s.rows) {
      assert.ok(r.checked > 0, `${r.ban} ${r.specimen} matched no specimen`);
      assert.equal(r.pass, 'true', `${r.ban} ${r.specimen}`);
    }
    assert.deepEqual(s.summary.map((x) => [x[0], x[1]]), Object.keys(BANS).map((k) => [k, 'true']));
  } finally {
    await page.close();
    await b.stop();
  }
});
