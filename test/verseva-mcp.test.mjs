import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'verseva-mcp.mjs');
const fx = (...p) => path.join(here, 'fixtures', ...p);

/** Drive the stdio server: send newline-delimited JSON-RPC, collect responses by id. */
function session(requests, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin], { stdio: ['pipe', 'pipe', 'pipe'] });
    const wanted = new Set(requests.filter((r) => r.id !== undefined).map((r) => r.id));
    const got = {};
    let buf = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`mcp timeout; got ids ${Object.keys(got)}`)); }, timeoutMs);
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

test('initialize + tools/list expose the seven tools', async () => {
  const got = await session([
    { id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
    { method: 'notifications/initialized' },
    { id: 2, method: 'tools/list' },
  ]);
  assert.equal(got[1].result.serverInfo.name, 'verseva');
  const names = got[2].result.tools.map((t) => t.name);
  for (const n of ['list_registry', 'get_component', 'get_block', 'get_tokens', 'get_laws', 'add_component', 'run_gate']) {
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
  ], { timeoutMs: 30000 });
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

test('run_gate proves a clean path and fails a dirty one', async () => {
  const got = await session([
    { id: 1, method: 'initialize', params: {} },
    { id: 2, method: 'tools/call', params: { name: 'run_gate', arguments: { paths: [fx('proj-type', 'good.css')] } } },
    { id: 3, method: 'tools/call', params: { name: 'run_gate', arguments: { paths: [fx('proj-seam', 'inline.html')] } } },
  ], { timeoutMs: 30000 });
  assert.match(got[2].result.content[0].text, /ON-SIGNATURE, proven/);
  assert.equal(got[3].result.isError, true);
  assert.match(got[3].result.content[0].text, /GATE FAILED/);
});
