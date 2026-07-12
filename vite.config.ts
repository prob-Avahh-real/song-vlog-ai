import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 3000 },
  build: {
    outDir: 'dist',
    target: 'es2020',
    minify: 'esbuild',
    chunkSizeWarningLimit: 3000,
  },
  worker: { format: 'es' },
  optimizeDeps: {
    exclude: ['essentia.js'],
  },
});
