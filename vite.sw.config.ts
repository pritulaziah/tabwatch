import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome120',
    rollupOptions: {
      input: 'src/background/index.ts',
      output: {
        entryFileNames: 'background.js',
        format: 'es',
        codeSplitting: false,
      },
    },
  },
});
