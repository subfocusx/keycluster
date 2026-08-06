import { describe, it, expect, vi } from 'vitest';

vi.mock('@/core/plugin-registry', () => ({
  pluginRegistry: {
    install: vi.fn(),
    isInstalled: vi.fn().mockReturnValue(false),
    getAll: () => [],
    get: () => null,
    clear: () => {},
  },
}));

vi.mock('@/core/logging/LogStore', () => ({
  LogStore: { _log: vi.fn() },
}));

vi.mock('@/core/module-loader', () => ({
  registerUserPlugin: vi.fn(),
}));

describe('user-plugin-loader', () => {
  it('registerDiscoveredPlugins returns an array', async () => {
    const { registerDiscoveredPlugins } = await import('@/core/user-plugin-loader');
    const result = await registerDiscoveredPlugins();
    expect(Array.isArray(result)).toBe(true);
  });
});
