import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/__tests__/api/**', 'src/__tests__/perf/**'],
    globals: true,
    css: false,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'text-summary', 'clover'],
      include: ['src/core/**', 'src/modules/**', 'src/plugins/**', 'src/shell/**', 'src/components/**', 'user-plugins/**'],
      exclude: ['src/__tests__/**', 'src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', '**/*.json', '**/*.md', '**/index.js'],
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
