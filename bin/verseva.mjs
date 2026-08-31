#!/usr/bin/env node
/**
 * verseva: the source-distribution CLI. Like the shadcn model, components land
 * in YOUR project as source you own; unlike anything else, the gate suite can
 * prove the result stayed on-signature.
 *
 * Commands:
 *   verseva list                       what the registry holds
 *   verseva init                       verseva.json + a "gate" script + import hints
 *   verseva add <name...> [--dir d] [--force]
 *       name forms: bare (this package's registry), @ns/name (a namespace from
 *       verseva.json "registries"), a full https URL, or a local .json item file
 *   verseva block add <name> [--dir d] [--force]
 *   verseva theme add <name> [--dir d] [--force]   gate-proven accent presets
 *   verseva build [--output d]         flatten the registry into hostable
 *                                      per-item JSON (default site/r)
 *   verseva mcp init [--client claude|cursor|vscode]
 *                                      wire the verseva MCP server for agents
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'registry.json'), 'utf8'));

const args = process.argv.slice(2);
const flags = { force: args.includes('--force') };
const valueOf = (flag) => {
  const ix = args.indexOf(flag);
  return ix !== -1 ? args[ix + 1] : null;
};
const flagValueIxs = new Set(['--dir', '--output', '--client'].map((f) => {
  const ix = args.indexOf(f);
  return ix === -1 ? -1 : ix + 1;
}));
const dirFlag = valueOf('--dir');
const words = args.filter((a, i) => !a.startsWith('--') && !flagValueIxs.has(i));
const [cmd, ...rest] = words;

const config = fs.existsSync('verseva.json')
  ? JSON.parse(fs.readFileSync('verseva.json', 'utf8'))
  : {};

/** Containment: written filenames flatten to basenames, extensions are
    allowlisted, and an existing symlink destination is refused outright
    (a symlink would carry the write outside the target directory). */
const ALLOWED_EXT = new Set(['.tsx', '.ts', '.jsx', '.js', '.css', '.html']);

function writeFileInto(destDir, name, content) {
  const base = path.basename(name);
  if (!ALLOWED_EXT.has(path.extname(base))) {
    console.error(`refused: ${base} (${path.extname(base) || 'no extension'} is not an installable type; allowed: ${[...ALLOWED_EXT].join(' ')})`);
    process.exit(1);
  }
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, base);
  let existing = null;
  try { existing = fs.lstatSync(dest); } catch { /* new file */ }
  if (existing?.isSymbolicLink()) {
    console.error(`refused: ${dest} is a symlink; will not write through it`);
    process.exit(1);
  }
  if (existing && !flags.force) {
    console.log(`  kept    ${dest} (exists; --force overwrites)`);
    return dest;
  }
  fs.writeFileSync(dest, content);
  console.log(`  wrote   ${dest}`);
  return dest;
}

const rewriteBlockHrefs = (html) => html
  .replace(/href="(?:\.\.\/)+tokens\.css[^"]*"/g, 'href="node_modules/@verseva/design/tokens.css"')
  .replace(/href="(?:\.\.\/)+components\.css[^"]*"/g, 'href="node_modules/@verseva/design/components.css"');

function localItem(name) {
  const comp = registry.components.find((c) => c.name === name);
  if (!comp) return null;
  const src = path.resolve(pkgRoot, comp.file);
  if (!src.startsWith(path.resolve(pkgRoot) + path.sep)) {
    console.error(`refused: registry file ${comp.file} resolves outside the package`);
    process.exit(1);
  }
  return {
    name: comp.name,
    kind: comp.kind,
    description: comp.description,
    deps: comp.deps,
    files: [{ path: comp.file, content: fs.readFileSync(src, 'utf8') }],
  };
}

function requireHttps(url) {
  const u = new URL(url);
  if (u.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(u.hostname)) {
    console.error(`refused: ${url} is cleartext http; registries must be https (localhost excepted)`);
    process.exit(1);
  }
  return u;
}

async function fetchJson(url) {
  const u = requireHttps(url);
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch (e) {
    console.error(`fetch failed: ${url} (${e?.cause?.code ?? e?.name ?? e})`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`fetch failed: ${url} (${res.status})`);
    process.exit(1);
  }
  try {
    return { json: await res.json(), origin: u.origin };
  } catch {
    console.error(`not a registry item: ${url} (expected JSON, got ${res.headers.get('content-type') ?? 'unknown'})`);
    process.exit(1);
  }
}

/** Resolve a spec to an item + its trust context. Remote deps stay pinned to
    the origin (and template) of the item that declared them. */
async function fetchItem(spec, parentCtx) {
  if (spec.startsWith('@')) {
    if (parentCtx) {
      console.error(`refused: remote item declared a cross-namespace dep (${spec}); deps must stay in their own registry`);
      process.exit(1);
    }
    const slash = spec.indexOf('/');
    const ns = spec.slice(0, slash);
    const name = spec.slice(slash + 1);
    const template = config.registries?.[ns];
    if (!template) {
      console.error(`unknown namespace ${ns}: add it to verseva.json under "registries", e.g. {"${ns}": "https://host/r/{name}.json"}`);
      process.exit(1);
    }
    const url = template.replace('{name}', name);
    const { json, origin } = await fetchJson(url);
    return { item: json, ctx: { origin, template } };
  }
  if (spec.startsWith('http://') || spec.startsWith('https://')) {
    const origin = requireHttps(spec).origin;
    if (parentCtx && parentCtx.origin !== origin) {
      console.error(`refused: dep ${spec} crosses origins (item came from ${parentCtx.origin})`);
      process.exit(1);
    }
    const { json } = await fetchJson(spec);
    return { item: json, ctx: { origin, template: parentCtx?.template ?? null, url: spec } };
  }
  if (spec.endsWith('.json') && fs.existsSync(spec)) {
    return { item: JSON.parse(fs.readFileSync(spec, 'utf8')), ctx: { origin: 'file', template: null } };
  }
  return null;
}

function validateItemFiles(spec, item, isFetched) {
  if (!Array.isArray(item.files) || item.files.length === 0) {
    console.error(`malformed item ${spec}: no files array`);
    process.exit(1);
  }
  for (const f of item.files) {
    if (typeof f?.path !== 'string' || f.path.length === 0) {
      console.error(`malformed item ${spec}: a file entry has no path`);
      process.exit(1);
    }
    if (isFetched && typeof f.content !== 'string') {
      console.error(`refused: ${spec} file ${f.path} does not embed content; fetched and file items must embed content as a string`);
      process.exit(1);
    }
  }
}

async function addOne(spec, dir, seen, depth = 0, parentCtx = null) {
  if (depth > 10) {
    console.error('dependency chain deeper than 10; refusing (cycle?)');
    process.exit(1);
  }
  if (seen.size > 50) {
    console.error('more than 50 items in one add; refusing');
    process.exit(1);
  }
  if (seen.has(spec)) return;
  seen.add(spec);

  const fetched = await fetchItem(spec, parentCtx);
  const item = fetched ? fetched.item : localItem(spec);
  if (!item) {
    console.error(`unknown component: ${spec} (try: verseva list)`);
    process.exit(1);
  }
  validateItemFiles(spec, item, !!fetched);
  for (const dep of item.deps ?? []) {
    if (typeof dep !== 'string') continue;
    let depSpec = dep;
    if (fetched) {
      if (dep.startsWith('http://') || dep.startsWith('https://')) depSpec = dep;
      else if (fetched.ctx.template) depSpec = fetched.ctx.template.replace('{name}', dep);
      else if (fetched.ctx.url) depSpec = new URL(`${dep}.json`, fetched.ctx.url).href;
      else depSpec = dep;
    }
    await addOne(depSpec, dir, seen, depth + 1, fetched?.ctx ?? null);
  }
  for (const f of item.files) {
    const content = f.content;
    const finalContent = f.path.endsWith('.html') ? rewriteBlockHrefs(content) : content;
    writeFileInto(dir, f.path, finalContent);
  }
}

if (cmd === 'list') {
  console.log('components');
  for (const c of registry.components) console.log(`  ${c.name.padEnd(12)} ${c.description}`);
  console.log('blocks');
  for (const b of registry.blocks) console.log(`  ${b.name.padEnd(12)} ${b.description}${b.assets ? ' [repo assets]' : ''}`);
  console.log('themes');
  for (const t of registry.themes) console.log(`  ${t.name.padEnd(12)} ${t.description}`);
  process.exit(0);
}

if (cmd === 'init') {
  if (!fs.existsSync('verseva.json')) {
    fs.writeFileSync('verseva.json', JSON.stringify({ dir: 'src/components/verseva', registries: {} }, null, 2) + '\n');
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
  console.log('Agents: npx verseva mcp init');
  console.log('Ship only what passes: npm run gate');
  process.exit(0);
}

if (cmd === 'add' && rest[0] !== undefined) {
  const dir = dirFlag ?? config.dir ?? 'src/components/verseva';
  const seen = new Set();
  for (const spec of rest) await addOne(spec, dir, seen);
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
  const html = rewriteBlockHrefs(fs.readFileSync(path.join(pkgRoot, block.file), 'utf8'));
  writeFileInto(dir, `${block.name}.html`, html);
  console.log('  css hrefs point at node_modules');
  process.exit(0);
}

if (cmd === 'theme' && rest[0] === 'add' && rest[1]) {
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

if (cmd === 'build') {
  const out = valueOf('--output') ?? path.resolve('r');
  fs.mkdirSync(out, { recursive: true });
  let count = 0;
  for (const c of registry.components) {
    const item = localItem(c.name);
    fs.writeFileSync(path.join(out, `${c.name}.json`), JSON.stringify(item, null, 2) + '\n');
    count++;
  }
  for (const b of registry.blocks.filter((x) => !x.source)) {
    const item = {
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

if (cmd === 'mcp' && rest[0] === 'init') {
  const client = valueOf('--client') ?? 'claude';
  const server = { command: 'npx', args: ['-y', '-p', '@verseva/design', 'verseva-mcp'] };
  const targets = {
    claude: { file: '.mcp.json', shape: { mcpServers: { verseva: server } } },
    cursor: { file: '.cursor/mcp.json', shape: { mcpServers: { verseva: server } } },
    vscode: { file: '.vscode/mcp.json', shape: { servers: { verseva: { ...server, type: 'stdio' } } } },
  };
  const target = targets[client];
  if (!target) {
    console.error(`unknown client: ${client} (claude | cursor | vscode)`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(target.file) || '.', { recursive: true });
  const existing = fs.existsSync(target.file) ? JSON.parse(fs.readFileSync(target.file, 'utf8')) : {};
  const key = client === 'vscode' ? 'servers' : 'mcpServers';
  existing[key] = { ...existing[key], ...target.shape[key] };
  fs.writeFileSync(target.file, JSON.stringify(existing, null, 2) + '\n');
  console.log(`  wrote   ${target.file}`);
  console.log('Your agent can now list, read, add, and GATE-PROVE verseva components.');
  process.exit(0);
}

console.log(`verseva · the source-distribution CLI

  npx verseva list
  npx verseva init
  npx verseva add <name | @ns/name | url | file.json ...> [--dir d] [--force]
  npx verseva block add <name> [--dir d] [--force]
  npx verseva theme add <name> [--dir d] [--force]
  npx verseva build [--output d]
  npx verseva mcp init [--client claude|cursor|vscode]`);
process.exit(cmd === undefined || cmd === 'help' ? 0 : 2);
