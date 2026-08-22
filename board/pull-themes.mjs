#!/usr/bin/env node
/**
 * Pulls brand theme.css files from their canonical homes (theme-manifest.json)
 * into board/_themes/ so the board can <link> them. The brand home stays the
 * source of truth; _themes/ holds generated copies and is gitignored.
 * Fails loudly on a missing file: a theme the board cannot render is a defect,
 * not a silent fallback to Baseline.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'theme-manifest.json'), 'utf8'));
const dest = path.join(here, '_themes');
fs.mkdirSync(dest, { recursive: true });

let failed = false;
for (const [slug, src] of Object.entries(manifest)) {
  if (!fs.existsSync(src)) {
    console.error(`MISSING theme for "${slug}": ${src}`);
    failed = true;
    continue;
  }
  fs.copyFileSync(src, path.join(dest, `${slug}.css`));
  console.log(`pulled ${slug} <- ${src}`);
}
process.exit(failed ? 1 : 0);
