import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          globals: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['tests/ui/components/**/*.test.tsx'],
          setupFiles: ['tests/ui/components/setup.ts'],
          globals: false,
        },
      },
    ],
  },
});
