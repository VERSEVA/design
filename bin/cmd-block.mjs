/** verseva block add <name>: copy one block as a standalone page. */
import fs from 'node:fs';
import path from 'node:path';

export function block({ pkgRoot, registry, dirFlag, rest, rewriteBlockHrefs, writeFileInto }) {
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
  const html = rewriteBlockHrefs(fs.readFileSync(path.join(pkgRoot, block.file), 'utf8'));
  writeFileInto(dir, `${block.name}.html`, html);
  console.log('  css hrefs point at node_modules');
  process.exit(0);
}
