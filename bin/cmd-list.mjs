/** verseva list: what the registry holds. */
export const match = 'list';
export const order = 10;
export const usage = ['npx verseva list'];

export function run({ registry }) {
  const all = [...registry.components, ...registry.blocks, ...registry.themes];
  const width = Math.max(...all.map((x) => x.name.length)) + 2;
  console.log('components');
  for (const c of registry.components) console.log(`  ${c.name.padEnd(width)}${c.description}`);
  console.log('blocks');
  for (const b of registry.blocks) console.log(`  ${b.name.padEnd(width)}${b.description}${b.assets ? ' [repo assets]' : ''}`);
  console.log('themes');
  for (const t of registry.themes) console.log(`  ${t.name.padEnd(width)}${t.description}`);
  process.exit(0);
}
