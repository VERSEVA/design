/** verseva init: verseva.json, a "gate" script and the import hints. */
import fs from 'node:fs';

export const match = 'init';
export const order = 20;
export const usage = ['npx verseva init'];

export function run({ readJson }) {
  if (!fs.existsSync('verseva.json')) {
    fs.writeFileSync('verseva.json', JSON.stringify({ dir: 'src/components/verseva', registries: {} }, null, 2) + '\n');
    console.log('  wrote   verseva.json');
  }
  if (fs.existsSync('package.json')) {
    const pkg = readJson('package.json');
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
  console.log('Agents: npx verseva mcp init');
  console.log('Ship only what passes: npm run gate');
  process.exit(0);
}
