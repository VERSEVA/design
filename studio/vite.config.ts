import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  publicDir: 'public',
  // The package's react/ kit lives outside studio/; resolve its react from here.
  resolve: { alias: [{ find: /^react(\/.*)?$/, replacement: `${here}node_modules/react$1` }] },
  build: { outDir: 'dist', emptyOutDir: true, assetsDir: '_s' },
  server: { port: 4393, strictPort: true, fs: { allow: ['..'] } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['test/setup.ts'], include: ['test/**/*.test.{ts,tsx}'] },
});
