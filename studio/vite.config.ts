import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));

/* Dev only: serve the legacy site and package files the way out/ will (assemble.mjs). */
const legacyFiles = () => ({
  name: 'legacy-files',
  configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b: Buffer) => void }, next: () => void) => void) => void } }) {
    const repo = path.resolve(here, '..');
    const types: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4' };
    server.middlewares.use((req, res, next) => {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      if (url === '/' || url.startsWith('/@') || url.startsWith('/src/') || url.startsWith('/node_modules/') || url.startsWith('/library/')) return next();
      for (const base of [path.join(repo, 'site'), repo]) {
        const f = path.join(base, url);
        if (f.startsWith(repo) && fs.existsSync(f) && fs.statSync(f).isFile()) {
          res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
          return res.end(fs.readFileSync(f));
        }
      }
      next();
    });
  },
});

export default defineConfig({
  root: here,
  plugins: [react(), legacyFiles()],
  publicDir: 'public',
  // The package's react/ kit lives outside studio/; resolve its react from here.
  resolve: { alias: [{ find: /^react(\/.*)?$/, replacement: `${here}node_modules/react$1` }] },
  build: { outDir: 'dist', emptyOutDir: true, assetsDir: '_s' },
  server: { port: 4393, strictPort: true, fs: { allow: ['..'] } },
  test: { environment: 'jsdom', globals: true, testTimeout: 30_000, setupFiles: ['test/setup.ts'], include: ['test/**/*.test.{ts,tsx}'] },
});
