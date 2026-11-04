// The 3D hero (site/examples/three-hero.html) keeps its copy legible over the WebGL scene, in
// dark and in light, at 1440 and 375, as the studio themes it (the frame starts dark and is
// flipped after load). For each text block the probe hides the copy, screenshots the scene behind
// it (the glyphs only, so a scrim stays) over several frames of the idle rotation, and measures the text colour against every sampled
// pixel: the headline and the body hold 4.5:1, the kicker and the hint (--text-3) hold 3:1.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { start } from './chrome.mjs';

/* A minimal PNG reader: 8-bit RGB or RGBA, not interlaced (what Chrome's screenshots are). */
export function decodePng(buf) {
  let p = 8, w = 0, h = 0, type = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), kind = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); type = data[9]; assert.equal(data[8], 8); assert.equal(data[12], 0); }
    if (kind === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      const pr = (() => { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; })();
      out[y * stride + x] = (line[x] + [0, a, b, (a + b) >> 1, pr][f]) & 255;
    }
  }
  return { w, h, px: (x, y) => [out[y * stride + x * bpp], out[y * stride + x * bpp + 1], out[y * stride + x * bpp + 2]] };
}
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test('the contrast maths: black on white is 21:1, a colour on itself 1:1', () => {
  assert.equal(Math.round(ratio([0, 0, 0], [255, 255, 255])), 21);
  assert.equal(ratio([120, 30, 30], [120, 30, 30]), 1);
});

let run;
before(async () => { run = await start(); });
after(async () => { await run?.stop(); });

/* Theme the example as the studio does (after load), hide the copy, and report each block's box and colour. */
const SETUP = (scheme) => `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(1500);
  const d = document.documentElement;
  if (${JSON.stringify(scheme)} === 'light') d.dataset.theme = 'light'; else delete d.dataset.theme;
  await sleep(600);
  const blocks = [['h1', '.overlay h1', 4.5], ['body', '.overlay p', 4.5], ['kick', '.overlay .kick', 3], ['hint', '.hint', 3]].map(([name, sel, min]) => {
    const el = document.querySelector(sel);
    /* The glyphs' line boxes, not the element's: a block element runs on past its text over the scene. */
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width && r.height).map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
    const rgb = getComputedStyle(el).color.match(/[\\d.]+/g).slice(0, 3).map(Number);
    return { name, min, rgb, rects };
  });
  const style = document.createElement('style');
  /* Only the glyphs go: a scrim or a backing behind the copy stays in the shot, as the reader sees it. */
  style.textContent = '.overlay *, .hint, .crumb, .crumb * { color: transparent !important; -webkit-text-fill-color: transparent !important; }';
  document.head.append(style);
  await sleep(100);
  return JSON.stringify({ blocks, dpr: devicePixelRatio });
})()`;

for (const scheme of ['dark', 'light']) for (const [width, height] of [[1440, 900], [375, 812]]) {
  test(`three-hero copy holds its contrast over the 3D scene (${width}px, ${scheme})`, { timeout: 90000 }, async () => {
    const page = await run.page({ width, height, scheme });
    await page.goto('/examples/three-hero.html');
    const { blocks, dpr } = JSON.parse(await page.evaluate(SETUP(scheme)));
    const worst = Object.fromEntries(blocks.map((b) => [b.name, Infinity]));
    const where = {};
    for (let frame = 0; frame < 5; frame++) {
      const png = decodePng(Buffer.from(await page.shot(), 'base64'));
      for (const b of blocks) for (const rc of b.rects) {
        const step = Math.max(2, Math.round(4 * dpr));
        for (let y = Math.round(rc.y * dpr); y < Math.min(png.h, (rc.y + rc.h) * dpr); y += step) {
          for (let x = Math.round(rc.x * dpr); x < Math.min(png.w, (rc.x + rc.w) * dpr); x += step) {
            const c = ratio(b.rgb, png.px(x, y));
            if (c < worst[b.name]) { worst[b.name] = c; where[b.name] = { x: Math.round(x / dpr), y: Math.round(y / dpr), px: png.px(x, y), text: b.rgb, frame }; }
          }
        }
      }
      await page.evaluate('new Promise((r) => setTimeout(r, 1500))');
    }
    await page.close();
    const bad = blocks.filter((b) => worst[b.name] < b.min).map((b) => `${b.name} ${worst[b.name].toFixed(2)}:1 < ${b.min}:1`);
    assert.deepEqual(bad, [], `worst ratios ${JSON.stringify(Object.fromEntries(Object.entries(worst).map(([k, v]) => [k, +v.toFixed(2)])))} at ${JSON.stringify(where)}`);
  });
}
