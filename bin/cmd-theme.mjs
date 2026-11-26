/** verseva theme add <name>: copy one gate-proven accent preset. */
import fs from 'node:fs';
import path from 'node:path';

export const match = 'theme';
export const order = 50;
export const usage = ['npx verseva theme add <name> [--dir d] [--force]'];

/* Returning without exiting hands over to the help text (exit 2). */
export function run({ pkgRoot, registry, dirFlag, rest, writeFileInto }) {
  if (rest[0] !== 'add' || !rest[1]) return;
  const theme = registry.themes.find((t) => t.name === rest[1]);
  if (!theme) {
    console.error(`unknown theme: ${rest[1]} (try: verseva list)`);
    process.exit(1);
  }
  const dir = dirFlag ?? 'verseva-themes';
  writeFileInto(dir, `${theme.name}.css`, fs.readFileSync(path.join(pkgRoot, theme.file), 'utf8'));
  console.log(`  link it after tokens.css, set <html data-brand="${theme.name}">`);
  console.log(`  it stays proven: verseva-contrast-gate --tokens tokens.css --tokens ${dir}/${theme.name}.css`);
  process.exit(0);
}
