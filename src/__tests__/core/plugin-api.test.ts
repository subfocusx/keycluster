import { describe, it, expect } from 'vitest';
import { PLUGIN_API_VERSION } from '@/plugin-sdk';

describe('PLUGIN_API_VERSION', () => {
  it('should export PLUGIN_API_VERSION as 1.0', () => {
    expect(PLUGIN_API_VERSION).toBe('1.0');
  });

  it('should be a const literal type', () => {
    const version: '1.0' = PLUGIN_API_VERSION;
    expect(version).toBe('1.0');
  });
});