import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ModuleGuard } from '@/shell/ModuleGuard';
import { getRuntime } from '@/plugin-sdk';
import { createRuntime } from '@/core/module-runtime';
import { createStoreAccess } from '@/core/store';
import type { AppModule } from '@/core/types';
import { createEventBus } from '@/core/event-bus';

function createTestModule(id: string): AppModule {
  return {
    manifest: {
      id,
      name: `Module ${id}`,
      version: '1.0.0',
      description: `Test module ${id}`,
      dependencies: [],
      settingsSchema: [],
      slot: [],
    },
    init: vi.fn(),
    destroy: vi.fn(),
  };
}

describe('ModuleGuard', () => {
  beforeEach(() => {
    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    createRuntime(eventBus, storeAccess);
  });

  it('renders children when module enabled', () => {
    render(
      <ModuleGuard moduleId="test-mod">
        <div>content</div>
      </ModuleGuard>
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('hides children when module disabled', async () => {
    const rt = getRuntime()!;
    rt.register(createTestModule('test-mod'));
    await rt.disableModule('test-mod');
    render(
      <ModuleGuard moduleId="test-mod">
        <div>content</div>
      </ModuleGuard>
    );
    expect(screen.queryByText('content')).toBeNull();
  });

  it('renders fallback when module disabled', async () => {
    const rt = getRuntime()!;
    rt.register(createTestModule('test-mod'));
    await rt.disableModule('test-mod');
    render(
      <ModuleGuard moduleId="test-mod" fallback={<div>disabled</div>}>
        <div>content</div>
      </ModuleGuard>
    );
    expect(screen.queryByText('content')).toBeNull();
    expect(screen.getByText('disabled')).toBeInTheDocument();
  });

  it('renders children when module re-enabled after disable', async () => {
    const rt = getRuntime()!;
    rt.register(createTestModule('test-mod'));
    await rt.disableModule('test-mod');
    await rt.enableModule('test-mod');
    render(
      <ModuleGuard moduleId="test-mod">
        <div>content</div>
      </ModuleGuard>
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
