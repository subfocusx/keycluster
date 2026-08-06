import { describe, it, expect, vi } from 'vitest';
import { loadUserPluginManifest, ModuleLoadError } from '@/plugin-sdk';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  appLocalDataDir: vi.fn().mockResolvedValue('/mock/data/'),
  join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
}));

describe('loadUserPluginManifest', () => {
  it('reads and parses manifest from Tauri fs path', async () => {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({
      id: 'test-user-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
    }));

    const manifest = await loadUserPluginManifest('test-user-plugin');
    expect(manifest.id).toBe('test-user-plugin');
    expect(manifest.name).toBe('Test Plugin');
    expect(manifest.version).toBe('1.0.0');
  });

  it('throws ModuleLoadError when file not found', async () => {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(readTextFile).mockRejectedValue(new Error('File not found'));

    await expect(loadUserPluginManifest('nonexistent')).rejects.toThrow(ModuleLoadError);
  });
});
