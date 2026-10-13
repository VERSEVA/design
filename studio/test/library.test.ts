// The committed library manifest: 3D objects and loops only; files on disk; weight budget.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import library from '../src/data/library.json';

const studio = path.resolve(__dirname, '..');
const pub = path.join(studio, 'public');
const libDir = path.join(pub, 'library');
type Entry = Record<string, unknown>;
const lib = library as unknown as Record<string, unknown> & { objects: Entry[]; loops: Entry[] };

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e: { name: string; isDirectory(): boolean }) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe('library manifest', () => {
  it('carries 30 objects and 6 loops', () => {
    expect(lib.objects).toHaveLength(30);
    expect(lib.loops).toHaveLength(6);
  });

  it('carries no photography or video (internal by ruling 2026-10-13)', () => {
    expect(Object.keys(lib)).not.toContain('photos');
    expect(Object.keys(lib)).not.toContain('clips');
    for (const dir of ['photo', 'poster', 'preview']) expect(fs.existsSync(path.join(libDir, dir))).toBe(false);
  });

  it('references only local files that exist', () => {
    const local = [...lib.objects, ...lib.loops].flatMap((e) => [e.glb, e.thumb]).map(String);
    expect(local.length).toBeGreaterThan(0);
    const missing = local.filter((rel) => !rel.startsWith('/library/') || !fs.existsSync(path.join(pub, rel)));
    expect(missing).toEqual([]);
  }, 120_000);

  it('keeps public/library under 60 MB', () => {
    const bytes = walk(libDir).reduce((n, f) => n + fs.statSync(f).size, 0);
    expect(bytes).toBeLessThan(60 * 1024 * 1024);
  }, 120_000);
});

describe('asset license', () => {
  it('ships LICENSE-ASSETS: CC BY 4.0 for objects and loops, brand carve-out, media reserved', () => {
    const file = path.resolve(studio, '..', 'LICENSE-ASSETS');
    expect(fs.existsSync(file)).toBe(true);
    const text = fs.readFileSync(file, 'utf8');
    expect(text).toMatch(/CC BY 4\.0/);
    expect(text).toMatch(/creativecommons\.org\/licenses\/by\/4\.0/);
    expect(text).toMatch(/VERSEVA name, wordmark and emblem/i);
    expect(text).toMatch(/photography and video .* all rights reserved/is);
  });
});
