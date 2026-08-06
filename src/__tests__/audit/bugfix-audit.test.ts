// ============================================================
// Audit Bugfix Tests — регрессионные тесты для исправленных багов
// ============================================================
//
// Баг #1: Кластеризация Worker всегда возвращает []
// Баг #2: PluginRegistry не загружается при старте
// Баг #3: Сломанный cleanup в reloadModule() — утечка памяти
// Баг #4: O(N²) на минус-фразах и выделении
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clusterByWords, clusterByJaccard } from '@user-plugins/clustering/index';
import { PluginRegistry } from '@/plugin-sdk';
import type { Phrase } from '@/core/types';
import { createStoreAccess, useAppStore } from '@/core/store';

describe('Plugin Registry', () => {
  describe('clusterByJaccard — должен возвращать непустые кластеры', () => {
    it('должен возвращать кластеры для похожих фраз', () => {
      const phrases: Phrase[] = [
        { id: '1', groupId: 'root', text: 'купить ноутбук', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
        { id: '2', groupId: 'root', text: 'ноутбук для работы', frequency: 50, kei: 8, cpc: 4, createdAt: Date.now() },
        { id: '3', groupId: 'root', text: 'ноутбук игровой', frequency: 60, kei: 9, cpc: 6, createdAt: Date.now() },
      ];

      const clusters = clusterByJaccard(phrases, 0.2);

      // Раньше всегда возвращал [] — теперь должен вернуть хотя бы 1 кластер
      expect(clusters.size).toBeGreaterThanOrEqual(1);

      // Все фразы должны быть распределены по кластерам
      const totalPhrases = Array.from(clusters.values()).reduce((sum, arr) => sum + arr.length, 0);
      expect(totalPhrases).toBe(3);
    });

    it('должен группировать фразы с общими словами', () => {
      const phrases: Phrase[] = [
        { id: '1', groupId: 'root', text: 'красный ноутбук', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
        { id: '2', groupId: 'root', text: 'синий ноутбук', frequency: 50, kei: 8, cpc: 4, createdAt: Date.now() },
        { id: '3', groupId: 'root', text: 'аренда квартиры', frequency: 30, kei: 5, cpc: 3, createdAt: Date.now() },
      ];

      const clusters = clusterByJaccard(phrases, 0.3);

      // "ноутбук" фразы должны быть в одном кластере
      expect(clusters.size).toBeGreaterThanOrEqual(1);

      // Находим кластер с ноутбуком
      const laptopCluster = Array.from(clusters.values()).find(arr =>
        arr.some(p => p.text.includes('ноутбук'))
      );
      expect(laptopCluster).toBeDefined();
      expect(laptopCluster!.length).toBe(2);
    });

    it('должен возвращать пустой Map для пустого входа', () => {
      const clusters = clusterByJaccard([], 0.3);
      expect(clusters.size).toBe(0);
    });

    it('каждая фраза должна быть ровно в одном кластере (без дублирования)', () => {
      const phrases: Phrase[] = [
        { id: '1', groupId: 'root', text: 'купить ноутбук дешево', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
        { id: '2', groupId: 'root', text: 'купить ноутбук быстро', frequency: 80, kei: 8, cpc: 4, createdAt: Date.now() },
        { id: '3', groupId: 'root', text: 'аренда авто', frequency: 30, kei: 5, cpc: 3, createdAt: Date.now() },
        { id: '4', groupId: 'root', text: 'продать авто', frequency: 20, kei: 3, cpc: 2, createdAt: Date.now() },
      ];

      const clusters = clusterByJaccard(phrases, 0.2);

      // Собираем все ID фраз из кластеров
      const allIds: string[] = [];
      for (const clusterPhrases of clusters.values()) {
        for (const p of clusterPhrases) {
          allIds.push(p.id);
        }
      }

      // Нет дублирования ID
      expect(new Set(allIds).size).toBe(allIds.length);
      // Все фразы распределены
      expect(allIds.length).toBe(4);
    });
  });

  describe('clusterByWords — должен возвращать непустые кластеры', () => {
    it('должен группировать фразы по общим словам', () => {
      const phrases: Phrase[] = [
        { id: '1', groupId: 'root', text: 'купить ноутбук', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
        { id: '2', groupId: 'root', text: 'купить телефон', frequency: 80, kei: 9, cpc: 4, createdAt: Date.now() },
        { id: '3', groupId: 'root', text: 'продать машину', frequency: 50, kei: 5, cpc: 3, createdAt: Date.now() },
      ];

      const clusters = clusterByWords(phrases, 1);
      expect(clusters.size).toBeGreaterThanOrEqual(1);

      const totalPhrases = Array.from(clusters.values()).reduce((sum, arr) => sum + arr.length, 0);
      expect(totalPhrases).toBe(3);
    });
  });
});

// ============================================================
// Баг #2: PluginRegistry не загружается при старте
// ============================================================

describe('Баг #2: PluginRegistry — загрузка при старте', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
    try {
      localStorage.removeItem('keycluster:plugin-registry');
    } catch {}
  });

  it('load() должен загружать данные из localStorage', () => {
    // Сначала сохраняем данные через один экземпляр
    registry.install('clustering', 'builtin');
    registry.install('deduplicator', 'user');
    registry.disable('deduplicator');
    registry.save();

    // Создаём новый экземпляр и загружаем
    const registry2 = new PluginRegistry();
    const loaded = registry2.load();

    expect(loaded).toHaveLength(2);
    expect(registry2.isEnabled('clustering')).toBe(true);
    expect(registry2.isEnabled('deduplicator')).toBe(false);
  });

  it('load() должен вызываться ПЕРЕД getAll() при старте', () => {
    // Симулируем сценарий bootstrap: install -> save -> новый экземпляр -> load -> getAll
    registry.install('clustering', 'builtin');
    registry.save();

    const registry2 = new PluginRegistry();
    // Без load() — пусто
    expect(registry2.getAll()).toHaveLength(0);

    // После load() — данные восстановлены
    registry2.load();
    expect(registry2.getAll()).toHaveLength(1);
    expect(registry2.isEnabled('clustering')).toBe(true);
  });

  it('enabled/disabled статус должен сохраняться после перезапуска', () => {
    registry.install('clustering', 'builtin');
    registry.install('deduplicator', 'user');
    registry.disable('clustering');
    registry.save();

    const registry2 = new PluginRegistry();
    registry2.load();

    expect(registry2.isEnabled('clustering')).toBe(false);
    expect(registry2.isEnabled('deduplicator')).toBe(true);
  });

  it('установленные плагины не дублируются при повторной загрузке', () => {
    registry.install('clustering', 'builtin');
    registry.save();

    const registry2 = new PluginRegistry();
    registry2.load();
    registry2.load(); // Двойная загрузка
    expect(registry2.getAll()).toHaveLength(1);
  });

  it('корректно обрабатывает повреждённые данные localStorage', () => {
    localStorage.setItem('keycluster:plugin-registry', '{invalid json');
    const loaded = registry.load();
    expect(loaded).toHaveLength(0);
  });
});

// ============================================================
// Баг #3: Сломанный cleanup в reloadModule()
// ============================================================

describe('Баг #3: reloadModule cleanup', () => {
  it('keybindingManager.unregister() должен вызываться при reload', async () => {
    const { createRuntime } = await import('@/core/module-runtime');
    const { keybindingManager } = await import('@/core/keybinding-manager');
    const { createEventBus } = await import('@/core/event-bus');

    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    const runtime = createRuntime(eventBus, storeAccess);

    const testModule = {
      manifest: {
        id: 'test-cleanup',
        name: 'Test Cleanup',
        version: '1.0.0',
        description: 'test',
        slot: [],
        dependencies: [],
        settingsSchema: [],
      },
      init(ctx: any) {
        ctx.registerCommand('run', () => {});
        ctx.registerKeybinding('ctrl+shift+t', 'run', { label: 'Test' });
      },
      destroy() {},
    };

    runtime.register(testModule);
    runtime.initAll();

    const unregisterSpy = vi.spyOn(keybindingManager, 'unregister');

    const result = await runtime.reloadModule('test-cleanup');

    expect(result).toBe(true);
    expect(unregisterSpy).toHaveBeenCalled();

    unregisterSpy.mockRestore();
    runtime.destroyAll();
  });

  it('lifecycle hooks должны корректно очищаться при reload (без дублирования)', async () => {
    const { createRuntime } = await import('@/core/module-runtime');
    const { createEventBus } = await import('@/core/event-bus');

    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    const runtime = createRuntime(eventBus, storeAccess);

    const hookCalls: string[] = [];

    const testModule = {
      manifest: {
        id: 'test-hooks-cleanup',
        name: 'Test Hooks Cleanup',
        version: '1.0.0',
        description: 'test',
        slot: [],
        dependencies: [],
        settingsSchema: [],
      },
      init(ctx: any) {
        ctx.registerLifecycleHook('onSettingsChange', () => {
          hookCalls.push('hook-called');
        });
      },
      destroy() {},
    };

    runtime.register(testModule);
    runtime.initAll();

    // Вызываем settings change — должен быть 1 вызов
    runtime.triggerSettingsChange('test-hooks-cleanup', 'key', 'val');
    expect(hookCalls).toHaveLength(1);

    // Перезагружаем модуль
    await runtime.reloadModule('test-hooks-cleanup');

    // После reload старый хук должен быть удалён, новый добавлен
    hookCalls.length = 0;
    runtime.triggerSettingsChange('test-hooks-cleanup', 'key', 'val2');
    // Должен быть ровно 1 вызов (не 2 из-за дублирования)
    expect(hookCalls).toHaveLength(1);

    runtime.destroyAll();
  });

  it('после reload не должно быть призрачных keybindings', async () => {
    const { createRuntime } = await import('@/core/module-runtime');
    const { createEventBus } = await import('@/core/event-bus');

    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    const runtime = createRuntime(eventBus, storeAccess);

    const testModule = {
      manifest: {
        id: 'test-ghost-kb',
        name: 'Test Ghost KB',
        version: '1.0.0',
        description: 'test',
        slot: [],
        dependencies: [],
        settingsSchema: [],
      },
      init(ctx: any) {
        ctx.registerCommand('run', () => {});
        ctx.registerKeybinding('ctrl+alt+g', 'run', { label: 'Ghost Test' });
      },
      destroy() {},
    };

    runtime.register(testModule);
    runtime.initAll();

    const bindingsBefore = runtime.getKeybindings();
    expect(bindingsBefore.some(b => b.keys === 'ctrl+alt+g')).toBe(true);

    await runtime.reloadModule('test-ghost-kb');

    const bindingsAfter = runtime.getKeybindings();
    const ghostBindings = bindingsAfter.filter(b => b.moduleId === 'test-ghost-kb');
    expect(ghostBindings).toHaveLength(1);

    runtime.destroyAll();
  });
});

// ============================================================
// Баг #4: O(N²) на минус-фразах и выделении
// ============================================================

describe('Баг #4: Оптимизация минус-фраз', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  describe('applyMinusWords — оптимизированная версия', () => {
    it('должен корректно обрабатывать broad минус-фразы', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['купить ноутбук', 'ноутбук бесплатно', 'компьютер'], groupId);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');
      const result = useAppStore.getState().applyMinusWords();
      expect(result.removed).toBe(1);
    });

    it('должен корректно обрабатывать exact минус-фразы', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['ноутбук', 'ноутбук купить', 'ноутбук дешево'], groupId);
      useAppStore.getState().addMinusWord('ноутбук', true, null, 'exact');
      const result = useAppStore.getState().applyMinusWords();
      expect(result.removed).toBe(1);
    });

    it('должен корректно обрабатывать broad_modified (по словам) минус-фразы', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['бесплатный ноутбук', 'ноутбук бесплатно', 'платный ноутбук'], groupId);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad_modified');
      const result = useAppStore.getState().applyMinusWords();
      expect(result.removed).toBe(1);
    });

    it('должен обрабатывать глобальные и групповые минус-фразы раздельно', () => {
      const g1 = useAppStore.getState().addGroup('G1');
      const g2 = useAppStore.getState().addGroup('G2');
      useAppStore.getState().addPhrases(['ноутбук дешево'], g1);
      useAppStore.getState().addPhrases(['ноутбук дешево'], g2);
      useAppStore.getState().addMinusWord('дешево', false, g1, 'broad');
      const result = useAppStore.getState().applyMinusWords();
      expect(result.removed).toBe(1);
      expect(useAppStore.getState().phrases.filter(p => p.groupId === g2)).toHaveLength(1);
    });

    it('должен пропускать фразы в корзине', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['ноутбук бесплатно', 'компьютер'], groupId);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      const result1 = useAppStore.getState().applyMinusWords();
      expect(result1.removed).toBe(1);

      const result2 = useAppStore.getState().applyMinusWords();
      expect(result2.removed).toBe(0);
    });

    it('должен обрабатывать пустой список минус-фраз', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['тестовая фраза'], groupId);
      const result = useAppStore.getState().applyMinusWords();
      expect(result.removed).toBe(0);
    });

    it('должен возвращать список затронутых групп', () => {
      const g1 = useAppStore.getState().addGroup('G1');
      const g2 = useAppStore.getState().addGroup('G2');
      useAppStore.getState().addPhrases(['ноутбук бесплатно'], g1);
      useAppStore.getState().addPhrases(['телефон бесплатно'], g2);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');
      const result = useAppStore.getState().applyMinusWords();
      expect(result.removed).toBe(2);
      expect(result.groups).toContain(g1);
      expect(result.groups).toContain(g2);
    });

    it('оптимизированная версия должна давать те же результаты что и раньше', () => {
      const g1 = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases([
        'купить ноутбук',
        'ноутбук бесплатно',
        'бесплатный софт',
        'программа бесплатно',
        'платный софт',
      ], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');
      useAppStore.getState().addMinusWord('платный', false, null, 'broad_modified');

      const result = useAppStore.getState().applyMinusWords();

      // broad "бесплатно" должен матчить "ноутбук бесплатно", "программа бесплатно"
      // broad_modified "платный" должен матчить только слово "платный" -> "платный софт"
      // "бесплатный софт" НЕ матчится — "бесплатно" != "бесплатный" ни в broad, ни в broad_modified
      expect(result.removed).toBe(3);
    });
  });

  describe('applyMinusWords — производительность', () => {
    it('должен быстро обрабатывать большой набор данных', () => {
      const groupId = useAppStore.getState().addGroup('G1');

      // Создаём 1000 фраз
      const texts = Array.from({ length: 1000 }, (_, i) => `фраза номер ${i} тест`);
      useAppStore.getState().addPhrases(texts, groupId);

      // 50 минус-фраз
      for (let i = 0; i < 50; i++) {
        useAppStore.getState().addMinusWord(`минус${i}`, false, null, 'broad');
      }
      // Одна минус-фраза точно совпадёт
      useAppStore.getState().addMinusWord('тест', false, null, 'broad_modified');

      const start = performance.now();
      const result = useAppStore.getState().applyMinusWords();
      const duration = performance.now() - start;

      expect(result.removed).toBeGreaterThan(0);
      // Оптимизированная версия должна отработать за < 100мс на 1000 фраз x 50 минус-фраз
      expect(duration).toBeLessThan(100);
    });
  });
});
