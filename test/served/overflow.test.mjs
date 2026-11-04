// At 375px, 371px and 360px no probed page scrolls sideways, in dark and in light, and no gallery example
// frame is wider than its box. Runs headless Chrome over out/ (npm run studio:build && npm run
// assemble first), served the way vercel.json serves it (chrome.mjs), and reads scrollWidth
// against clientWidth after the page settles. No Chrome: the test fails, loudly.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, out, routes, start } from './chrome.mjs';

export { resolveServed } from './chrome.mjs';
export const PROBED = ['/', '/foundations', '/components', '/motion', '/widgets', '/gallery', ...routes.filter((r) => r.path.startsWith('/gallery/')).map((r) => r.path)];
const WIDTH = 375;
/* Both schemes, at 375px, 371px and 360px (the narrowest common phone). The #bulk specimen on
   /components fit at 375px and spilled 0.53px past a 371px viewport (372 vs 371) in either
   scheme, so a single width cannot prove a page holds at phone widths. */
export const SCHEMES = ['dark', 'light'];
export const WIDTHS = [WIDTH, 371, 360];
/* Example files that are wider than a 375px phone on their own, and why they are not fixed here.
   An entry that stops overflowing fails, so the list cannot go stale. */
export const FRAME_OVERFLOW_ALLOWED = {};

/* A page known to scroll sideways at 375px, served only by this probe, so the probe can prove it sees one. */
const WIDE_PAGE = '/__probe/wide';
const WIDE_HTML = '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0"><div style="width:600px;height:10px"></div></body>';

let run;
before(async () => { run = await start({ extra: { [WIDE_PAGE]: WIDE_HTML } }); });
after(async () => { await run?.stop(); });

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
  const cw = el.clientWidth;
  let wide = '';
  if (el.scrollWidth > cw) {
    const w = [...document.querySelectorAll('body *')].map((n) => [n, n.getBoundingClientRect().right]).filter(([, r]) => r > cw).sort((a, b) => b[1] - a[1])[0];
    if (w) wide = w[0].tagName.toLowerCase() + (w[0].id ? '#' + w[0].id : '') + (w[0].className && typeof w[0].className === 'string' ? '.' + w[0].className.trim().split(/\s+/).join('.') : '') + ' right ' + w[1];
  }
  return JSON.stringify({ studio: !!document.querySelector('#studio-root .studio'), mode: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark', scrollWidth: el.scrollWidth, clientWidth: cw, wide, frames });
})()`;

for (const width of WIDTHS) for (const scheme of SCHEMES) {
  test(`no probed route scrolls sideways at ${width}px in ${scheme}`, { timeout: 180000 }, async () => {
    const page = await run.page({ width, scheme });
    const bad = [];
    for (const p of PROBED) {
      await page.goto(p);
      const r = JSON.parse(await page.evaluate(PROBE));
      if (!r.studio) bad.push(`${p}: not the studio shell`);
      if (r.mode !== scheme) bad.push(`${p}: rendered ${r.mode}, not ${scheme}`);
      if (r.scrollWidth > r.clientWidth) bad.push(`${p}: scrollWidth ${r.scrollWidth} > clientWidth ${r.clientWidth}${r.wide ? ` (${r.wide})` : ''}`);
      for (const f of r.frames) {
        const wide = f.scrollWidth > f.clientWidth;
        if (wide && !FRAME_OVERFLOW_ALLOWED[f.src]) bad.push(`${p}: frame ${f.src} scrollWidth ${f.scrollWidth} > clientWidth ${f.clientWidth}`);
        if (!wide && FRAME_OVERFLOW_ALLOWED[f.src]) bad.push(`${p}: frame ${f.src} no longer overflows; drop its FRAME_OVERFLOW_ALLOWED entry`);
      }
    }
    await page.close();
    assert.deepEqual(bad, []);
  });
}

test('the probe sees a wide page', { timeout: 60000 }, async () => {
  const page = await run.page({ width: WIDTH });
  await page.goto(WIDE_PAGE);
  const r = JSON.parse(await page.evaluate(PROBE));
  await page.close();
  assert.ok(r.scrollWidth > r.clientWidth, `a 600px-wide page overflows at ${WIDTH}px, so the probe must see it (got ${r.scrollWidth} vs ${r.clientWidth})`);
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
