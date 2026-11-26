/** verseva add <name...>: copy registry items, and their deps, into the project as source. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export async function add({ config, dirFlag, rest, localItem, rewriteBlockHrefs, writeFileInto }) {
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

  /* Set when an add copies a file that imports react. */
  let addedReact = false;

  /** The react version installed in the consumer's project (cwd), or null. */
  function installedReact() {
    try {
      const req = createRequire(path.join(process.cwd(), 'package.json'));
      return JSON.parse(fs.readFileSync(req.resolve('react/package.json'), 'utf8')).version ?? null;
    } catch { return null; }
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
      if (/from ['"]react['"]/.test(content)) addedReact = true;
      const finalContent = f.path.endsWith('.html') ? rewriteBlockHrefs(content) : content;
      writeFileInto(dir, f.path, finalContent);
    }
  }

  const dir = dirFlag ?? config.dir ?? 'src/components/verseva';
  const seen = new Set();
  for (const spec of rest) await addOne(spec, dir, seen);
  const react = addedReact ? installedReact() : null;
  if (react && Number.parseInt(react, 10) < 18) console.error(`verseva: react ${react} is installed; the React parts need React 18 or later.`);
  console.log(`\nYours now. Edit freely; re-run with --force to reset to the kit's cut.`);
  process.exit(0);
}
