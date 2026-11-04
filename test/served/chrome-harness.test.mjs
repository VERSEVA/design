// The served Chrome harness fails, never hangs: once its Chrome dies, a CDP call rejects
// within the send timeout instead of waiting forever.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start } from './chrome.mjs';

const harness = fileURLToPath(new URL('./chrome.mjs', import.meta.url));

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

/* CI once took over 20s to bring Chrome up: the launch failed, the server stayed open, and the
   file never exited. A failed launch must release everything it opened. */
test('a launch that times out rejects and leaves nothing open, so the run exits', { timeout: 30000 }, () => {
  const script = `import { start } from ${JSON.stringify(harness)};
    await start({ launchTimeoutMs: 1 }).then(() => { console.log('started'); process.exit(2); }, (e) => console.log('rejected: ' + e.message));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 20000 });
  assert.notEqual(r.error?.code, 'ETIMEDOUT', 'the process hung after a failed launch');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /rejected: Chrome did not start within 1ms/);
});
