// ============================================================
// Tests for PluginRegistry — install/uninstall/enable/disable
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginRegistry } from '@/plugin-sdk';

describe('Plugin Registry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
    // Clear localStorage for tests
    try {
      localStorage.removeItem('keycluster:plugin-registry');
    } catch {}
  });

  describe('install()', () => {
    it('should install a builtin plugin', () => {
      registry.install('groups', 'builtin');
      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('groups');
      expect(all[0].source).toBe('builtin');
      expect(all[0].enabled).toBe(true);
    });

    it('should install a local plugin', () => {
      registry.install('deduplicator', 'user');
      const record = registry.get('deduplicator');
      expect(record).toBeDefined();
      expect(record!.source).toBe('user');
    });

    it('should set installedAt timestamp', () => {
      const before = Date.now();
      registry.install('groups', 'builtin');
      const after = Date.now();
      const record = registry.get('groups');
      expect(record!.installedAt).toBeGreaterThanOrEqual(before);
      expect(record!.installedAt).toBeLessThanOrEqual(after);
    });

    it('should not duplicate install — updates existing record', () => {
      registry.install('groups', 'builtin');
      registry.install('groups', 'builtin');
      expect(registry.getAll()).toHaveLength(1);
    });

    it('should update source on re-install but keep enabled status', () => {
      registry.install('test', 'builtin');
      registry.disable('test');
      registry.install('test', 'user');
      const record = registry.get('test');
      expect(record!.source).toBe('user');
      expect(record!.enabled).toBe(true);
    });
  });

  describe('uninstall()', () => {
    it('should uninstall a local plugin', () => {
      registry.install('deduplicator', 'user');
      registry.uninstall('deduplicator');
      expect(registry.get('deduplicator')).toBeUndefined();
    });

    it('should throw when uninstalling a builtin plugin', () => {
      registry.install('groups', 'builtin');
      expect(() => registry.uninstall('groups')).toThrow('Cannot uninstall builtin plugin');
    });

    it('should throw when uninstalling non-existent plugin', () => {
      expect(() => registry.uninstall('nonexistent')).toThrow('not installed');
    });
  });

  describe('enable()/disable()', () => {
    it('should enable a plugin', () => {
      registry.install('test', 'user');
      registry.disable('test');
      expect(registry.isEnabled('test')).toBe(false);
      registry.enable('test');
      expect(registry.isEnabled('test')).toBe(true);
    });

    it('should disable a plugin', () => {
      registry.install('test', 'user');
      registry.disable('test');
      expect(registry.isEnabled('test')).toBe(false);
    });

    it('should throw when enabling non-existent plugin', () => {
      expect(() => registry.enable('nonexistent')).toThrow('not installed');
    });

    it('should throw when disabling non-existent plugin', () => {
      expect(() => registry.disable('nonexistent')).toThrow('not installed');
    });
  });

  describe('isEnabled()', () => {
    it('should return true for enabled plugin', () => {
      registry.install('test', 'builtin');
      expect(registry.isEnabled('test')).toBe(true);
    });

    it('should return false for disabled plugin', () => {
      registry.install('test', 'builtin');
      registry.disable('test');
      expect(registry.isEnabled('test')).toBe(false);
    });

    it('should return false for non-existent plugin', () => {
      expect(registry.isEnabled('nonexistent')).toBe(false);
    });
  });

  describe('isInstalled()', () => {
    it('should return true for installed plugin', () => {
      registry.install('test', 'builtin');
      expect(registry.isInstalled('test')).toBe(true);
    });

    it('should return false for non-existent plugin', () => {
      expect(registry.isInstalled('nonexistent')).toBe(false);
    });
  });

  describe('persistence', () => {
    it('should save and load from localStorage', () => {
      registry.install('groups', 'builtin');
      registry.install('deduplicator', 'user');
      registry.disable('deduplicator');
      registry.save();

      // Create a new registry and load
      const registry2 = new PluginRegistry();
      const loaded = registry2.load();
      expect(loaded).toHaveLength(2);
      expect(loaded.find(r => r.id === 'groups')!.source).toBe('builtin');
      expect(loaded.find(r => r.id === 'groups')!.enabled).toBe(true);
      expect(loaded.find(r => r.id === 'deduplicator')!.source).toBe('user');
      expect(loaded.find(r => r.id === 'deduplicator')!.enabled).toBe(false);
    });

    it('should return empty array when no data in localStorage', () => {
      const registry2 = new PluginRegistry();
      const loaded = registry2.load();
      expect(loaded).toHaveLength(0);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('keycluster:plugin-registry', 'not-valid-json');
      const registry2 = new PluginRegistry();
      const loaded = registry2.load();
      expect(loaded).toHaveLength(0);
    });
  });

  describe('clear()', () => {
    it('should remove all records', () => {
      registry.install('test1', 'builtin');
      registry.install('test2', 'user');
      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
    });
  });
});
