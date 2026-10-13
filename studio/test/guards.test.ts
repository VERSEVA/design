// @vitest-environment node
// Public-repo guards: no em dashes and no partner-private identifiers in studio source.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const DIRS = ['src', 'scripts', 'test'];
const FILES = ['index.html'];
const EXT = /\.(ts|tsx|mjs|js|css|html|json|md)$/;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : EXT.test(e.name) ? [p] : [];
  });
}

const files = [...DIRS.flatMap((d) => walk(path.join(root, d))), ...FILES.map((f) => path.join(root, f))]
  .filter((f) => !f.endsWith('guards.test.ts'));

export function scan(list: string[]) {
  const hits: string[] = [];
  for (const f of list) {
    const text = fs.readFileSync(f, 'utf8');
    if (text.includes('—')) hits.push(`${path.relative(root, f)}: em dash`);
    if (/ufitra|\buf-|atlas-/i.test(text)) hits.push(`${path.relative(root, f)}: partner identifier`);
  }
  return hits;
}

describe('public repo guards', () => {
  it('finds no em dash or partner identifier in studio source', () => {
    expect(scan(files)).toEqual([]);
  });
});
