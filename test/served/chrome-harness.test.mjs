// The served Chrome harness fails, never hangs: once its Chrome dies, a CDP call rejects
// within the send timeout instead of waiting forever.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './chrome.mjs';

test('a dead Chrome fails the next CDP call instead of hanging the run', { timeout: 30000 }, async () => {
  const run = await start({ sendTimeoutMs: 5000 });
  try {
    const page = await run.page({ width: 375 });
    run.chrome.kill('SIGKILL');
    const t0 = Date.now();
    await assert.rejects(page.evaluate('1 + 1'), /Chrome|timed out|closed/);
    assert.ok(Date.now() - t0 < 6000, `rejected after ${Date.now() - t0}ms`);
  } finally {
    await run.stop();
  }
});
