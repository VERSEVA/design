// The Swift package bundles the type trio. Each family ships with its licence text, and each
// font file's own name table must say the same licence the text file does (#130).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fonts = path.join(here, '..', 'swift', 'Sources', 'VersevaDesign', 'Resources', 'Fonts');

const FAMILIES = [
  { dir: 'Archivo', file: 'Archivo[wdth,wght].ttf', family: 'Archivo' },
  { dir: 'Manrope', file: 'Manrope[wght].ttf', family: 'Manrope' },
  { dir: 'JetBrainsMono', file: 'JetBrainsMono[wght].ttf', family: 'JetBrains Mono' },
];

// Read the strings of an sfnt `name` table for the given name IDs.
// 1 = family, 13 = licence description, 14 = licence URL.
function nameRecords(buf, wanted) {
  const numTables = buf.readUInt16BE(4);
  let table = null;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString('latin1', rec, rec + 4) === 'name') {
      table = { offset: buf.readUInt32BE(rec + 8), length: buf.readUInt32BE(rec + 12) };
    }
  }
  assert.ok(table, 'font has a name table');
  const count = buf.readUInt16BE(table.offset + 2);
  const strings = table.offset + buf.readUInt16BE(table.offset + 4);
  const out = {};
  for (let i = 0; i < count; i++) {
    const rec = table.offset + 6 + i * 12;
    const platform = buf.readUInt16BE(rec);
    const nameId = buf.readUInt16BE(rec + 6);
    if (!wanted.includes(nameId)) continue;
    const start = strings + buf.readUInt16BE(rec + 10);
    const bytes = buf.subarray(start, start + buf.readUInt16BE(rec + 8));
    // Windows (3) and Unicode (0) records are UTF-16BE; Macintosh (1) is single-byte.
    const text = platform === 1 ? bytes.toString('latin1') : Buffer.from(bytes).swap16().toString('utf16le');
    (out[nameId] ??= []).push(text);
  }
  return out;
}

for (const { dir, file, family } of FAMILIES) {
  test(`${family}: the font file is bundled and is a TrueType font`, () => {
    const buf = fs.readFileSync(path.join(fonts, dir, file));
    assert.equal(buf.readUInt32BE(0), 0x00010000, 'sfnt version 1.0');
    const names = nameRecords(buf, [1]);
    assert.ok(names[1]?.some((n) => n.startsWith(family)), `family name is ${family}, got ${names[1]}`);
  });

  test(`${family}: the licence text ships beside the font`, () => {
    const ofl = fs.readFileSync(path.join(fonts, dir, 'OFL.txt'), 'utf8');
    assert.match(ofl, /SIL OPEN FONT LICENSE Version 1\.1/);
    assert.match(ofl, new RegExp(`Copyright .*${family.replace(/ /g, ' ?')}`, 'i'));
  });

  test(`${family}: the font's own licence field is the SIL Open Font License`, () => {
    const names = nameRecords(fs.readFileSync(path.join(fonts, dir, file)), [13, 14]);
    assert.ok(names[13]?.length, 'licence description (name ID 13) is present');
    assert.ok(names[13].every((t) => /SIL Open Font License, Version 1\.1/i.test(t)), `name ID 13: ${names[13]}`);
    assert.ok(names[14]?.length, 'licence URL (name ID 14) is present');
    assert.ok(names[14].every((t) => /openfontlicense\.org|scripts\.sil\.org\/OFL/i.test(t)), `name ID 14: ${names[14]}`);
  });
}

test('nothing else is bundled: one font and one licence per family', () => {
  for (const { dir, file } of FAMILIES) {
    assert.deepEqual(fs.readdirSync(path.join(fonts, dir)).sort(), ['OFL.txt', file].sort());
  }
  assert.deepEqual(fs.readdirSync(fonts).sort(), FAMILIES.map((f) => f.dir).sort());
});
