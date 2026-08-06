// ============================================================
// Tests for Hot Reload — module-loader.reloadModule()
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModuleLoadError, getAvailableModuleIds } from '@/plugin-sdk';
import { clearModuleCache } from '@/core/module-loader';
// We test the guard logic and error handling

describe('module-loader — hot reload', () => {
  beforeEach(() => {
    clearModuleCache();
  });

  describe('reloadModule() guard', () => {
    it('should throw ModuleLoadError in production mode', async () => {
      // reloadModule checks NODE_ENV, which is 'test' in vitest
      // We need to dynamically import to test the guard
      const originalEnv = process.env.NODE_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      try {
        const { reloadModule } = await import('@/core/module-loader');
        await expect(reloadModule('clustering')).rejects.toThrow(ModuleLoadError);
        await expect(reloadModule('clustering')).rejects.toThrow('development mode');
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      }
    });
  });

  describe('getAvailableModuleIds()', () => {
    it('should return all standard module IDs (builtin + local)', () => {
      const ids = getAvailableModuleIds();
      expect(ids).toContain('groups');
      expect(ids).toContain('phrases');
      expect(ids).toContain('clustering');
      expect(ids).toContain('minus-words');
      expect(ids).toContain('cross-search');
      expect(ids).toContain('find-replace');
      expect(ids).toContain('import-export');
      expect(ids).toContain('deduplicator');
      expect(ids.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('ModuleLoadError', () => {
    it('should have correct properties', () => {
      const cause = new Error('test cause');
      const err = new ModuleLoadError('test-module', cause);
      expect(err.name).toBe('ModuleLoadError');
      expect(err.moduleId).toBe('test-module');
      expect(err.cause).toBe(cause);
      expect(err.message).toContain('test-module');
    });

    it('should handle string cause', () => {
      const err = new ModuleLoadError('test-module', 'string error');
      expect(err.message).toContain('string error');
    });
  });
});
