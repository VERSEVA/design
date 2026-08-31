import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const gate = path.join(root, 'bin', 'contrast-gate.mjs');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'registry.json'), 'utf8'));

test('every shipped theme preset clears every contrast floor in all four theme axes', () => {
  assert.ok(registry.themes.length >= 4);
  for (const t of registry.themes) {
    const out = execFileSync(process.execPath, [gate, '--tokens', path.join(root, 'tokens.css'), '--tokens', path.join(root, t.file)], { encoding: 'utf8' });
    assert.match(out, /clean \(80 pairs measured across 4 themes, 0 skipped\)/, `${t.name} not fully measured/clean`);
  }
});
