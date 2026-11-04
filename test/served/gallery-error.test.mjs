// A gallery thumbnail whose example does not load (1.7.0): the served 404 for a missing example is
// the studio shell, so this run answers /examples/pulse.html with the built 404.html and checks the
// Pulse tile shows the tile error with Retry instead of a studio nested in its thumbnail.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { start, out } from './chrome.mjs';

let run;
before(async () => { run = await start({ extra: { '/examples/pulse.html': fs.readFileSync(path.join(out, '404.html'), 'utf8') } }); });
after(async () => { await run?.stop(); });

test('a thumbnail answered with the studio shell shows the tile error and Retry, not a nested studio', { timeout: 60000 }, async () => {
  const page = await run.page({ width: 1440, height: 900 });
  await page.goto('/gallery');
  const r = JSON.parse(await page.evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const tile = () => [...document.querySelectorAll('.gtile')].find((t) => t.querySelector('.stile-name')?.textContent === 'Pulse · analytics');
    tile().scrollIntoView({ block: 'center' });
    for (let i = 0; i < 60 && !tile().querySelector('.wtile-err'); i++) await sleep(100);
    const err = tile().querySelector('.wtile-err[role="alert"]');
    const nested = [...document.querySelectorAll('.gthumb iframe')].some((f) => f.contentDocument?.getElementById('studio-root'));
    return JSON.stringify({ error: err?.textContent ?? null, retry: err?.querySelector('button')?.textContent ?? null, nested });
  })()`));
  await page.close();
  assert.deepEqual(r, { error: 'Preview did not loadRetry', retry: 'Retry', nested: false });
});
