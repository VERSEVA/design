// verseva board in headless Chrome (chrome.mjs): the switcher lists the manifest's themes,
// picking one applies it (data-brand, the theme sheet, the theme's own --accent), ?brand= opens
// one directly, an unknown id falls back to Baseline, and a hostile label stays text.
// Each test starts its own board and stops only that child, by the PID it spawned.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
