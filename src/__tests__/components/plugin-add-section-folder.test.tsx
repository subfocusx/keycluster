import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddPluginSection } from '@/components/plugin-add-section';
import {
  getPluginsDir,
  selectPluginFolder,
  readManifestFromFolder,
  copyFolderContents,
  copyPluginToUserDir,
} from '@/core/plugin-fs-utils';
import { LogStore } from '@/plugin-sdk';

const mockOpen = vi.hoisted(() => vi.fn());
const mockReadTextFile = vi.hoisted(() => vi.fn());
const mockCopyFile = vi.hoisted(() => vi.fn());
const mockMkdir = vi.hoisted(() => vi.fn());
const mockExists = vi.hoisted(() => vi.fn());
const mockReadDir = vi.hoisted(() => vi.fn());
const mockAppLocalDataDir = vi.hoisted(() => vi.fn());
const mockJoin = vi.hoisted(() => vi.fn());
const mockRelaunch = vi.hoisted(() => vi.fn());
const defaultJoin = vi.hoisted(() => vi.fn((...args: string[]) => {
  const sep = args[0]?.startsWith('/') ? '/' : '\\';
  return args.map(p => p.replace(/[/\\]+$/, '')).join(sep);
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => mockOpen(...args),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: (...args: unknown[]) => mockReadTextFile(...args),
  copyFile: (...args: unknown[]) => mockCopyFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  exists: (...args: unknown[]) => mockExists(...args),
  readDir: (...args: unknown[]) => mockReadDir(...args),
}));

vi.mock('@tauri-apps/api/path', () => ({
  appLocalDataDir: (...args: unknown[]) => mockAppLocalDataDir(...args),
  join: (...args: string[]) => mockJoin(...args),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...args),
}));

vi.mock('@/core/module-runtime', () => ({
  getRuntime: vi.fn(() => null),
}));

vi.mock('@/core/plugin-registry', () => ({
  pluginRegistry: {
    install: vi.fn(),
    isInstalled: vi.fn().mockReturnValue(false),
    getAll: () => [],
    get: () => null,
    clear: () => {},
    load: () => {},
    uninstall: vi.fn(),
  },
}));

vi.mock('@/core/logging/LogStore', () => ({
  LogStore: { _log: vi.fn() },
}));

vi.mock('@/components/plugin-manager/plugin-installer', () => ({
  installPluginAtomic: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/components/plugin-manager/InstallResultBanner', () => ({
  InstallResultBanner: ({ pluginId }: { pluginId: string }) => {
    const [relaunchError, setRelaunchError] = React.useState(false);
    return React.createElement('div', { className: 'space-y-2' },
      React.createElement('div', null, `Плагин \u00AB${pluginId}\u00BB установлен`),
      !relaunchError && React.createElement('button', {
        onClick: async () => {
          try { await mockRelaunch(); } catch { setRelaunchError(true); }
        },
      }, 'Перезапустить приложение'),
      relaunchError && React.createElement('div', null, 'вручную'),
    );
  },
}));

function lastLogMessage(): string {
  const calls = vi.mocked(LogStore._log).mock.calls;
  return calls[calls.length - 1]?.[2] ?? '';
}

describe('plugin-add-section folder selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppLocalDataDir.mockResolvedValue('C:\\Users\\test\\AppData\\');
    mockJoin.mockImplementation(defaultJoin);
  });

  describe('selectPluginFolder', () => {
    it('opens dialog with directory:true and returns path', async () => {
      mockOpen.mockResolvedValue('C:\\Users\\test\\my-plugin');
      const result = await selectPluginFolder();
      expect(result).toBe('C:\\Users\\test\\my-plugin');
      expect(mockOpen).toHaveBeenCalledWith({
        title: 'Выберите папку с плагином',
        directory: true,
        multiple: false,
      });
    });

    it('returns null when dialog cancelled', async () => {
      mockOpen.mockResolvedValue(null);
      const result = await selectPluginFolder();
      expect(result).toBeNull();
    });
  });

  describe('readManifestFromFolder', () => {
    it('reads and parses manifest.json', async () => {
      mockReadTextFile.mockResolvedValue(JSON.stringify({
        id: 'my-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test description',
        slot: ['ribbon:tools'],
      }));

      const manifest = await readManifestFromFolder('C:\\test-folder');
      expect(manifest.id).toBe('my-plugin');
      expect(manifest.name).toBe('Test Plugin');
      expect(manifest.version).toBe('1.0.0');
      expect(mockJoin).toHaveBeenCalledWith('C:\\test-folder', 'manifest.json');
      expect(mockReadTextFile).toHaveBeenCalledWith('C:\\test-folder\\manifest.json', { encoding: 'utf-8' });
    });

    it('throws when manifest has no id', async () => {
      mockReadTextFile.mockResolvedValue(JSON.stringify({
        name: 'No ID',
        version: '1.0.0',
      }));

      await expect(readManifestFromFolder('C:\\bad-folder')).rejects.toThrow('id, name, version');
    });
  });

  describe('getPluginsDir', () => {
    it('uses join to build path, not string concat', async () => {
      const dir = await getPluginsDir();
      expect(mockJoin).toHaveBeenCalledWith(
        'C:\\Users\\test\\AppData\\',
        'user-plugins'
      );
      expect(dir).toBe('C:\\Users\\test\\AppData\\user-plugins');
      expect(dir).not.toContain('AppDatauser-plugins');
    });

    it('handles posix paths via join', async () => {
      mockAppLocalDataDir.mockResolvedValue('/home/test/.local/share/');
      mockJoin.mockImplementation(defaultJoin);
      const dir = await getPluginsDir();
      expect(mockJoin).toHaveBeenCalledWith('/home/test/.local/share/', 'user-plugins');
      expect(dir).toBe('/home/test/.local/share/user-plugins');
    });
  });

  describe('copyFolderContents', () => {
    it('copies files recursively using join paths', async () => {
      mockExists.mockResolvedValue(false);
      mockReadDir
        .mockResolvedValueOnce([
          { name: 'manifest.json', isDirectory: false },
          { name: 'index.ts', isDirectory: false },
          { name: 'components', isDirectory: true },
        ])
        .mockResolvedValueOnce([
          { name: 'helper.ts', isDirectory: false },
        ]);

      await copyFolderContents('C:\\src', 'C:\\dest');

      expect(mockCopyFile).toHaveBeenCalledWith('C:\\src\\manifest.json', 'C:\\dest\\manifest.json');
      expect(mockCopyFile).toHaveBeenCalledWith('C:\\src\\index.ts', 'C:\\dest\\index.ts');
      expect(mockCopyFile).toHaveBeenCalledWith('C:\\src\\components\\helper.ts', 'C:\\dest\\components\\helper.ts');
    });
  });

  describe('copyPluginToUserDir', () => {
    it('creates target dir and copies files', async () => {
      mockExists.mockResolvedValue(false);
      mockReadDir.mockResolvedValue([
        { name: 'manifest.json', isDirectory: false },
        { name: 'index.js', isDirectory: false },
      ]);
      mockCopyFile.mockResolvedValue(undefined);

      const manifest = { id: 'my-plugin', name: 'Test', version: '1.0.0', description: '', slot: [] };
      await copyPluginToUserDir('C:\\test-folder', manifest);

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('user-plugins'),
        { recursive: true },
      );
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('user-plugins\\my-plugin'),
        { recursive: true },
      );
      expect(mockCopyFile).toHaveBeenCalled();
    });
  });

  describe('AddPluginSection component', () => {
    it('renders folder selection button', () => {
      render(<AddPluginSection onPluginAdded={vi.fn()} />);
      expect(screen.getByText('Выбрать папку с плагином')).toBeInTheDocument();
    });

    it('shows preview after selecting folder with valid manifest', async () => {
      mockOpen.mockResolvedValue('C:\\Users\\test\\my-plugin');
      mockReadTextFile.mockResolvedValue(JSON.stringify({
        id: 'my-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        slot: ['ribbon:tools'],
      }));

      render(<AddPluginSection onPluginAdded={vi.fn()} />);
      fireEvent.click(screen.getByText('Выбрать папку с плагином'));

      await waitFor(() => {
        expect(screen.getByText('Test Plugin')).toBeInTheDocument();
      });
      expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
      expect(screen.getByText(/id:/)).toBeInTheDocument();
    });

    it('shows error when selected folder has no manifest.json', async () => {
      mockOpen.mockResolvedValue('C:\\bad-folder');
      mockReadTextFile.mockRejectedValue(new Error('File not found'));

      render(<AddPluginSection onPluginAdded={vi.fn()} />);
      fireEvent.click(screen.getByText('Выбрать папку с плагином'));

      await waitFor(() => {
        expect(screen.getByText(/File not found/i)).toBeInTheDocument();
      });
    });

    it('shows success message after install', async () => {
      mockOpen.mockResolvedValue('C:\\Users\\test\\my-plugin');
      mockReadTextFile.mockResolvedValue(JSON.stringify({
        id: 'my-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        slot: ['ribbon:tools'],
        entry: 'index.js',
      }));
      mockExists.mockImplementation(async (p) => typeof p === 'string' && p.endsWith('index.js') || false);
      mockReadDir.mockResolvedValue([
        { name: 'manifest.json', isDirectory: false },
        { name: 'index.js', isDirectory: false },
      ]);
      mockCopyFile.mockResolvedValue(undefined);

      const onPluginAdded = vi.fn();
      render(<AddPluginSection onPluginAdded={onPluginAdded} />);

      fireEvent.click(screen.getByText('Выбрать папку с плагином'));
      await waitFor(() => expect(screen.getByText('Test Plugin')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Установить'));
      await waitFor(() => {
        expect(screen.getByText(/«my-plugin»/i)).toBeInTheDocument();
      });

      expect(screen.getByText('Перезапустить приложение')).toBeInTheDocument();
      expect(onPluginAdded).toHaveBeenCalled();
    });

    it('shows manual restart instruction when relaunch fails', async () => {
      mockRelaunch.mockRejectedValue(new Error('process.restart not allowed'));

      mockOpen.mockResolvedValue('C:\\Users\\test\\my-plugin');
      mockReadTextFile.mockResolvedValue(JSON.stringify({
        id: 'my-plugin', name: 'Relaunch Test', version: '1.0.0', description: '', slot: [], entry: 'index.js',
      }));
      mockExists.mockImplementation(async (p) => typeof p === 'string' && p.endsWith('index.js') || false);
      mockReadDir.mockResolvedValue([{ name: 'manifest.json', isDirectory: false }, { name: 'index.js', isDirectory: false }]);
      mockCopyFile.mockResolvedValue(undefined);

      render(<AddPluginSection onPluginAdded={vi.fn()} />);
      fireEvent.click(screen.getByText('Выбрать папку с плагином'));
      await waitFor(() => expect(screen.getByText('Relaunch Test')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Установить'));
      await waitFor(() => expect(screen.getByText(/«my-plugin»/i)).toBeInTheDocument());

      fireEvent.click(screen.getByText('Перезапустить приложение'));

      await waitFor(() => {
        expect(screen.getByText(/вручную/i)).toBeInTheDocument();
      });

      expect(screen.queryByText('Перезапустить приложение')).toBeNull();
    });

    it('relaunch succeeds and does not show manual instruction', async () => {
      mockRelaunch.mockResolvedValue(undefined);

      mockOpen.mockResolvedValue('C:\\Users\\test\\my-plugin');
      mockReadTextFile.mockResolvedValue(JSON.stringify({
        id: 'my-plugin', name: 'Success Test', version: '1.0.0', description: '', slot: [], entry: 'index.js',
      }));
      mockExists.mockImplementation(async (p) => typeof p === 'string' && p.endsWith('index.js') || false);
      mockReadDir.mockResolvedValue([{ name: 'manifest.json', isDirectory: false }, { name: 'index.js', isDirectory: false }]);
      mockCopyFile.mockResolvedValue(undefined);

      render(<AddPluginSection onPluginAdded={vi.fn()} />);
      fireEvent.click(screen.getByText('Выбрать папку с плагином'));
      await waitFor(() => expect(screen.getByText('Success Test')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Установить'));
      await waitFor(() => expect(screen.getByText(/«my-plugin»/i)).toBeInTheDocument());

      fireEvent.click(screen.getByText('Перезапустить приложение'));

      expect(mockRelaunch).toHaveBeenCalled();
      expect(screen.queryByText(/вручную/i)).toBeNull();
    });

    it('has cancel button in preview that clears state', async () => {
      mockOpen.mockResolvedValue('C:\\Users\\test\\my-plugin');
      mockReadTextFile.mockResolvedValue(JSON.stringify({
        id: 'my-plugin', name: 'Cancel Test', version: '1.0.0', description: '', slot: [],
      }));

      render(<AddPluginSection onPluginAdded={vi.fn()} />);
      fireEvent.click(screen.getByText('Выбрать папку с плагином'));
      await waitFor(() => expect(screen.getByText('Cancel Test')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Отмена'));
      await waitFor(() => {
        expect(screen.queryByText('Cancel Test')).not.toBeInTheDocument();
      });
    });
  });
});
