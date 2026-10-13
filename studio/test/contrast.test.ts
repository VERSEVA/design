import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PAIRS } from '../../bin/contrast-pairs.mjs';
import { ratio, composite, evaluatePairs } from '../src/contrast';
import { buildTokens } from '../scripts/tokens-model.mjs';

const repo = path.resolve(__dirname, '../..');
const model = buildTokens(fs.readFileSync(path.join(repo, 'tokens.css'), 'utf8'), {});

function applyDark() {
  const root = document.documentElement;
  root.removeAttribute('style');
  for (const t of model) root.style.setProperty(t.name, t.dark);
}

describe('shared contrast pairs', () => {
  it('exports the gate pair list', () => {
    expect(PAIRS).toHaveLength(20);
    expect(PAIRS[0]).toEqual(['text-1', ['bg'], 4.5]);
    expect(PAIRS).toContainEqual(['text-1', ['surface'], 4.5]);
  });
});

describe('contrast math', () => {
  it('measures WCAG ratios', () => {
    expect(ratio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    expect(ratio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(ratio([120, 30, 200], [120, 30, 200])).toBe(1);
  });
  it('composites alpha over a backdrop', () => {
    expect(composite([255, 255, 255], [0, 0, 0], 0.5)).toEqual([127.5, 127.5, 127.5]);
    expect(composite([10, 20, 30], [200, 200, 200], 1)).toEqual([10, 20, 30]);
  });
});

describe('live pairs, Signature dark (pinned to verseva-contrast-gate output)', () => {
  beforeEach(applyDark);

  it('measures every pair and matches the gate to 2 dp', () => {
    const rows = evaluatePairs(document.documentElement);
    expect(rows).toHaveLength(20);
    const find = (fg: string, bg: string) => rows.find((r) => r.fg === fg && r.bg === bg)!;
    expect(find('text-1', 'bg').ratio.toFixed(2)).toBe('17.84');
    expect(find('accent-ink', 'accent').ratio.toFixed(2)).toBe('4.64');
    expect(find('success', 'success-bg+surface').ratio.toFixed(2)).toBe('8.61');
    expect(find('text-1', 'accent*0.14+surface').ratio.toFixed(2)).toBe('15.21');
    expect(find('data-alt', 'bg').ratio.toFixed(2)).toBe('4.80');
    expect(rows.every((r) => r.pass)).toBe(true);
  });

  it('fails a pair under its floor', () => {
    document.documentElement.style.setProperty('--text-3', 'var(--bg)');
    const row = evaluatePairs(document.documentElement).find((r) => r.fg === 'text-3' && r.bg === 'bg')!;
    expect(row.ratio).toBe(1);
    expect(row.floor).toBe(3);
    expect(row.pass).toBe(false);
  });
});
