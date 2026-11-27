/** verseva build: flatten the registry into hostable per-item JSON. */
import fs from 'node:fs';
import path from 'node:path';

export const match = 'build';
export const order = 60;
export const usage = ['npx verseva build [--output d]'];

export function run({ pkgRoot, registry, valueOf, localItem, templateItem }) {
  const out = valueOf('--output') ?? path.resolve('r');
  fs.mkdirSync(out, { recursive: true });
  let count = 0;
  for (const c of registry.components) {
    const item = localItem(c.name);
    fs.writeFileSync(path.join(out, `${c.name}.json`), JSON.stringify(item, null, 2) + '\n');
    count++;
  }
  for (const b of registry.blocks.filter((x) => !x.source)) {
    const item = b.kind === 'template' ? templateItem(b.name) : {
      name: b.name,
      kind: 'block',
      description: b.description,
      deps: [],
      files: [{ path: `${b.name}.html`, content: fs.readFileSync(path.join(pkgRoot, b.file), 'utf8') }],
    };
    fs.writeFileSync(path.join(out, `${b.name}.json`), JSON.stringify(item, null, 2) + '\n');
    count++;
  }
  for (const t of registry.themes) {
    const item = {
      name: t.name,
      kind: 'theme',
      description: t.description,
      deps: [],
      files: [{ path: `${t.name}.css`, content: fs.readFileSync(path.join(pkgRoot, t.file), 'utf8') }],
    };
    fs.writeFileSync(path.join(out, `${t.name}.json`), JSON.stringify(item, null, 2) + '\n');
    count++;
  }
  fs.writeFileSync(path.join(out, 'registry.json'), JSON.stringify(registry, null, 2) + '\n');
  console.log(`verseva build: ${count} items + registry.json -> ${out}`);
  console.log('Host that directory and consumers add it to verseva.json:');
  console.log('  { "registries": { "@you": "https://your.host/r/{name}.json" } }');
  process.exit(0);
}
