import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import React from 'react';

vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));

vi.mock('@/plugin-sdk', () => ({
  useAppStore: (sel: any) => sel({
    ui: { modulesLoading: false, devtoolsOpen: false, theme: 'light' },
    groups: [], phrases: [],
    setTheme: vi.fn(),
  }),
  getRuntime: () => ({
    getModuleStatuses: () => [],
    getModule: () => null,
    getUIContributions: () => [],
    enablePlugin: vi.fn(), disablePlugin: vi.fn(),
    reloadModule: vi.fn(), uninstallPlugin: vi.fn(),
  }),
  getEventBus: () => ({ on: () => () => {}, emit: vi.fn() }),
  pluginRegistry: { load: vi.fn(), getAll: () => [], get: () => null },
  LogStore: { _log: vi.fn() },
  installationGate: { isInstalling: () => false },
  selectPluginFolder: vi.fn(),
  readManifestFromFolder: vi.fn(),
  useSettingsStore: () => ({ settings: {}, setModuleSetting: vi.fn() }),
}));

vi.mock('@tauri-apps/api/path',      () => ({ join: (...a: string[]) => Promise.resolve(a.join('/')) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs',     () => ({ writeTextFile: vi.fn(), mkdir: vi.fn(), exists: vi.fn(() => true) }));
vi.mock('@/components/ModuleErrorBoundary', () => ({ ModuleErrorBoundary: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/PluginManager',       () => ({ PluginManagerSection: () => <div>pm</div> }));

async function renderModal(open = true) {
  const { default: SettingsModal } = await import('@/components/SettingsModal');
  const onClose = vi.fn();
  const { container } = render(<SettingsModal open={open} onClose={onClose} />);
  return { container, onClose };
}

const getModal  = (c: HTMLElement) => c.querySelector('[data-testid="settings-modal"]') as HTMLElement | null;
const getHandle = (c: HTMLElement) => c.querySelector('[data-testid="resize-handle"]')  as HTMLElement | null;
const getScroll = (c: HTMLElement) => c.querySelector('.overflow-y-auto.compact-scroll.min-h-0') as HTMLElement | null;

describe('SettingsModal — рендер', () => {
  it('не рендерится при open=false', async () => {
    const { container } = await renderModal(false);
    expect(getModal(container)).toBeNull();
  });
  it('рендерится при open=true', async () => {
    const { container } = await renderModal();
    expect(getModal(container)).not.toBeNull();
  });
  it('начальная ширина 780px', async () => {
    const { container } = await renderModal();
    expect(getModal(container)!.style.width).toBe('780px');
  });
  it('начальная высота 540px', async () => {
    const { container } = await renderModal();
    expect(getModal(container)!.style.height).toBe('540px');
  });
  it('minWidth = 560', async () => {
    const { container } = await renderModal();
    expect(parseInt(getModal(container)!.style.minWidth)).toBe(560);
  });
  it('minHeight = 440', async () => {
    const { container } = await renderModal();
    expect(parseInt(getModal(container)!.style.minHeight)).toBe(440);
  });
});

describe('SettingsModal — resize handle', () => {
  it('handle присутствует', async () => {
    const { container } = await renderModal();
    expect(getHandle(container)).not.toBeNull();
  });
  it('handle cursor-nwse-resize', async () => {
    const { container } = await renderModal();
    expect(getHandle(container)!.className).toContain('cursor-nwse-resize');
  });
  it('handle absolute bottom-0 right-0', async () => {
    const { container } = await renderModal();
    const cls = getHandle(container)!.className;
    expect(cls).toContain('absolute');
    expect(cls).toContain('bottom-0');
    expect(cls).toContain('right-0');
  });
  it('handle реагирует на pointerDown без ошибки', async () => {
    const { container } = await renderModal();
    expect(() =>
      fireEvent.pointerDown(getHandle(container)!, { clientX: 500, clientY: 300, pointerId: 1 })
    ).not.toThrow();
  });
});

describe('SettingsModal — resize drag (Pointer Events)', () => {
  it('ширина растёт при drag вправо', async () => {
    const { container } = await renderModal();
    const h = getHandle(container)!;
    const m = getModal(container)!;
    fireEvent.pointerDown(h, { clientX: 500, clientY: 300, pointerId: 1 });
    await act(async () => fireEvent.pointerMove(h, { clientX: 650, clientY: 300, pointerId: 1 }));
    fireEvent.pointerUp(h, { pointerId: 1 });
    expect(parseInt(m.style.width)).toBeGreaterThan(780);
  });
  it('высота растёт при drag вниз', async () => {
    const { container } = await renderModal();
    const h = getHandle(container)!;
    const m = getModal(container)!;
    fireEvent.pointerDown(h, { clientX: 500, clientY: 300, pointerId: 1 });
    await act(async () => fireEvent.pointerMove(h, { clientX: 500, clientY: 450, pointerId: 1 }));
    fireEvent.pointerUp(h, { pointerId: 1 });
    expect(parseInt(m.style.height)).toBeGreaterThan(540);
  });
  it('ширина уменьшается при drag влево', async () => {
    const { container } = await renderModal();
    const h = getHandle(container)!;
    const m = getModal(container)!;
    fireEvent.pointerDown(h, { clientX: 500, clientY: 300, pointerId: 1 });
    await act(async () => fireEvent.pointerMove(h, { clientX: 400, clientY: 300, pointerId: 1 }));
    fireEvent.pointerUp(h, { pointerId: 1 });
    expect(parseInt(m.style.width)).toBeLessThan(780);
  });
  it('высота уменьшается при drag вверх', async () => {
    const { container } = await renderModal();
    const h = getHandle(container)!;
    const m = getModal(container)!;
    fireEvent.pointerDown(h, { clientX: 500, clientY: 300, pointerId: 1 });
    await act(async () => fireEvent.pointerMove(h, { clientX: 500, clientY: 200, pointerId: 1 }));
    fireEvent.pointerUp(h, { pointerId: 1 });
    expect(parseInt(m.style.height)).toBeLessThan(540);
  });
  it('ширина зажата минимумом 560', async () => {
    const { container } = await renderModal();
    const h = getHandle(container)!;
    fireEvent.pointerDown(h, { clientX: 500, clientY: 300, pointerId: 1 });
    await act(async () => fireEvent.pointerMove(h, { clientX: -9999, clientY: 300, pointerId: 1 }));
    fireEvent.pointerUp(h, { pointerId: 1 });
    expect(parseInt(getModal(container)!.style.width)).toBe(560);
  });
  it('высота зажата минимумом 440', async () => {
    const { container } = await renderModal();
    const h = getHandle(container)!;
    fireEvent.pointerDown(h, { clientX: 500, clientY: 300, pointerId: 1 });
    await act(async () => fireEvent.pointerMove(h, { clientX: 500, clientY: -9999, pointerId: 1 }));
    fireEvent.pointerUp(h, { pointerId: 1 });
    expect(parseInt(getModal(container)!.style.height)).toBe(440);
  });
  it('после pointerUp дальнейший move не меняет размер', async () => {
    const { container } = await renderModal();
    const h = getHandle(container)!;
    const m = getModal(container)!;
    fireEvent.pointerDown(h, { clientX: 500, clientY: 300, pointerId: 1 });
    await act(async () => fireEvent.pointerMove(h, { clientX: 600, clientY: 300, pointerId: 1 }));
    fireEvent.pointerUp(h, { pointerId: 1 });
    const w = parseInt(m.style.width);
    await act(async () => fireEvent.pointerMove(h, { clientX: 900, clientY: 300, pointerId: 1 }));
    expect(parseInt(m.style.width)).toBe(w);
  });
  it('pointerCancel останавливает resize', async () => {
    const { container } = await renderModal();
    const h = getHandle(container)!;
    const m = getModal(container)!;
    fireEvent.pointerDown(h, { clientX: 500, clientY: 300, pointerId: 1 });
    await act(async () => fireEvent.pointerMove(h, { clientX: 600, clientY: 300, pointerId: 1 }));
    fireEvent.pointerCancel(h, { pointerId: 1 });
    const w = parseInt(m.style.width);
    await act(async () => fireEvent.pointerMove(h, { clientX: 800, clientY: 300, pointerId: 1 }));
    expect(parseInt(m.style.width)).toBe(w);
  });
});

describe('SettingsModal — flex scroll chain', () => {
  it('scroll-контейнер имеет min-h-0', async () => {
    const { container } = await renderModal();
    expect(getScroll(container)).not.toBeNull();
  });
  it('правая колонка имеет min-h-0', async () => {
    const { container } = await renderModal();
    expect(container.querySelector('.flex-1.flex.flex-col.min-w-0.min-h-0')).not.toBeNull();
  });
  it('scroll-контейнер имеет overflow-x-hidden', async () => {
    const { container } = await renderModal();
    expect(getScroll(container)!.className).toContain('overflow-x-hidden');
  });
  it('левая колонка имеет overflow-y-auto', async () => {
    const { container } = await renderModal();
    expect(container.querySelector('.shrink-0.overflow-y-auto')).not.toBeNull();
  });
});

describe('SettingsModal — backdrop', () => {
  it('onClose при клике на backdrop', async () => {
    const { container, onClose } = await renderModal();
    fireEvent.click(container.querySelector('.absolute.inset-0') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('onClose НЕ вызывается при pointerDown на handle', async () => {
    const { container, onClose } = await renderModal();
    fireEvent.pointerDown(getHandle(container)!, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(getHandle(container)!, { pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
  });
});
