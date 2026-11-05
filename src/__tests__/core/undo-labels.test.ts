// ============================================================
// Tests: человекочитаемые подписи действий в undo/redo
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useAppStore } from '@/plugin-sdk';
import { buildHistoryLines, StatusBar } from '@/shell/status-bar';

function lastUndoLabel(): string | undefined {
  const stack = useAppStore.getState().undoStack;
  return stack[stack.length - 1]?.label;
}

function lastRedoLabel(): string | undefined {
  const stack = useAppStore.getState().redoStack;
  return stack[stack.length - 1]?.label;
}

describe('Undo/redo: подписи действий', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  // ---- pushUndo ----

  it('pushUndo сохраняет переданную подпись в снимке', () => {
    const store = useAppStore.getState();
    store.pushUndo('Тестовое действие');

    const stack = useAppStore.getState().undoStack;
    expect(stack).toHaveLength(1);
    expect(stack[stack.length - 1].label).toBe('Тестовое действие');
  });

  it('pushUndo без подписи оставляет label равным undefined (обратная совместимость)', () => {
    const store = useAppStore.getState();
    store.pushUndo();

    const stack = useAppStore.getState().undoStack;
    expect(stack).toHaveLength(1);
    expect(stack[stack.length - 1].label).toBeUndefined();
  });

  it('pushUndo в batch-режиме не создаёт снимок, как и раньше', () => {
    const store = useAppStore.getState();
    store.batchOperation(() => {
      useAppStore.getState().pushUndo('Внутреннее действие');
    }, 'Пакетное действие');

    const stack = useAppStore.getState().undoStack;
    expect(stack).toHaveLength(1);
    expect(stack[0].label).toBe('Пакетное действие');
  });

  // ---- batchOperation ----

  it('batchOperation сохраняет одну подпись на весь пакет изменений', () => {
    const store = useAppStore.getState();
    store.batchOperation(() => {
      const s = useAppStore.getState();
      s.addGroup('A');
      s.addGroup('B');
    }, 'Создание 2 групп');

    const stack = useAppStore.getState().undoStack;
    expect(stack).toHaveLength(1);
    expect(stack[0].label).toBe('Создание 2 групп');
    expect(useAppStore.getState().groups).toHaveLength(2);
  });

  it('batchOperation без подписи работает как раньше', () => {
    const store = useAppStore.getState();
    store.batchOperation(() => {
      useAppStore.getState().addGroup('A');
    });

    const stack = useAppStore.getState().undoStack;
    expect(stack).toHaveLength(1);
    expect(stack[0].label).toBeUndefined();
    expect(useAppStore.getState().groups).toHaveLength(1);
  });

  // ---- undo / redo ----

  it('undo откатывает изменение и переносит подпись в redo', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Кластеры');
    useAppStore.getState().addPhrases(['фраза 1', 'фраза 2'], gid);

    expect(useAppStore.getState().phrases).toHaveLength(2);
    expect(lastUndoLabel()).toBe('Добавление 2 фраз в «Кластеры»');

    useAppStore.getState().undo();

    // Состояние откатилось
    expect(useAppStore.getState().phrases).toHaveLength(0);
    // Подпись действия перенесена в redo
    expect(lastRedoLabel()).toBe('Добавление 2 фраз в «Кластеры»');
  });

  it('redo повторяет действие и возвращает подпись в undo', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Кластеры');
    useAppStore.getState().addPhrases(['фраза 1', 'фраза 2'], gid);

    useAppStore.getState().undo();
    useAppStore.getState().redo();

    expect(useAppStore.getState().phrases).toHaveLength(2);
    expect(lastRedoLabel()).toBeUndefined();
    expect(lastUndoLabel()).toBe('Добавление 2 фраз в «Кластеры»');
  });

  it('отмена без подписи не ломает undo/redo', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Без подписи');
    store.pushUndo(); // снимок без label
    useAppStore.getState().renameGroup(gid, 'Переименовано');

    useAppStore.getState().undo();
    expect(useAppStore.getState().groups.find(g => g.id === gid)?.name).toBe('Без подписи');

    useAppStore.getState().redo();
    expect(useAppStore.getState().groups.find(g => g.id === gid)?.name).toBe('Переименовано');
  });

  // ---- подписи реальных мутаций ----

  it('мутации проставляют осмысленные русские подписи', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Кластеры');
    expect(lastUndoLabel()).toBe('Добавление группы «Кластеры»');

    useAppStore.getState().addPhrases(['a', 'b', 'c'], gid);
    expect(lastUndoLabel()).toBe('Добавление 3 фраз в «Кластеры»');

    const other = useAppStore.getState().addGroup('Другая');
    const ids = useAppStore.getState().phrases.map(p => p.id);
    useAppStore.getState().movePhrases(ids, other);
    expect(lastUndoLabel()).toBe('Перенос 3 фраз в «Другая»');

    useAppStore.getState().addMinusWord('bad', false, null, 'broad');
    expect(lastUndoLabel()).toBe('Добавление минус-фразы «bad»');

    useAppStore.getState().deleteGroup(other);
    expect(lastUndoLabel()).toBe('Удаление группы «Другая»');
  });

  it('подписи согласуют числительные по-русски', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Одна');
    useAppStore.getState().addPhrases(['a'], gid);
    expect(lastUndoLabel()).toBe('Добавление 1 фразы в «Одна»');

    useAppStore.getState().addPhrases(['a', 'b'], gid);
    expect(lastUndoLabel()).toBe('Добавление 2 фраз в «Одна»');

    useAppStore.getState().addPhrases(['a', 'b', 'c', 'd', 'e'], gid);
    expect(lastUndoLabel()).toBe('Добавление 5 фраз в «Одна»');
  });

  // ---- лимит стека ----

  it('лимит стека в 50 записей сохраняется', () => {
    for (let i = 0; i < 60; i++) {
      useAppStore.getState().addGroup(`G${i}`);
    }
    const stack = useAppStore.getState().undoStack;
    expect(stack).toHaveLength(50);
    expect(stack[stack.length - 1].label).toBe('Добавление группы «G59»');
  });

  // ---- подсказка статус-бара ----

  it('подсказка показывает последние действия, начиная с следующего к отмене', () => {
    const lines = buildHistoryLines([
      { label: 'Первое' },
      { label: 'Второе' },
      { label: 'Третье' },
    ] as any);

    expect(lines).toEqual(['1. Третье', '2. Второе', '3. Первое']);
  });

  it('подсказка ограничивается пятью строками', () => {
    const stack = Array.from({ length: 8 }, (_, i) => ({ label: `Действие ${i + 1}` })) as any;
    const lines = buildHistoryLines(stack);

    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('1. Действие 8');
    expect(lines[4]).toBe('5. Действие 4');
  });

  it('подсказка не ломается для снимков без подписи', () => {
    const lines = buildHistoryLines([{}] as any);
    expect(lines).toEqual(['1. Действие']);
  });

  it('подсказка статус-бара отражает реальные действия стека', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Кластеры');
    useAppStore.getState().addPhrases(['фраза'], gid);

    const lines = buildHistoryLines(useAppStore.getState().undoStack);
    expect(lines[0]).toBe('1. Добавление 1 фразы в «Кластеры»');

    useAppStore.getState().undo();
    const redoLines = buildHistoryLines(useAppStore.getState().redoStack);
    expect(redoLines[0]).toBe('1. Добавление 1 фразы в «Кластеры»');
  });

  it('наведение на «↩ N» в статус-баре показывает подписи действий', async () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Кластеры');
    useAppStore.getState().addPhrases(['фраза 1', 'фраза 2'], gid);

    render(React.createElement(StatusBar, { onTrashOpen: () => { } }));
    const undoButton = screen.getByLabelText(/Отменить/);
    await userEvent.hover(undoButton);

    await waitFor(() => {
      const found = screen.getAllByText('1. Добавление 2 фраз в «Кластеры»');
      expect(found.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
    expect(screen.getAllByText('2. Добавление группы «Кластеры»').length).toBeGreaterThan(0);
  });
});
