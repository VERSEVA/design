// The code samples a legacy chapter built in the browser: its inline script filled
// every empty `.codewrap code` with the dedented innerHTML of its specimen, after
// its own drawing code ran. A React port cannot rebuild them from its own DOM (no
// source whitespace, CSSOM-serialized styles), so this runs the frozen page's
// script in jsdom and writes the exact text to pages/<slug>.code.json.
// usage: node studio/scripts/chapter-code.mjs <slug> <file.html>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const studio = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM, VirtualConsole } = createRequire(path.join(studio, 'package.json'))('jsdom');
const [slug, file] = process.argv.slice(2);
if (!slug || !file) { console.error('usage: chapter-code.mjs <slug> <file.html>'); process.exit(2); }

/* Browsers write numbers set through the CSSOM with 6 significant digits
   (top: 33.5714%); jsdom writes them in full. The samples keep the browser form. */
const cssomNumbers = (text) => text.replace(/ style="([^"]*)"/g, (_, v) =>
  ` style="${v.replace(/-?\d+\.\d{5,}/g, (n) => String(Number(Number(n).toPrecision(6))))}"`);

const html = fs.readFileSync(path.join(studio, '..', 'site', file), 'utf8');
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (e) => { if (!/getContext|Not implemented/.test(e.message)) throw e; });
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole });
const codes = [...dom.window.document.querySelectorAll('.comp')].flatMap((comp) => {
  const code = comp.querySelector('.codewrap code');
  return code && comp.querySelector('.specimen') ? [cssomNumbers(code.textContent)] : [];
});
dom.window.close();
const out = path.join(studio, 'src/chapters/pages', `${slug}.code.json`);
fs.writeFileSync(out, JSON.stringify(codes, null, 2) + '\n');
console.log(`chapter-code: ${codes.length} samples -> ${path.relative(process.cwd(), out)}`);
