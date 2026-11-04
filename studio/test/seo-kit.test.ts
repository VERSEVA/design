// @vitest-environment node
// The SEO kit: generated from the emblem and the tokens, full clear space on every image,
// and a sitemap that lists every live route.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { writeSeoKit, readTokens } from '../scripts/seo-kit.mjs';
import { LIVE_ROUTES } from '../src/shell/routes-table';

const SITE = 'https://design.verseva.com';
let dir = '';
beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-kit-')); writeSeoKit(dir, LIVE_ROUTES.map((r) => r.path)); });
afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

/** Decodes an 8-bit RGBA, filter-0 PNG as written by seo-kit. */
function readPng(buf: Buffer) {
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  let o = 8, w = 0, h = 0;
  const idat: Buffer[] = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); expect([data[8], data[9]]).toEqual([8, 6]); }
    if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) { expect(raw[y * (w * 4 + 1)]).toBe(0); raw.copy(px, y * w * 4, y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1)); }
  return { w, h, px };
}

/** Box of pixels that differ from the canvas colour. */
function inkBox({ w, h, px }: ReturnType<typeof readPng>, bg: number[]) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 6) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

const hex = (h: string) => [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16));

describe('SEO kit', () => {
  const { bg, ink } = readTokens();

  it('draws its colours from the dark canvas tokens', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../tokens.css'), 'utf8');
    expect(css).toMatch(new RegExp(`--bg:\\s*${bg}`, 'i'));
    expect(css).toMatch(new RegExp(`--text-1:\\s*${ink}`, 'i'));
  });

  for (const [file, w, h] of [['apple-touch-icon.png', 180, 180], ['icon-192.png', 192, 192], ['icon-512.png', 512, 512], ['icon-maskable-512.png', 512, 512], ['og.png', 1200, 630]] as const) {
    it(`${file} is ${w}x${h} with the emblem at full clear space`, () => {
      const img = readPng(fs.readFileSync(path.join(dir, file)));
      expect([img.w, img.h]).toEqual([w, h]);
      expect([...img.px.subarray(0, 4)]).toEqual([...hex(bg), 255]);
      const box = inkBox(img, hex(bg));
      expect(box.width).toBeGreaterThan(0);
      /* the emblem is a third of the height; its width again is clear on every side (1px antialias) */
      expect(Math.abs(box.width - h / 3)).toBeLessThanOrEqual(2);
      for (const gap of [box.x0, w - 1 - box.x1, box.y0, h - 1 - box.y1]) expect(gap).toBeGreaterThanOrEqual(box.width - 2);
      const cx = Math.round((box.x0 + box.x1) / 2), cy = Math.round((box.y0 + box.y1) / 2);
      expect(Math.abs(cx - w / 2)).toBeLessThanOrEqual(2);
      expect(Math.abs(cy - h / 2)).toBeLessThanOrEqual(2);
    });
  }

  it('favicon.ico holds 16 and 32 pixel PNGs', () => {
    const buf = fs.readFileSync(path.join(dir, 'favicon.ico'));
    expect(buf.readUInt16LE(2)).toBe(1);
    expect(buf.readUInt16LE(4)).toBe(2);
    const sizes = [0, 1].map((k) => {
      const e = 6 + 16 * k;
      const img = readPng(buf.subarray(buf.readUInt32LE(e + 12), buf.readUInt32LE(e + 12) + buf.readUInt32LE(e + 8)));
      expect([img.w, img.h]).toEqual([buf[e], buf[e + 1]]);
      return img.w;
    });
    expect(sizes).toEqual([16, 32]);
  });

  it('icon.svg is the emblem on the canvas tile at one third', () => {
    const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 512 512">/);
    expect(svg).toContain(`<rect width="512" height="512" fill="${bg}"/>`);
    expect(svg).not.toContain('currentColor');
    expect(svg.match(/fill="([^"]+)"/g)!.filter((f) => f !== `fill="${bg}"`).every((f) => f === `fill="${ink}"`)).toBe(true);
  });

  it('the manifest names the icon files it ships', () => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'site.webmanifest'), 'utf8'));
    expect(m.name).toBe('VERSEVA Design');
    expect(m.theme_color).toBe(bg);
    for (const i of m.icons) expect(fs.existsSync(path.join(dir, i.src.slice(1))), i.src).toBe(true);
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  });

  it('robots allows everything and points at the sitemap', () => {
    const r = fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8');
    expect(r).toMatch(/^User-agent: \*\nAllow: \/\n/);
    expect(r).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  it('the sitemap lists every live route once, by canonical URL', () => {
    const x = fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8');
    expect(x).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    const locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(LIVE_ROUTES.map((r) => (r.path === '/' ? `${SITE}/` : `${SITE}${r.path}`)));
  });
});
