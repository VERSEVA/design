// Shared harness for the served Chrome tests: out/ served the way Vercel serves it
// (vercel.json redirects, then a file, a pre-rendered <route>/index.html, or a rewrite),
// and one headless Chrome with its own temp profile, killed with the run.
// No Chrome: start() fails, loudly. A dead or stuck Chrome fails the call that needed it:
// the launch, the socket open and every CDP call carry a timeout, and Chrome's exit rejects
// whatever is still waiting, so the run fails instead of hanging.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { root, SITE, redirectFor } from './vercel-routing.mjs';

export { root };
export const out = path.join(root, 'out');
export const routes = JSON.parse(fs.readFileSync(path.join(root, 'studio/src/data/routes.json'), 'utf8')).filter((r) => !r.proposed);
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rewrites = new Map((vercel.rewrites ?? []).map((r) => [r.source, r.destination]));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };

/* out/ the way Vercel serves it: a file, a pre-rendered <route>/index.html, or a rewrite. */
export function resolveServed(urlPath) {
  const p = decodeURIComponent(urlPath.split('?')[0]);
  const file = path.join(out, p);
  if (!file.startsWith(out)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  const idx = path.join(file, 'index.html');
  if (fs.existsSync(idx)) return idx;
  const dest = rewrites.get(p.replace(/\/$/, '') || '/');
  return dest ? path.join(out, dest) : null;
}

function findChrome() {
  const env = process.env.CHROME_PATH;
  if (env && fs.existsSync(env)) return env;
  for (const p of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']) if (fs.existsSync(p)) return p;
  for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { return execFileSync('which', [bin], { encoding: 'utf8' }).trim(); } catch { /* next */ }
  }
  return null;
}

/* Starts the server and Chrome. `extra` maps a path to HTML served only by this run. */
export async function start({ extra = {}, sendTimeoutMs = 30000, launchTimeoutMs = 20000 } = {}) {
  assert.ok(fs.existsSync(path.join(out, 'index.html')), 'out/ missing: run npm run studio:build && npm run assemble');
  const bin = findChrome();
  assert.ok(bin, 'no Chrome found for the served Chrome tests: set CHROME_PATH');
  const server = http.createServer((req, res) => {
    if (extra[req.url]) { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(extra[req.url]); return; }
    const r = redirectFor(new URL(req.url, SITE));
    if (r) { res.writeHead(r.status, { location: new URL(r.location, SITE).pathname + new URL(r.location, SITE).search }); res.end(); return; }
    const f = resolveServed(req.url);
    if (!f) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vsv-probe-'));
  const chrome = spawn(bin, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  /* the run owns this Chrome and its temp profile: both go when the process ends, even on a crash */
  process.once('exit', () => { try { chrome.kill('SIGKILL'); } catch { /* gone */ } try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* gone */ } });
  let dead = null;
  const pending = new Map();
  const events = [];
  /* Chrome gone: everything still waiting on it fails now. */
  const die = (why) => {
    if (dead) return;
    dead = new Error(why);
    for (const p of pending.values()) p.reject(dead);
    pending.clear();
    for (const e of events.splice(0)) e.reject(dead);
  };
  chrome.once('exit', (code, sig) => die(`Chrome exited (${sig ?? code})`));
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => { chrome.kill('SIGKILL'); reject(new Error(`Chrome did not start within ${launchTimeoutMs}ms`)); }, launchTimeoutMs);
    chrome.once('exit', () => { clearTimeout(t); reject(new Error('Chrome exited before it started')); });
    chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); resolve(m[1]); } });
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => {
    const t = setTimeout(() => j(new Error(`Chrome DevTools socket did not open within ${launchTimeoutMs}ms`)), launchTimeoutMs);
    ws.onopen = () => { clearTimeout(t); r(); };
    ws.onerror = (e) => { clearTimeout(t); j(e); };
  });
  ws.onclose = () => die('Chrome DevTools socket closed');
  let seq = 0;
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); return; }
    const i = events.findIndex((e) => e.method === msg.method && e.sessionId === msg.sessionId);
    if (i >= 0) events.splice(i, 1)[0].resolve(msg.params);
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (dead) { reject(dead); return; }
    const id = ++seq;
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`CDP ${method} timed out after ${sendTimeoutMs}ms`)); }, sendTimeoutMs);
    pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
    try { ws.send(JSON.stringify({ id, method, params, sessionId })); } catch (e) { pending.delete(id); clearTimeout(t); reject(e); }
  });
  const waitFor = (method, sessionId, ms = 20000) => new Promise((resolve, reject) => {
    if (dead) { reject(dead); return; }
    const t = setTimeout(() => { const i = events.indexOf(ev); if (i >= 0) events.splice(i, 1); reject(new Error(`timeout waiting for ${method}`)); }, ms);
    const ev = { method, sessionId, resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } };
    events.push(ev);
  });

  /* A page at a width and colour scheme: { goto(path), evaluate(expr) }. */
  async function page({ width = 375, height = 812, scheme = 'dark' } = {}) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: width < 768 }, sessionId);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] }, sessionId);
    return {
      async goto(p) {
        const loaded = waitFor('Page.loadEventFired', sessionId);
        loaded.catch(() => {}); /* awaited below; a failed navigate must not leave it unhandled */
        await send('Page.navigate', { url: origin + p }, sessionId);
        await loaded;
      },
      async evaluate(expression) {
        const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
        if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
        return result.value;
      },
      close: () => send('Target.closeTarget', { targetId }),
    };
  }

  async function stop() {
    try { ws.close(); } catch { /* closed */ }
    chrome.kill('SIGKILL');
    server.close();
    await new Promise((r) => setTimeout(r, 300));
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

  return { origin, page, stop, chrome };
}
