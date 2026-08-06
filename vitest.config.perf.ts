import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Performance tests (store.perf, memory.perf) are heavy / GC-dependent and are
// intentionally excluded from the default suite (vitest.config.ts). Run them on
// demand with --expose-gc:
//
//   npx vitest run --config vitest.config.perf.ts src/__tests__/perf/
//
// The node environment is used (no jsdom) and a zero-quota localStorage polyfill
// is installed by src/__tests__/setup.ts because the store depends on persist.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/perf/**/*.test.{ts,tsx}'],
    globals: true,
    css: false,
    isolate: true,
    poolOptions: {
      forks: {
        execArgv: ['--expose-gc'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@user-plugins': path.resolve(__dirname, './user-plugins'),
      'plugin-sdk': path.resolve(__dirname, './src/plugin-sdk'),
    },
  },
});