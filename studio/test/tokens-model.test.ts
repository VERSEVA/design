import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildTokens, FAMILIES } from '../scripts/tokens-model.mjs';

const repo = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(repo, p), 'utf8');
const themes = Object.fromEntries(['cobalt', 'forest', 'slate', 'violet'].map((s) => [s, read(`themes/${s}.css`)]));

describe('token model', () => {
  it('throws on an unsectioned token', () => {
    const css = ':root { --bg: #000; --zz-unknown: 1px; }';
    expect(() => buildTokens(css, {})).toThrow('unsectioned token --zz-unknown');
  });

  it('models the real tokens.css as 80 tokens, each in exactly one family', () => {
    const model = buildTokens(read('tokens.css'), themes);
    expect(model).toHaveLength(80);
    const ids = FAMILIES.map((f: { id: string }) => f.id);
    for (const t of model) {
      expect(ids).toContain(t.family);
      const hits = FAMILIES.filter((f: { match: RegExp }) => f.match.test(t.name.slice(2)));
      expect(hits, t.name).toHaveLength(1);
    }
    const size = (id: string) => model.filter((t: { family: string }) => t.family === id).length;
    expect(Object.fromEntries(ids.map((id: string) => [id, size(id)]))).toEqual({
      canvas: 9, accent: 9, status: 6, data: 7, material: 11,
      radius: 5, spacing: 10, type: 6, motion: 10, layout: 7,
    });
  });

  it('carries per-mode and per-brand values', () => {
    const model = buildTokens(read('tokens.css'), themes);
    const get = (n: string) => model.find((t: { name: string }) => t.name === n)!;
    const bg = get('--bg');
    expect(bg.family).toBe('canvas');
    expect(bg.dark).toBe('#0B0D10');
    expect(bg.light).toBe('#F4F5F8');
    expect(bg.brands).toEqual({});
    const accent = get('--accent');
    expect(accent.brands.cobalt).toEqual({ dark: '#4D9FFF', light: '#1D4ED8' });
    expect(Object.keys(accent.brands)).toEqual(['cobalt', 'forest', 'slate', 'violet']);
    expect(get('--s-4').light).toBe('16px');
  });

  it('writes the committed tokens.json from the real sources', () => {
    const json = JSON.parse(fs.readFileSync(path.join(repo, 'studio/src/data/tokens.json'), 'utf8'));
    expect(json).toEqual(buildTokens(read('tokens.css'), themes));
  });
});
