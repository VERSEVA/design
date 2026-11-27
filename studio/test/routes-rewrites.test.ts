import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROUTES } from '../src/shell/routes';

const repo = path.resolve(__dirname, '../..');

describe('studio routes and the Vercel config', () => {
  it('serves every studio route as its own pre-rendered file: no SPA rewrite, no redirect', () => {
    const v = JSON.parse(fs.readFileSync(path.join(repo, 'vercel.json'), 'utf8'));
    const toShell = (v.rewrites ?? []).filter((r: { destination: string }) => r.destination === '/index.html');
    expect(toShell).toEqual([]);
    const redirected = new Set((v.redirects ?? []).map((r: { source: string }) => r.source));
    expect(ROUTES.map((r) => r.path).filter((p) => redirected.has(p))).toEqual([]);
    expect(v.trailingSlash).toBe(false);
  });

  it('counts four gates: the checks verseva-gate runs', () => {
    const src = fs.readFileSync(path.join(repo, 'bin', 'verseva-gate.mjs'), 'utf8');
    const list = src.slice(src.indexOf('const GATES = ['), src.indexOf('];', src.indexOf('const GATES = [')));
    const gates = [...list.matchAll(/'([\w-]+-gate\.mjs)'/g)].map((m) => m[1]);
    expect(gates.length).toBe(4);
    for (const g of gates) expect(fs.existsSync(path.join(repo, 'bin', g))).toBe(true);
  });

  it('runs the recipe gate as advisory: a separate list, outside the four', () => {
    const src = fs.readFileSync(path.join(repo, 'bin', 'verseva-gate.mjs'), 'utf8');
    const start = src.indexOf('const ADVISORY = [');
    const list = src.slice(start, src.indexOf('];', start));
    expect(start).toBeGreaterThan(-1);
    expect([...list.matchAll(/'([\w-]+-gate\.mjs)'/g)].map((m) => m[1])).toEqual(['recipe-gate.mjs']);
  });
});
