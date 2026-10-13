import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROUTES } from '../src/shell/routes';

const repo = path.resolve(__dirname, '../..');

describe('studio routes and the Vercel config', () => {
  it('rewrites every studio route except / to the studio', () => {
    const v = JSON.parse(fs.readFileSync(path.join(repo, 'vercel.json'), 'utf8'));
    const rewritten = new Set(v.rewrites.filter((r: { destination: string }) => r.destination === '/index.html').map((r: { source: string }) => r.source));
    const missing = ROUTES.map((r) => r.path).filter((p) => p !== '/' && !rewritten.has(p));
    expect(missing).toEqual([]);
    expect(v.trailingSlash).toBe(false);
  });

  it('counts four gates, one per bin/*-gate.mjs check', () => {
    const gates = fs.readdirSync(path.join(repo, 'bin')).filter((f) => /-gate\.mjs$/.test(f) && f !== 'verseva-gate.mjs');
    expect(gates.length).toBe(4);
  });
});
