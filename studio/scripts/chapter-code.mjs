// The code samples a legacy chapter built in the browser: its inline script filled
// every empty `.codewrap code` with the dedented innerHTML of its specimen, after
// its own drawing code ran. A React port cannot rebuild them from its own DOM (no
// source whitespace, CSSOM-serialized styles), so this runs the frozen page's
// script in jsdom and writes the exact text to pages/<slug>.code.json.
// test/chapter-code.test.ts regenerates every file in memory and fails if one is stale.
// usage: node studio/scripts/chapter-code.mjs <slug> <file.html>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const studio = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM, VirtualConsole } = createRequire(path.join(studio, 'package.json'))('jsdom');

/* The jsdom errors each page's script is known to trigger, by exact first line.
   Anything else the legacy script throws stops the generator. */
/** @type {Record<string, string[]>} */
export const ALLOWED_JSDOM_ERRORS = {
  'data-viz': [],
  motion: [],
};

/* Browsers write numbers set through the CSSOM with 6 significant digits
   (top: 33.5714%); jsdom writes them in full. The samples keep the browser form. */
const cssomNumbers = (text) => text.replace(/ style="([^"]*)"/g, (_, v) =>
  ` style="${v.replace(/-?\d+\.\d{5,}/g, (n) => String(Number(Number(n).toPrecision(6))))}"`);

/** Runs the page's scripts and returns each specimen's code sample, in page order. */
export function chapterCode(html, allowed = []) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    const line = String(e.message).split('\n')[0];
    if (!allowed.includes(line)) errors.push(line + (e.detail ? ` (${e.detail})` : ''));
  });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole });
  const codes = [...dom.window.document.querySelectorAll('.comp')].flatMap((comp) => {
    const code = comp.querySelector('.codewrap code');
    return code && comp.querySelector('.specimen') ? [cssomNumbers(code.textContent)] : [];
  });
  dom.window.close();
  if (errors.length) throw new Error(`chapter-code: the legacy script failed:\n  ${errors.join('\n  ')}`);
  return codes;
}

export const format = (codes) => JSON.stringify(codes, null, 2) + '\n';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [slug, file] = process.argv.slice(2);
  if (!slug || !file) { console.error('usage: chapter-code.mjs <slug> <file.html>'); process.exit(2); }
  if (!ALLOWED_JSDOM_ERRORS[slug]) { console.error(`chapter-code: add '${slug}' to ALLOWED_JSDOM_ERRORS first`); process.exit(2); }
  const codes = chapterCode(fs.readFileSync(path.join(studio, '..', 'site', file), 'utf8'), ALLOWED_JSDOM_ERRORS[slug]);
  const out = path.join(studio, 'src/chapters/pages', `${slug}.code.json`);
  fs.writeFileSync(out, format(codes));
  console.log(`chapter-code: ${codes.length} samples -> ${path.relative(process.cwd(), out)}`);
}
