// At 375px no served page scrolls sideways, and no gallery example frame is wider
// than its box. Runs headless Chrome over out/ (npm run studio:build && npm run
// assemble first), served the way vercel.json serves it, and reads scrollWidth
// against clientWidth after the page settles. No Chrome: the test fails, loudly.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'out');
const routes = JSON.parse(fs.readFileSync(path.join(root, 'studio/src/data/routes.json'), 'utf8')).filter((r) => !r.proposed);
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rewrites = new Map((vercel.rewrites ?? []).map((r) => [r.source, r.destination]));

export const PROBED = ['/components', '/gallery', ...routes.filter((r) => r.path.startsWith('/gallery/')).map((r) => r.path)];
const WIDTH = 375;
/* Example files that are wider than a 375px phone on their own, and why they are not fixed here.
   An entry that stops overflowing fails, so the list cannot go stale. */
export const FRAME_OVERFLOW_ALLOWED = {
  '/examples/landing.html': 'the example file itself is 433px wide at 375px standalone (its top-bar buttons); a fix belongs in site/examples/landing.html, out of this port',
};

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

let server, chrome, ws, origin, profile;
let seq = 0;
const pending = new Map();
const events = [];
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});
const waitFor = (method, sessionId, ms = 20000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), ms);
  events.push({ method, sessionId, resolve: (v) => { clearTimeout(t); resolve(v); } });
});

before(async () => {
  assert.ok(fs.existsSync(path.join(out, 'index.html')), 'out/ missing: run npm run studio:build && npm run assemble');
  const bin = findChrome();
  assert.ok(bin, 'no Chrome found for the 375px overflow probe: set CHROME_PATH');
  server = http.createServer((req, res) => {
    const f = resolveServed(req.url);
    if (!f) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`;
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vsv-probe-'));
  chrome = spawn(bin, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('Chrome did not start')), 20000);
    chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); resolve(m[1]); } });
  });
  ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); return; }
    const i = events.findIndex((e) => e.method === msg.method && e.sessionId === msg.sessionId);
    if (i >= 0) events.splice(i, 1)[0].resolve(msg.params);
  };
});

after(async () => {
  try { ws?.close(); } catch { /* closed */ }
  chrome?.kill();
  server?.close();
  await new Promise((r) => setTimeout(r, 300));
  if (profile) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

const PROBE = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(1500);
  document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
  await sleep(300);
  const el = document.documentElement;
  const frames = [...document.querySelectorAll('.gex-frame')].map((f) => {
    const d = f.contentDocument;
    return d ? { src: f.getAttribute('src'), scrollWidth: d.documentElement.scrollWidth, clientWidth: d.documentElement.clientWidth } : { src: f.getAttribute('src'), scrollWidth: -1, clientWidth: 0 };
  });
  return JSON.stringify({ studio: !!document.querySelector('#studio-root .studio'), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, frames });
})()`;

test(`no probed route scrolls sideways at ${WIDTH}px`, { timeout: 180000 }, async () => {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 812, deviceScaleFactor: 2, mobile: true }, sessionId);
  const bad = [];
  for (const p of PROBED) {
    const loaded = waitFor('Page.loadEventFired', sessionId);
    await send('Page.navigate', { url: origin + p }, sessionId);
    await loaded;
    const { result } = await send('Runtime.evaluate', { expression: PROBE, awaitPromise: true, returnByValue: true }, sessionId);
    const r = JSON.parse(result.value);
    if (!r.studio) bad.push(`${p}: not the studio shell`);
    if (r.scrollWidth > r.clientWidth) bad.push(`${p}: scrollWidth ${r.scrollWidth} > clientWidth ${r.clientWidth}`);
    for (const f of r.frames) {
      const wide = f.scrollWidth > f.clientWidth;
      if (wide && !FRAME_OVERFLOW_ALLOWED[f.src]) bad.push(`${p}: frame ${f.src} scrollWidth ${f.scrollWidth} > clientWidth ${f.clientWidth}`);
      if (!wide && FRAME_OVERFLOW_ALLOWED[f.src]) bad.push(`${p}: frame ${f.src} no longer overflows; drop its FRAME_OVERFLOW_ALLOWED entry`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the probe sees a wide page', { timeout: 60000 }, async () => {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 812, deviceScaleFactor: 2, mobile: true }, sessionId);
  const loaded = waitFor('Page.loadEventFired', sessionId);
  await send('Page.navigate', { url: origin + '/site/components.html' }, sessionId);
  await loaded;
  const { result } = await send('Runtime.evaluate', { expression: PROBE, awaitPromise: true, returnByValue: true }, sessionId);
  const r = JSON.parse(result.value);
  assert.ok(r.scrollWidth > r.clientWidth, `the frozen site/components.html overflows at ${WIDTH}px, so the probe must see it (got ${r.scrollWidth} vs ${r.clientWidth})`);
});

/* React's text escapes, undone: the pre-rendered #srccode back to the string it was given. */
const unescapeText = (h) => h.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

test('every /examples/*.html is served byte for byte as its code page and its source chunk show it', async () => {
  const slugs = fs.readdirSync(path.join(root, 'site/examples')).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')).sort();
  const chunks = fs.readdirSync(path.join(out, '_s'));
  for (const slug of slugs) {
    const served = fs.readFileSync(path.join(out, 'examples', `${slug}.html`), 'utf8');
    const page = fs.readFileSync(path.join(out, 'gallery', slug, 'code', 'index.html'), 'utf8');
    const m = page.match(/<code id="srccode">([\s\S]*?)<\/code>/);
    assert.ok(m, `${slug}: pre-rendered code page has no #srccode`);
    assert.equal(unescapeText(m[1]), served, `${slug}: pre-rendered code page`);
    const chunk = chunks.filter((f) => new RegExp(`^${slug}-[A-Za-z0-9_-]{8}\\.js$`).test(f));
    assert.equal(chunk.length, 1, `${slug}: one source chunk in out/_s (got ${chunk.join(', ') || 'none'})`);
    const { default: text } = await import(pathToFileURL(path.join(out, '_s', chunk[0])).href);
    assert.equal(text, served, `${slug}: source chunk ${chunk[0]}`);
  }
});
