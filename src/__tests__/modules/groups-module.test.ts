// ============================================================
// Tests: modules/groups/index.ts — manifest, init, commands, settings
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock KCDialog before importing the module
vi.mock('@/components/KCDialog', () => ({
  kcPrompt: vi.fn(),
}));

// Mock the groups components (React components that require DOM)
vi.mock('@/modules/groups/components', () => ({
  GroupsRibbonButtons: vi.fn(() => null),
  GroupsPanel: vi.fn(() => null),
  GroupContextMenu: vi.fn(() => null),
}));

import { groupsModule, groupsSettings } from '@/modules/groups/index';
import { kcPrompt } from '@/components/KCDialog';
import { AppEvents } from '@/plugin-sdk';
import type { ModuleContext } from '@/core/types';

// ---- Mock Contexts ----

function createMockCtx() {
  return {
    store: {
      getModuleSetting: vi.fn(),
      dispatch: vi.fn(),
      getStateSlice: vi.fn(),
    },
    eventBus: {
      emit: vi.fn(),
    },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    registerLifecycleHook: vi.fn(),
    registerKeybinding: vi.fn(),
  };
}

type MockCtx = ReturnType<typeof createMockCtx>;

// ============================================================
// Manifest
// ============================================================

describe('groupsModule — manifest', () => {

  it('should have correct id', () => {
    expect(groupsModule.manifest.id).toBe('groups');
  });

  it('should have correct name', () => {
    expect(groupsModule.manifest.name).toBe('Управление группами');
  });

  it('should have correct version', () => {
    expect(groupsModule.manifest.version).toBe('1.0.0');
  });

  it('should have correct description', () => {
    expect(groupsModule.manifest.description).toBe('Иерархическое дерево групп, создание, удаление, перемещение');
  });

  it('should declare correct slots', () => {
    expect(groupsModule.manifest.slot).toEqual(['ribbon:file', 'context-menu:group']);
  });

  it('should have a settingsSchema with defaultExpanded', () => {
    const schema = groupsModule.manifest.settingsSchema;
    expect(schema).toBeDefined();
    expect(schema).toHaveLength(1);
    expect(schema![0]).toEqual({
      key: 'defaultExpanded',
      type: 'boolean',
      label: 'Раскрывать группы по умолчанию',
      default: true,
    });
  });
});

// ============================================================
// Init — settings
// ============================================================

describe('groupsModule — init settings', () => {

  let mockCtx: MockCtx;

  beforeEach(() => {
    mockCtx = createMockCtx();
    vi.clearAllMocks();
  });

  it('should read initial settings from store on init', () => {
    mockCtx.store.getModuleSetting.mockReturnValue(false);
    groupsModule.init(mockCtx as unknown as ModuleContext);

    expect(mockCtx.getSetting).toHaveBeenCalledWith('defaultExpanded');
  });

  it('should subscribe to settings changes via registerLifecycleHook', () => {
    groupsModule.init(mockCtx as unknown as ModuleContext);

    expect(mockCtx.registerLifecycleHook).toHaveBeenCalledWith(
      'onSettingsChange',
      expect.any(Function),
    );
  });

  it('should re-read settings when onSettingsChange fires for groups module', () => {
    mockCtx.store.getModuleSetting.mockReturnValue(true);
    groupsModule.init(mockCtx as unknown as ModuleContext);

    // Get the callback registered for onSettingsChange
    const settingsCallback = mockCtx.registerLifecycleHook.mock.calls.find(
      (call: any[]) => call[0] === 'onSettingsChange',
    )?.[1] as Function;

    expect(settingsCallback).toBeDefined();

    // Reset and change the setting
    mockCtx.store.getModuleSetting.mockReturnValue(false);
    settingsCallback({ moduleId: 'groups' });

    // Should have been called again
    expect(mockCtx.getSetting).toHaveBeenCalledWith('defaultExpanded');
  });

  it('should NOT re-read settings when onSettingsChange fires for different module', () => {
    mockCtx.store.getModuleSetting.mockReturnValue(true);
    groupsModule.init(mockCtx as unknown as ModuleContext);

    const initialCallCount = mockCtx.store.getModuleSetting.mock.calls.length;

    const settingsCallback = mockCtx.registerLifecycleHook.mock.calls.find(
      (call: any[]) => call[0] === 'onSettingsChange',
    )?.[1] as Function;

    // Fire change for a different module
    settingsCallback({ moduleId: 'other-module' });

    // getModuleSetting should NOT have been called again
    expect(mockCtx.store.getModuleSetting).toHaveBeenCalledTimes(initialCallCount);
  });
});

// ============================================================
// Init — UI contributions
// ============================================================

describe('groupsModule — init UI contributions', () => {

  let mockCtx: MockCtx;

  beforeEach(() => {
    mockCtx = createMockCtx();
    vi.clearAllMocks();
  });

  it('should register 1 UI contribution (ribbon:file)', () => {
    groupsModule.init(mockCtx as unknown as ModuleContext);
    expect(mockCtx.registerUI).toHaveBeenCalledTimes(1);
  });

  it('should register ribbon:file contribution with order 10', () => {
    groupsModule.init(mockCtx as unknown as ModuleContext);

    const ribbonCall = mockCtx.registerUI.mock.calls.find(
      (call: any[]) => call[0].slot === 'ribbon:file',
    );
    expect(ribbonCall).toBeDefined();
    expect(ribbonCall![0]).toEqual(
      expect.objectContaining({
        slot: 'ribbon:file',
        label: 'Новая группа',
        order: 10,
      }),
    );
    expect(ribbonCall![0].component).toBeTypeOf('function');
  });

});

// ============================================================
// Init — Commands
// ============================================================

describe('groupsModule — init commands', () => {

  let mockCtx: MockCtx;

  beforeEach(() => {
    mockCtx = createMockCtx();
    vi.clearAllMocks();
  });

  it('should register 5 commands', () => {
    groupsModule.init(mockCtx as unknown as ModuleContext);
    expect(mockCtx.registerCommand).toHaveBeenCalledTimes(5); // create-group, create-subgroup, refresh-data, open-minus-words, toggle-multigroup
  });

  it('should register create-group command', () => {
    groupsModule.init(mockCtx as unknown as ModuleContext);

    const cmd = mockCtx.registerCommand.mock.calls.find(
      (call: any[]) => call[0] === 'create-group',
    );
    expect(cmd).toBeDefined();
    expect(cmd![1]).toBeTypeOf('function');
  });

  it('should register create-subgroup command', () => {
    groupsModule.init(mockCtx as unknown as ModuleContext);

    const cmd = mockCtx.registerCommand.mock.calls.find(
      (call: any[]) => call[0] === 'create-subgroup',
    );
    expect(cmd).toBeDefined();
    expect(cmd![1]).toBeTypeOf('function');
  });
});

// ============================================================
// Command callbacks
// ============================================================

describe('groupsModule — create-group command', () => {

  let mockCtx: MockCtx;

  beforeEach(() => {
    mockCtx = createMockCtx();
    vi.clearAllMocks();
  });

  it('should dispatch addGroup with parentId null when prompt returns a name', async () => {
    vi.mocked(kcPrompt).mockResolvedValue('Test Group');

    groupsModule.init(mockCtx as unknown as ModuleContext);

    const handler = mockCtx.registerCommand.mock.calls.find(
      (call: any[]) => call[0] === 'create-group',
    )![1] as () => Promise<void>;

    await handler();

    expect(mockCtx.store.dispatch).toHaveBeenCalledWith('addGroup', {
      name: 'Test Group',
      parentId: null,
    });
  });

  it('should emit GROUPS_CHANGED after creating a group', async () => {
    vi.mocked(kcPrompt).mockResolvedValue('Test Group');

    groupsModule.init(mockCtx as unknown as ModuleContext);

    const handler = mockCtx.registerCommand.mock.calls.find(
      (call: any[]) => call[0] === 'create-group',
    )![1] as () => Promise<void>;

    await handler();

    expect(mockCtx.eventBus.emit).toHaveBeenCalledWith(AppEvents.GROUPS_CHANGED);
  });

  it('should NOT dispatch addGroup when prompt returns null', async () => {
    vi.mocked(kcPrompt).mockResolvedValue(null);

    groupsModule.init(mockCtx as unknown as ModuleContext);

    const handler = mockCtx.registerCommand.mock.calls.find(
      (call: any[]) => call[0] === 'create-group',
    )![1] as () => Promise<void>;

    await handler();

    expect(mockCtx.store.dispatch).not.toHaveBeenCalled();
    expect(mockCtx.eventBus.emit).not.toHaveBeenCalled();
  });

  it('should NOT dispatch addGroup when prompt returns empty string', async () => {
    vi.mocked(kcPrompt).mockResolvedValue('');

    groupsModule.init(mockCtx as unknown as ModuleContext);

    const handler = mockCtx.registerCommand.mock.calls.find(
      (call: any[]) => call[0] === 'create-group',
    )![1] as () => Promise<void>;

    await handler();

    expect(mockCtx.store.dispatch).not.toHaveBeenCalled();
  });
});

describe('groupsModule — create-subgroup command', () => {

  let mockCtx: MockCtx;

  beforeEach(() => {
    mockCtx = createMockCtx();
    vi.clearAllMocks();
  });

  it('should skip when no activeGroupId', async () => {
    mockCtx.store.getStateSlice.mockReturnValue(null);

    groupsModule.init(mockCtx as unknown as ModuleContext);

    const handler = mockCtx.registerCommand.mock.calls.find(
      (call: any[]) => call[0] === 'create-subgroup',
    )![1] as () => Promise<void>;

    await handler();

    expect(mockCtx.store.dispatch).not.toHaveBeenCalled();
    expect(kcPrompt).not.toHaveBeenCalled();
  });

  it('should dispatch addGroup with parentId from activeGroupId', async () => {
    mockCtx.store.getStateSlice.mockReturnValue('group-123');
    vi.mocked(kcPrompt).mockResolvedValue('Sub Group');

    groupsModule.init(mockCtx as unknown as ModuleContext);

    const handler = mockCtx.registerCommand.mock.calls.find(
      (call: any[]) => call[0] === 'create-subgroup',
    )![1] as () => Promise<void>;

    await handler();

    expect(mockCtx.store.getStateSlice).toHaveBeenCalledWith('activeGroupId');
    expect(mockCtx.store.dispatch).toHaveBeenCalledWith('addGroup', {
      name: 'Sub Group',
      parentId: 'group-123',
    });
  });

  it('should emit GROUPS_CHANGED after creating a subgroup', async () => {
    mockCtx.store.getStateSlice.mockReturnValue('group-123');
    vi.mocked(kcPrompt).mockResolvedValue('Sub Group');

    groupsModule.init(mockCtx as unknown as ModuleContext);

    const handler = mockCtx.registerCommand.mock.calls.find(
      (call: any[]) => call[0] === 'create-subgroup',
    )![1] as () => Promise<void>;

    await handler();

    expect(mockCtx.eventBus.emit).toHaveBeenCalledWith(AppEvents.GROUPS_CHANGED);
  });

  it('should NOT dispatch when prompt returns null', async () => {
    mockCtx.store.getStateSlice.mockReturnValue('group-123');
    vi.mocked(kcPrompt).mockResolvedValue(null);

    groupsModule.init(mockCtx as unknown as ModuleContext);

    const handler = mockCtx.registerCommand.mock.calls.find(
      (call: any[]) => call[0] === 'create-subgroup',
    )![1] as () => Promise<void>;

    await handler();

    expect(mockCtx.store.dispatch).not.toHaveBeenCalled();
  });
});

// ============================================================
// Destroy
// ============================================================

describe('groupsModule — destroy', () => {

  it('should reset groupsSettings to defaults on destroy', async () => {
    groupsSettings.defaultExpanded = false;
    await groupsModule.destroy();
    expect(groupsSettings.defaultExpanded).toBe(true);
  });
});
