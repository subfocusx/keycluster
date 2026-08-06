import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import type { PluginOption } from 'vite';

const host = process.env.TAURI_DEV_HOST;

// Copies user-plugins/*/manifest.json to dist/user-plugins/*/manifest.json
// so that fetch('/user-plugins/{id}/manifest.json') works in production.
function copyPluginManifests(): PluginOption {
  const srcDir = resolve(__dirname, 'user-plugins');
  const destDir = resolve(__dirname, 'dist', 'user-plugins');
  return {
    name: 'copy-user-plugins-manifests',
    enforce: 'post',
    closeBundle() {
      if (!existsSync(srcDir)) return;
      for (const dir of readdirSync(srcDir)) {
        const manifestSrc = join(srcDir, dir, 'manifest.json');
        if (!existsSync(manifestSrc) || statSync(manifestSrc).isDirectory()) continue;
        const manifestDest = join(destDir, dir, 'manifest.json');
        mkdirSync(dirname(manifestDest), { recursive: true });
        copyFileSync(manifestSrc, manifestDest);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyPluginManifests()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || '127.0.0.1',
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  resolve: {
    extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      'plugin-sdk': path.resolve(__dirname, './src/plugin-sdk'),
      '@user-plugins': path.resolve(__dirname, './user-plugins'),
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari15',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
