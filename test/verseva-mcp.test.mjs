import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'verseva-mcp.mjs');
const fx = (...p) => path.join(here, 'fixtures', ...p);

/**
 * Per-session bound. Generous so a loaded host (parallel gates, agent sessions) does not
 * flake, still finite so a hung server fails. Override with VERSEVA_TEST_TIMEOUT_MS.
 */
const SESSION_TIMEOUT_MS = Number(process.env.VERSEVA_TEST_TIMEOUT_MS) || 120000;

/** Drive the stdio server: send newline-delimited JSON-RPC, collect responses by id. */
function session(requests, { timeoutMs = SESSION_TIMEOUT_MS, cwd, args = [bin] } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ['pipe', 'pipe', 'pipe'], cwd });
    const wanted = new Set(requests.filter((r) => r.id !== undefined).map((r) => r.id));
    const got = {};
    let buf = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`mcp timeout after ${timeoutMs}ms; got ids ${Object.keys(got)}`)); }, timeoutMs);
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.id !== undefined) {
          got[msg.id] = msg;
          wanted.delete(msg.id);
          if (wanted.size === 0) {
            clearTimeout(timer);
            child.kill();
            resolve(got);
          }
        }
      }
    });
    child.on('error', reject);
    for (const r of requests) child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...r }) + '\n');
  });
}

test('initialize + tools/list expose the eight tools', async () => {
  const got = await session([
    { id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
    { method: 'notifications/initialized' },
    { id: 2, method: 'tools/list' },
  ]);
  assert.equal(got[1].result.serverInfo.name, 'verseva');
  const names = got[2].result.tools.map((t) => t.name);
  for (const n of ['list_registry', 'get_component', 'get_brief', 'get_block', 'get_tokens', 'get_laws', 'add_component', 'run_gate']) {
    assert.ok(names.includes(n), `missing tool ${n}`);
  }
});

test('get_component returns real source; unknown names error without crashing', async () => {
  const got = await session([
    { id: 1, method: 'initialize', params: {} },
    { id: 2, method: 'tools/call', params: { name: 'get_component', arguments: { name: 'button' } } },
    { id: 3, method: 'tools/call', params: { name: 'get_component', arguments: { name: 'nope' } } },
  ]);
  assert.match(got[2].result.content[0].text, /forwardRef/);
  assert.equal(got[3].result.isError, true);
});

test('run_gate cannot be rigged: flag smuggling, escapes, and call-time token files are refused', async () => {
  const got = await session([
    { id: 1, method: 'initialize', params: {} },
    { id: 2, method: 'tools/call', params: { name: 'run_gate', arguments: { paths: ['--allow', 'ugly', '.'] } } },
    { id: 3, method: 'tools/call', params: { name: 'run_gate', arguments: { paths: ['/etc'] } } },
    { id: 4, method: 'tools/call', params: { name: 'run_gate', arguments: { paths: [fx('proj-seam', 'inline.html')], extra_tokens: [fx('tokens-modern.css')] } } },
  ]);
  assert.equal(got[2].result.isError, true);
  assert.match(got[2].result.content[0].text, /never flags/);
  assert.equal(got[3].result.isError, true);
  assert.match(got[3].result.content[0].text, /outside the project/);
  assert.equal(got[4].result.isError, true);
  assert.match(got[4].result.content[0].text, /refused token file/);
});

test('add_component refuses a dir outside the project', async () => {
  const got = await session([
    { id: 1, method: 'initialize', params: {} },
    { id: 2, method: 'tools/call', params: { name: 'add_component', arguments: { name: 'button', dir: '../../escaped' } } },
  ]);
  assert.equal(got[2].result.isError, true);
  assert.match(got[2].result.content[0].text, /outside the project/);
});

test('add_component refuses to write through a dangling symlink', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-mcp-'));
  const proj = path.join(root, 'proj');
  const dir = path.join(proj, 'src', 'components', 'verseva');
  fs.mkdirSync(dir, { recursive: true });
  const outside = path.join(root, 'outside.tsx');
  fs.symlinkSync(outside, path.join(dir, 'button.tsx'));
  const got = await session([
    { id: 1, method: 'initialize', params: {} },
    { id: 2, method: 'tools/call', params: { name: 'add_component', arguments: { name: 'button' } } },
  ], { cwd: proj });
  assert.equal(got[2].result.isError, true);
  assert.match(got[2].result.content[0].text, /refused: .*symlink/);
  assert.equal(fs.existsSync(outside), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('add_component writes the component and its deps into an empty dir', async () => {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-mcp-'));
  const got = await session([
    { id: 1, method: 'initialize', params: {} },
    { id: 2, method: 'tools/call', params: { name: 'add_component', arguments: { name: 'button' } } },
  ], { cwd: proj });
  assert.notEqual(got[2].result.isError, true);
  for (const f of ['button.tsx', 'cx.ts']) assert.ok(fs.existsSync(path.join(proj, 'src', 'components', 'verseva', f)), f);
  fs.rmSync(proj, { recursive: true, force: true });
});

test('run_gate proves a clean path and fails a dirty one', async () => {
  const got = await session([
    { id: 1, method: 'initialize', params: {} },
    { id: 2, method: 'tools/call', params: { name: 'run_gate', arguments: { paths: [fx('proj-type', 'good.css')] } } },
    { id: 3, method: 'tools/call', params: { name: 'run_gate', arguments: { paths: [fx('proj-seam', 'inline.html')] } } },
  ]);
  assert.match(got[2].result.content[0].text, /ON-SIGNATURE, proven/);
  assert.equal(got[3].result.isError, true);
  assert.match(got[3].result.content[0].text, /GATE FAILED/);
});

test('run_gate on a path that does not exist reports GATE ERRORED, not GATE FAILED', async () => {
  const got = await session([
    { id: 1, method: 'initialize', params: {} },
    { id: 2, method: 'tools/call', params: { name: 'run_gate', arguments: { paths: ['nope'] } } },
  ]);
  assert.equal(got[2].result.isError, true);
  assert.match(got[2].result.content[0].text, /^GATE ERRORED/);
  assert.match(got[2].result.content[0].text, /no such file: nope/);
});

test('a hung server fails the session within its timeout', async () => {
  const hang = ['-e', 'setInterval(() => {}, 1000)'];
  const t0 = Date.now();
  await assert.rejects(session([{ id: 1, method: 'initialize', params: {} }], { timeoutMs: 500, args: hang }), /mcp timeout after 500ms; got ids $/);
  assert.ok(Date.now() - t0 < 5000);
});

/** Write raw lines to the server; resolve with the first `count` responses, in order. */
function rawSession(lines, count) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin], { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    let buf = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`mcp timeout; got ${JSON.stringify(out)}`)); }, SESSION_TIMEOUT_MS);
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.trim()) out.push(JSON.parse(line));
        if (out.length === count) { clearTimeout(timer); child.kill(); resolve(out); }
      }
    });
    child.on('error', reject);
    for (const l of lines) child.stdin.write(l + '\n');
  });
}

test('a raw U+2028 or U+2029 inside a request string does not split the line; the call gets its reply', async () => {
  const call = (id, name) => `{"jsonrpc":"2.0","id":${id},"method":"tools/call","params":{"name":"get_brief","arguments":{"name":"${name}"}}}`;
  const got = await rawSession([call(1, 'button x'), call(2, 'card y'), '{"jsonrpc":"2.0","id":3,"method":"ping"}'], 3);
  assert.deepEqual(got.map((m) => m.id), [1, 2, 3]);
  assert.equal(got[0].result.isError, true);
  assert.match(got[0].result.content[0].text, /^refused: "button\?x" is not a registry name/);
  assert.equal(got[1].result.isError, true);
  assert.deepEqual(got[2].result, {});
});

test('a line that does not parse gets -32700 with id null, and the server keeps answering', async () => {
  const got = await rawSession(['{nope', '{"jsonrpc":"2.0","id":7,"method":"ping"}'], 2);
  assert.deepEqual(got[0], { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
  assert.equal(got[1].id, 7);
});

test('a JSON null, number or string line gets -32600 with id null instead of crashing the server', async () => {
  const got = await rawSession(['null', '42', '"tools/list"', '{"jsonrpc":"2.0","id":8,"method":"ping"}'], 4);
  for (const m of got.slice(0, 3)) assert.deepEqual(m, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'invalid request' } });
  assert.equal(got[3].id, 8);
});
