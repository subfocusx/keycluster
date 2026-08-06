import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddPluginSection } from '@/components/plugin-add-section';
import { createRuntime } from '@/core/module-runtime';
import { createStoreAccess } from '@/core/store';
import { executionGate } from '@/core/module-execution-gate';
import { pluginRegistry } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';
import { validateModuleManifest, buildInternalModuleManifest } from '@/core/validation/module-manifest';

vi.mock('@/core/module-loader', () => {
  const createTestManifest = (overrides: Record<string, unknown> = {}) => ({
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'Test',
    slot: [],
    dependencies: [],
    settingsSchema: [],
    ...overrides,
  });

  return {
    loadManifest: vi.fn(async () => {
      const raw = createTestManifest({ slot: ['left-panel'] });
      validateModuleManifest(raw, raw.id);
      return buildInternalModuleManifest(raw);
    }),
    loadModule: vi.fn(async () => {
      const raw = createTestManifest();
      validateModuleManifest(raw, raw.id);
      return {
        manifest: buildInternalModuleManifest(raw),
        init: vi.fn(),
        destroy: vi.fn(),
      };
    }),
    loadUserPluginManifest: vi.fn(async () => {
      const raw = createTestManifest({ slot: ['left-panel'] });
      validateModuleManifest(raw, raw.id);
      return buildInternalModuleManifest(raw);
    }),
    removeFromModuleCache: vi.fn(),
    getModuleCacheKeys: vi.fn().mockReturnValue([]),
    pluginSourceRepo: {
      remove: vi.fn(),
      register: vi.fn(),
    },
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, size, className, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>{children}</button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, disabled, className }: any) => (
    <input value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} className={className} data-testid="input-field" />
  ),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn(() => '/mock/target/my-first-plugin') }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(() => Promise.resolve('')),
  writeTextFile: vi.fn(() => Promise.resolve()),
  copyFile: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve()),
  exists: vi.fn(() => Promise.resolve(true)),
  readDir: vi.fn(() => Promise.resolve([{ name: 'manifest.json', isDirectory: false }])),
}));
vi.mock('@tauri-apps/api/path', () => ({ appLocalDataDir: vi.fn(), resourceDir: vi.fn(() => Promise.resolve('/mock/resource')), join: vi.fn((...args: string[]) => args.join('/')) }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));
vi.mock('@/core/logging/LogStore', () => ({ LogStore: { _log: vi.fn() } }));

describe('AddPluginSection — dev mode install flow', () => {
  beforeEach(() => {
    pluginRegistry.clear();
    executionGate.clear();
  });

  it('renders template download section', () => {
    render(<AddPluginSection onPluginAdded={vi.fn()} />);
    expect(screen.getByText('Скачать шаблон')).toBeDefined();
  });

  it('downloadTemplate writes template files to target directory', async () => {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');

    render(<AddPluginSection onPluginAdded={vi.fn()} />);
    screen.getByText('Скачать шаблон').click();

    await vi.waitFor(() => {
      expect(writeTextFile).toHaveBeenCalled();
    });
    vi.restoreAllMocks();
  });
});
