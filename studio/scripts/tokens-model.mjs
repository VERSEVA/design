// Placeholder until lane L1 lands the parser; keeps tokens.json present.
import fs from 'node:fs';
const out = new URL('../src/data/tokens.json', import.meta.url);
if (!fs.existsSync(out)) fs.writeFileSync(out, '[]\n');
