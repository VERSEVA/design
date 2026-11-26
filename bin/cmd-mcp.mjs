/** verseva mcp init: wire the verseva MCP server for an agent client. */
import fs from 'node:fs';
import path from 'node:path';

export function mcp({ rest, valueOf, readJson }) {
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
  const existing = fs.existsSync(target.file) ? readJson(target.file) : {};
  const key = client === 'vscode' ? 'servers' : 'mcpServers';
  existing[key] = { ...existing[key], ...target.shape[key] };
  fs.writeFileSync(target.file, JSON.stringify(existing, null, 2) + '\n');
  console.log(`  wrote   ${target.file}`);
  console.log('Your agent can now list, read, add, and GATE-PROVE verseva components.');
  process.exit(0);
}
