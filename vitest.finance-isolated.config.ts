import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
    include: ['**/*.pg-isolated.test.ts'],
    setupFiles: ['./vitest.finance-isolated.setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
