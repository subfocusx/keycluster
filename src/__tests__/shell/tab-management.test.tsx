import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useTabStore } from '@/plugin-sdk';

const resetTabStore = () => useTabStore.setState({ customTabs: [
    { id: 'data', label: 'Данные', order: 0, isBuiltin: true },
    { id: 'algorithms', label: 'Алгоритмы', order: 1, isBuiltin: true },
    { id: 'ai', label: 'AI', order: 2, isBuiltin: true },
    { id: 'plugins', label: 'Плагины', order: 3, isBuiltin: true },
    { id: 'view', label: 'Вид', order: 4, isBuiltin: true },
  ],
  toolTabOverrides: {},
});

describe('Tab store', () => {
  beforeEach(() => resetTabStore());

  it('store has expected state shape', () => {
    const state = useTabStore.getState();
    expect(state).toBeDefined();
    expect(typeof state.customTabs).toBe('object');
    expect(Array.isArray(state.customTabs)).toBe(true);
    expect(state.customTabs.length).toBe(5);
    expect(typeof state.toolTabOverrides).toBe('object');
    expect(typeof state.addTab).toBe('function');
    expect(typeof state.renameTab).toBe('function');
    expect(typeof state.removeTab).toBe('function');
    expect(typeof state.moveToolToTab).toBe('function');
    expect(typeof state.reorderTabs).toBe('function');
  });

  it('добавляет новую вкладку', () => {
    const before = useTabStore.getState().customTabs.length;
    useTabStore.getState().addTab('Custom Tab');
    const after = useTabStore.getState().customTabs.length;
    expect(after).toBe(before + 1);
    expect(useTabStore.getState().customTabs.find(t => t.label === 'Custom Tab')).toBeTruthy();
  });

  it('переименовывает существующую вкладку', () => {
    useTabStore.getState().renameTab('data', 'Data renamed');
    const tab = useTabStore.getState().customTabs.find(t => t.id === 'data');
    expect(tab?.label).toBe('Data renamed');
  });

  it('не позволяет удалить builtin-вкладку', () => {
    expect(() => {
      useTabStore.getState().removeTab('data');
    }).toThrow('Cannot remove builtin tab');
    expect(useTabStore.getState().customTabs.find(t => t.id === 'data')).toBeTruthy();
  });

  it('удаляет кастомную вкладку', () => {
    useTabStore.getState().addTab('Custom');
    const added = useTabStore.getState().customTabs.find(t => t.label === 'Custom')!;
    expect(added).toBeDefined();
    useTabStore.getState().removeTab(added.id);
    expect(useTabStore.getState().customTabs.find(t => t.id === added.id)).toBeFalsy();
  });

  it('перемещает инструмент на другую вкладку', () => {
    useTabStore.getState().addTab('New Tab');
    const newTab = useTabStore.getState().customTabs.find(t => t.label === 'New Tab')!;
    useTabStore.getState().moveToolToTab('minus-words', newTab.id);
    expect(useTabStore.getState().toolTabOverrides['minus-words']).toBe(newTab.id);
  });

  it('возвращает инструмент на дефолтную вкладку при удалении его вкладки', () => {
    useTabStore.getState().addTab('Tools');
    const newTab = useTabStore.getState().customTabs.find(t => t.label === 'Tools')!;
    useTabStore.getState().moveToolToTab('minus-words', newTab.id);
    expect(useTabStore.getState().toolTabOverrides['minus-words']).toBe(newTab.id);
    useTabStore.getState().removeTab(newTab.id);
    expect(useTabStore.getState().toolTabOverrides['minus-words']).toBeUndefined();
  });

  it('упорядочивает вкладки по order', () => {
    const tabs = useTabStore.getState().customTabs;
    const orders = tabs.map(t => t.order);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });

  it('reorderTabs меняет order вкладок', () => {
    const tabIds = useTabStore.getState().customTabs.map(t => t.id);
    const reversed = [...tabIds].reverse();
    useTabStore.getState().reorderTabs(reversed);
    const reordered = useTabStore.getState().customTabs.sort((a, b) => a.order - b.order);
    expect(reordered.map(t => t.id)).toEqual(reversed);
  });

  it('не добавляет вкладку с пустым именем', () => {
    const before = useTabStore.getState().customTabs.length;
    useTabStore.getState().addTab('   ');
    expect(useTabStore.getState().customTabs.length).toBe(before);
  });

  it('не переименовывает в пустую строку', () => {
    useTabStore.getState().renameTab('data', '   ');
    expect(useTabStore.getState().customTabs.find(t => t.id === 'data')?.label).toBe('Данные');
  });

  it('системную вкладку можно переименовать', () => {
    useTabStore.getState().renameTab('data', 'Мои данные');
    expect(useTabStore.getState().customTabs.find(t => t.id === 'data')?.label).toBe('Мои данные');
  });

  it('при удалении пользовательской вкладки overrides очищаются', () => {
    useTabStore.getState().addTab('Моя вкладка');
    const myTab = useTabStore.getState().customTabs.find(t => t.label === 'Моя вкладка')!;
    useTabStore.getState().moveToolToTab('clustering', myTab.id);
    expect(useTabStore.getState().toolTabOverrides['clustering']).toBe(myTab.id);
    useTabStore.getState().removeTab(myTab.id);
    expect(useTabStore.getState().toolTabOverrides['clustering']).toBeUndefined();
  });
});
