#!/usr/bin/env node
/**
 * Pulls brand theme.css files from their canonical homes into board/_themes/
 * so the board can <link> them. Brand homes stay the source of truth;
 * _themes/ holds generated copies and is gitignored.
 *
 * The manifest is machine-local and gitignored (board/theme-manifest.json);
 * theme-manifest.example.json shows the shape. A machine without a manifest,
 * or missing some theme files, still gets a working board: it renders the
 * signature Baseline plus whatever themes were pulled, and says exactly what
 * was skipped. Pass --strict to fail instead (the authoring machine's mode:
 * there, a missing theme is a defect, not a fallback).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const strict = process.argv.includes('--strict');
const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(here, 'theme-manifest.json');
const dest = path.join(here, '_themes');
fs.mkdirSync(dest, { recursive: true });

if (!fs.existsSync(manifestPath)) {
  console.log('no board/theme-manifest.json on this machine: board renders the signature Baseline only');
  console.log('(to pull brand themes, copy theme-manifest.example.json and point it at your theme.css files)');
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let missing = 0;
for (const [slug, src] of Object.entries(manifest)) {
  if (!fs.existsSync(src)) {
    console.error(`SKIPPED "${slug}": not found at ${src}`);
    missing += 1;
    continue;
  }
  fs.copyFileSync(src, path.join(dest, `${slug}.css`));
  console.log(`pulled ${slug} <- ${src}`);
}
if (missing && strict) {
  console.error(`--strict: ${missing} theme(s) missing is a defect`);
  process.exit(1);
}
if (missing) console.log(`${missing} theme(s) skipped; the board renders Baseline for those brands`);
