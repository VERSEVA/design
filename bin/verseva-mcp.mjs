#!/usr/bin/env node
/**
 * verseva-mcp: the design system as an MCP server, zero dependencies.
 * Agents can list the registry, read any component's source, install it into
 * the project, read the tokens and the laws, and — the part no other design
 * system offers — RUN THE GATE SUITE to prove their output stayed on-signature.
 *
 * Wire it: npx verseva mcp init --client claude|cursor|vscode
 * Transport: stdio, newline-delimited JSON-RPC 2.0 (the MCP stdio framing).
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'registry.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));

const TOOLS = [
  {
    name: 'list_registry',
    description: 'Everything installable: components (typed React source), blocks (full working pages), and gate-proven theme presets.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_component',
    description: 'The full source of one registry component, plus its dependencies. Read before installing or imitating.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false },
  },
  {
    name: 'get_block',
    description: 'The full HTML of one block: a complete working page on the signature.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false },
  },
  {
    name: 'get_tokens',
    description: 'tokens.css verbatim: the color ladders, one accent, type trio, spacing scale, radius posture, motion. Every value you are allowed to use.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_laws',
    description: 'The fourteen laws of the signature, dated and amended in the open. Binding on every surface built on the package.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'add_component',
    description: 'Copy a component (dependencies resolved) into the project as source the user owns. dir defaults to src/components/verseva.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, dir: { type: 'string' } }, required: ['name'], additionalProperties: false },
  },
  {
    name: 'run_gate',
    description: 'Run the full 4-gate suite (hex, contrast, spacing, type) on project paths and return the verdict. Exit-clean output means the work is provably on-signature; violations come back as file:line. Use this to prove your own output before telling the user it is done.',
    inputSchema: {
      type: 'object',
      properties: {
        paths: { type: 'array', items: { type: 'string' }, description: 'files or directories to gate; default ["."]' },
        extra_tokens: { type: 'array', items: { type: 'string' }, description: 'additional token/theme css files (e.g. a brand theme) to authorize and measure' },
      },
      additionalProperties: false,
    },
  },
];

const text = (s) => ({ content: [{ type: 'text', text: s }] });
const errText = (s) => ({ content: [{ type: 'text', text: s }], isError: true });

function callTool(name, args = {}) {
  if (name === 'list_registry') {
    const lines = ['components:'];
    for (const c of registry.components) lines.push(`  ${c.name} — ${c.description}`);
    lines.push('blocks:');
    for (const b of registry.blocks) lines.push(`  ${b.name} — ${b.description}${b.source === 'repo' ? ' [repo-only: image assets]' : ''}`);
    lines.push('themes:');
    for (const t of registry.themes) lines.push(`  ${t.name} — ${t.description}`);
    return text(lines.join('\n'));
  }
  if (name === 'get_component') {
    const comp = registry.components.find((c) => c.name === args.name);
    if (!comp) return errText(`unknown component: ${args.name}`);
    const source = fs.readFileSync(path.join(pkgRoot, comp.file), 'utf8');
    const deps = comp.deps.length ? `\n\n// deps: ${comp.deps.join(', ')} (add them too)` : '';
    return text(`// ${comp.file}\n${source}${deps}`);
  }
  if (name === 'get_block') {
    const block = registry.blocks.find((b) => b.name === args.name);
    if (!block) return errText(`unknown block: ${args.name}`);
    if (block.source === 'repo') return errText(`${block.name} is repo-only (image assets): github.com/verseva/design site/examples/${block.name}.html`);
    return text(fs.readFileSync(path.join(pkgRoot, block.file), 'utf8'));
  }
  if (name === 'get_tokens') return text(fs.readFileSync(path.join(pkgRoot, 'tokens.css'), 'utf8'));
  if (name === 'get_laws') return text(fs.readFileSync(path.join(pkgRoot, 'docs', 'laws.md'), 'utf8'));
  if (name === 'add_component') {
    const comp = registry.components.find((c) => c.name === args.name);
    if (!comp) return errText(`unknown component: ${args.name}`);
    const dir = path.resolve(args.dir ?? 'src/components/verseva');
    if (dir !== process.cwd() && !dir.startsWith(process.cwd() + path.sep)) {
      return errText(`refused: dir resolves outside the project (${dir}); add_component writes inside the working directory only`);
    }
    const written = [];
    for (const dep of [...comp.deps, comp.name]) {
      const item = registry.components.find((c) => c.name === dep);
      if (!item) return errText(`registry is inconsistent: dep ${dep} not found`);
      fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, path.basename(item.file));
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(pkgRoot, item.file), dest);
        written.push(dest);
      }
    }
    return text(written.length ? `wrote:\n${written.join('\n')}` : 'nothing to write (files exist)');
  }
  if (name === 'run_gate') {
    /* The verdict is only worth anything if the caller cannot rig the run:
       no flag smuggling (a `--` separator + leading-dash rejection), paths
       contained to the project, and extra tokens only from the package's own
       shipped themes or the files the project's verseva.json declares. */
    const paths = Array.isArray(args.paths) && args.paths.length ? args.paths : ['.'];
    for (const p of paths) {
      if (typeof p !== 'string' || p.startsWith('-')) return errText(`refused path: ${p} (paths must be plain files/dirs, never flags)`);
      const abs = path.resolve(p);
      if (abs !== process.cwd() && !abs.startsWith(process.cwd() + path.sep)) {
        return errText(`refused path: ${p} resolves outside the project`);
      }
    }
    const allowedTokens = new Set();
    try {
      for (const f of fs.readdirSync(path.join(pkgRoot, 'themes'))) allowedTokens.add(path.join(pkgRoot, 'themes', f));
    } catch { /* no themes dir */ }
    try {
      const projectCfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'verseva.json'), 'utf8'));
      for (const t of projectCfg.tokens ?? []) allowedTokens.add(path.resolve(t));
    } catch { /* no verseva.json */ }
    const tokenArgs = ['--tokens', path.join(pkgRoot, 'tokens.css')];
    for (const t of args.extra_tokens ?? []) {
      if (typeof t !== 'string' || t.startsWith('-')) return errText(`refused token file: ${t}`);
      const abs = path.resolve(t);
      if (!allowedTokens.has(abs)) {
        return errText(`refused token file: ${t}. Only the package's shipped themes or files listed under "tokens" in the project's verseva.json can authorize values; a call-time file would let anyone authorize their own hexes.`);
      }
      tokenArgs.push('--tokens', abs);
    }
    try {
      const out = execFileSync(process.execPath, [path.join(pkgRoot, 'bin', 'verseva-gate.mjs'), ...tokenArgs, '--', ...paths], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, maxBuffer: 16 * 1024 * 1024,
      });
      return text(`ON-SIGNATURE, proven.\n\n${out}`);
    } catch (e) {
      if (e.status === undefined) return errText(`GATE ERRORED (did not run): ${e.message}`);
      return errText(`GATE FAILED — fix before shipping.\n\n${e.stdout ?? ''}${e.stderr ?? ''}`);
    }
  }
  return errText(`unknown tool: ${name}`);
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');

rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (Array.isArray(msg)) {
    send({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'batch requests are not supported' } });
    return;
  }
  const { id, method, params } = msg;
  if (method === 'initialize') {
    send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'verseva', version: pkg.version },
        instructions: 'VERSEVA Design as a server. Read get_laws + get_tokens before building; add_component for source; ALWAYS finish surface work with run_gate — done means proven.',
      },
    });
    return;
  }
  if (method === 'notifications/initialized' || method?.startsWith('notifications/')) return;
  if (method === 'ping') { send({ jsonrpc: '2.0', id, result: {} }); return; }
  if (method === 'tools/list') { send({ jsonrpc: '2.0', id, result: { tools: TOOLS } }); return; }
  if (method === 'tools/call') {
    let result;
    try { result = callTool(params?.name, params?.arguments); }
    catch (e) { result = errText(`tool crashed: ${e?.message ?? e}`); }
    send({ jsonrpc: '2.0', id, result });
    return;
  }
  if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
});
