import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@user-plugins/implicit-duplicates/components', () => ({
  ImplicitDuplicatesPanel: vi.fn(() => null),
  implicitDuplicatesSettings: {
    threshold: 80,
    ignoreStopWords: true,
    compareWordOrder: false,
    keepHigherFrequency: true,
  },
}));

vi.mock('@/core/store', () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      setLeftPanel: vi.fn(),
    })),
  },
}));

import { implicitDuplicatesModule } from '@user-plugins/implicit-duplicates/index';
import type { PluginContext, ModuleContext } from '@/plugin-sdk';

function createMockCtx(): PluginContext {
  return {
    getSetting: vi.fn().mockReturnValue(undefined),
    store: {
      getModuleSetting: vi.fn(),
      dispatch: vi.fn(),
      getStateSlice: vi.fn(),
    },
    eventBus: { emit: vi.fn() },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
    registerLifecycleHook: vi.fn(),
    registerKeybinding: vi.fn(),
  } as unknown as PluginContext;
}

describe('implicitDuplicatesModule', () => {
  describe('manifest', () => {
    it('has correct id', () => {
      expect(implicitDuplicatesModule.manifest.id).toBe('implicit-duplicates');
    });

    it('has required manifest fields', () => {
      const m = implicitDuplicatesModule.manifest;
      expect(m.name).toBeTypeOf('string');
      expect(m.version).toBeTypeOf('string');
      expect(m.description).toBeTypeOf('string');
      expect(m.slot).toContain('ribbon:tools');
      expect(m.slot).toContain('left-panel');
      expect(m.settingsSchema).toBeInstanceOf(Array);
    });

    it('has settings schema with correct keys', () => {
      const keys = implicitDuplicatesModule.manifest.settingsSchema!.map((s: any) => s.key);
      expect(keys).toContain('threshold');
      expect(keys).toContain('ignoreStopWords');
      expect(keys).toContain('compareWordOrder');
      expect(keys).toContain('keepHigherFrequency');
    });
  });

  describe('init', () => {
    it('should register UI components for left-panel and ribbon', () => {
      const mockCtx = createMockCtx();
      implicitDuplicatesModule.init(mockCtx as unknown as ModuleContext);

      expect(mockCtx.registerUI).toHaveBeenCalledTimes(2);
      const slots = (mockCtx.registerUI as any).mock.calls.map((c: any[]) => c[0].slot);
      expect(slots).toContain('left-panel');
      expect(slots).toContain('ribbon:tools');
    });

    it('should register a command "open"', () => {
      const mockCtx = createMockCtx();
      implicitDuplicatesModule.init(mockCtx as unknown as ModuleContext);

      expect(mockCtx.registerCommand).toHaveBeenCalledWith(
        'open',
        expect.any(Function),
      );
    });

    it('should register keybinding when available', () => {
      const mockCtx = createMockCtx();
      mockCtx.registerKeybinding = vi.fn();
      implicitDuplicatesModule.init(mockCtx as unknown as ModuleContext);

      expect(mockCtx.registerKeybinding).toHaveBeenCalledWith(
        'ctrl+shift+i',
        'open',
        expect.any(Object),
      );
    });

    it('should register onSettingsChange lifecycle hook', () => {
      const mockCtx = createMockCtx();
      implicitDuplicatesModule.init(mockCtx as unknown as ModuleContext);

      expect(mockCtx.registerLifecycleHook).toHaveBeenCalledWith(
        'onSettingsChange',
        expect.any(Function),
      );
    });

    it('should register beforeDestroy lifecycle hook', () => {
      const mockCtx = createMockCtx();
      implicitDuplicatesModule.init(mockCtx as unknown as ModuleContext);

      expect(mockCtx.registerLifecycleHook).toHaveBeenCalledWith(
        'beforeDestroy',
        expect.any(Function),
      );
    });

    it('should read settings from store', () => {
      const mockCtx = createMockCtx();
      implicitDuplicatesModule.init(mockCtx as unknown as ModuleContext);

      expect(mockCtx.getSetting).toHaveBeenCalledWith('threshold');
      expect(mockCtx.getSetting).toHaveBeenCalledWith('ignoreStopWords');
    });
  });

  describe('destroy', () => {
    it('should not throw', async () => {
      await implicitDuplicatesModule.destroy();
    });
  });
});
