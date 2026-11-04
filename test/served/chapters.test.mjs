// The tiled chapters in headless Chrome over out/ (chrome.mjs). Data viz keeps law 3 the way a
// product must: one focus tile (Line + area) spends the data accent, every other chart is on the
// text ladder, and nothing else in the page spends it (the shell's active nav aside), in both modes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';
import { ACCENT } from './accent.mjs';

let run;
before(async () => { run = await start(); });
after(async () => { await run?.stop(); });

for (const scheme of ['dark', 'light']) for (const width of [1440, 375]) {
  test(`/data-viz spends the accent on the focus tile and the active nav only (${width}px, ${scheme})`, { timeout: 60000 }, async () => {
    const page = await run.page({ width, height: 900, scheme });
    await page.goto('/data-viz');
    const uses = JSON.parse(await page.evaluate(ACCENT()));
    await page.close();
    assert.deepEqual(uses.filter((u) => u.startsWith('focus widget ')), ['focus widget lines'], uses.join('\n'));
    assert.deepEqual(uses.filter((u) => u.startsWith('main ')), [], uses.join('\n'));
    const shell = uses.filter((u) => u.startsWith('shell '));
    assert.ok(shell.length <= 1 && shell.every((u) => /aria-current|active|Data viz/.test(u)), shell.join(', '));
  });
}
