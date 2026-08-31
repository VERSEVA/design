#!/usr/bin/env node
/**
 * verseva: the source-distribution CLI. Like the shadcn model, components land
 * in YOUR project as source you own; unlike anything else, the gate suite can
 * prove the result stayed on-signature.
 *
 * Commands:
 *   verseva list                     what the registry holds
 *   verseva init                     verseva.json + a "gate" script + import hints
 *   verseva add <name...> [--dir d] [--force]   copy React source (deps resolved)
 *   verseva block add <name> [--dir d] [--force] copy a full working page, css
 *                                    hrefs rewritten to node_modules paths
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'registry.json'), 'utf8'));

const args = process.argv.slice(2);
const flags = { force: args.includes('--force') };
const dirIx = args.indexOf('--dir');
const dirFlag = dirIx !== -1 ? args[dirIx + 1] : null;
const dirValueIx = dirIx === -1 ? -1 : dirIx + 1;
const words = args.filter((a, i) => !a.startsWith('--') && i !== dirValueIx);
const [cmd, ...rest] = words;

const config = fs.existsSync('verseva.json')
  ? JSON.parse(fs.readFileSync('verseva.json', 'utf8'))
  : {};

function copyInto(srcRel, destDir, destName) {
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, destName);
  if (fs.existsSync(dest) && !flags.force) {
    console.log(`  kept    ${dest} (exists; --force overwrites)`);
    return false;
  }
  fs.copyFileSync(path.join(pkgRoot, srcRel), dest);
  console.log(`  wrote   ${dest}`);
  return true;
}

if (cmd === 'list') {
  console.log('components');
  for (const c of registry.components) console.log(`  ${c.name.padEnd(12)} ${c.description}`);
  console.log('blocks');
  for (const b of registry.blocks) console.log(`  ${b.name.padEnd(12)} ${b.description}${b.assets ? ' [repo assets]' : ''}`);
  process.exit(0);
}

if (cmd === 'init') {
  if (!fs.existsSync('verseva.json')) {
    fs.writeFileSync('verseva.json', JSON.stringify({ dir: 'src/components/verseva' }, null, 2) + '\n');
    console.log('  wrote   verseva.json');
  }
  if (fs.existsSync('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.scripts ??= {};
    if (!pkg.scripts.gate) {
      pkg.scripts.gate = 'verseva-gate --tokens node_modules/@verseva/design/tokens.css src';
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
      console.log('  added   "gate" script to package.json');
    }
  }
  console.log('\nImport the signature once, near your app root:');
  console.log("  import '@verseva/design/tokens.css';");
  console.log("  import '@verseva/design/components.css';");
  console.log('\nThen: npx verseva add button field toast');
  console.log('Ship only what passes: npm run gate');
  process.exit(0);
}

if (cmd === 'add' && rest[0] !== undefined && rest[0] !== 'block') {
  const dir = dirFlag ?? config.dir ?? 'src/components/verseva';
  const wanted = new Set();
  for (const name of rest) {
    const comp = registry.components.find((c) => c.name === name);
    if (!comp) {
      console.error(`unknown component: ${name} (try: verseva list)`);
      process.exit(1);
    }
    wanted.add(comp.name);
    for (const d of comp.deps) wanted.add(d);
  }
  for (const name of wanted) {
    const comp = registry.components.find((c) => c.name === name);
    copyInto(comp.file, dir, path.basename(comp.file));
  }
  console.log(`\nYours now. Edit freely; re-run with --force to reset to the kit's cut.`);
  process.exit(0);
}

if (cmd === 'block' && rest[0] === 'add' && rest[1]) {
  const block = registry.blocks.find((b) => b.name === rest[1]);
  if (!block) {
    console.error(`unknown block: ${rest[1]} (try: verseva list)`);
    process.exit(1);
  }
  if (block.source === 'repo') {
    console.error(`${block.name} ships with image assets and lives in the repo: github.com/verseva/design (site/examples/${block.name}.html + assets). Copy it from there.`);
    process.exit(1);
  }
  const dir = dirFlag ?? 'verseva-blocks';
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${block.name}.html`);
  if (fs.existsSync(dest) && !flags.force) {
    console.log(`  kept    ${dest} (exists; --force overwrites)`);
    process.exit(0);
  }
  const html = fs.readFileSync(path.join(pkgRoot, block.file), 'utf8')
    .replace(/href="(?:\.\.\/)+tokens\.css[^"]*"/g, 'href="node_modules/@verseva/design/tokens.css"')
    .replace(/href="(?:\.\.\/)+components\.css[^"]*"/g, 'href="node_modules/@verseva/design/components.css"');
  fs.writeFileSync(dest, html);
  console.log(`  wrote   ${dest} (css hrefs point at node_modules)`);
  process.exit(0);
}

console.log(`verseva · the source-distribution CLI

  npx verseva list
  npx verseva init
  npx verseva add <component...> [--dir d] [--force]
  npx verseva block add <name> [--dir d] [--force]`);
process.exit(cmd === undefined || cmd === 'help' ? 0 : 2);
