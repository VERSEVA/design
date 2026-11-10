// The served Chrome harness fails, never hangs: once its Chrome dies, a CDP call rejects
// within the send timeout instead of waiting forever.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
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

/* Chrome's helpers can still write into the profile after the browser dies, so the recursive
   delete races a refill (ENOTEMPTY on a sharded CI run). A leftover temp dir is harmless; a
   failed test is not: stop() must resolve, and either the dir is gone or one warning says so. */
const profileOf = (chrome) => chrome.spawnargs.find((a) => a.startsWith('--user-data-dir=')).slice('--user-data-dir='.length);

test('stop() resolves when a file lands in the profile right after the kill', { timeout: 30000 }, async (t) => {
  const run = await start();
  const profile = profileOf(run.chrome);
  const warn = t.mock.method(console, 'warn', () => {});
  const stopped = run.stop();
  setImmediate(() => { try { fs.writeFileSync(path.join(profile, 'late-write'), 'x'); } catch { /* already gone */ } });
  await stopped;
  assert.ok(!fs.existsSync(profile) || warn.mock.callCount() === 1, 'profile left behind without a warning');
});

test('stop() warns instead of failing when the profile removal hits ENOTEMPTY', { timeout: 30000 }, async (t) => {
  const run = await start();
  const profile = profileOf(run.chrome);
  const rm = fs.rmSync;
  t.mock.method(fs, 'rmSync', (p, o) => {
    if (p === profile) throw Object.assign(new Error(`ENOTEMPTY: directory not empty, rmdir '${p}'`), { code: 'ENOTEMPTY' });
    return rm(p, o);
  });
  const warn = t.mock.method(console, 'warn', () => {});
  try {
    await run.stop();
  } finally {
    t.mock.restoreAll();
    /* the same refill race can hit this cleanup: a leftover temp dir must not fail the test */
    try { rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); } catch { /* left in tmp */ }
  }
  assert.equal(warn.mock.calls.length, 1);
  assert.ok(warn.mock.calls[0].arguments.join(' ').includes(profile), 'warning names the profile path');
});
