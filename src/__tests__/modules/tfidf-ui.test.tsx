// ============================================================
// Tests: modules/tfidf — algorithm + UI panel
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TfIdfPanel } from '@user-plugins/tfidf/components';
import { clusterByTFIDF, tfidfSettings } from '@user-plugins/tfidf/index';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';

// ---- Helpers ----

function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), emit: vi.fn() },
    store: {
      dispatch: vi.fn(),
      getState: () => useAppStore.getState(),
      getStateSlice: (k: keyof ReturnType<typeof useAppStore.getState>) => useAppStore.getState()[k],
      subscribe: () => () => {},
    },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  };
}

// ============================================================
// Algorithm tests (TF-IDF math + clustering)
// ============================================================

describe('clusterByTFIDF — additional algorithm coverage', () => {
  it('TF2: TF-IDF math — rare word has higher IDF than common word', () => {
    // Word "смартфон" appears in 1 of 3 docs → high IDF
    // Word "купить" appears in all 3 docs → low IDF
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить смартфон', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'купить смартфон дешево', createdAt: Date.now() },
      { id: '3', groupId: 'g1', text: 'купить квартиру', createdAt: Date.now() },
    ];
    const clusters = clusterByTFIDF(phrases, { threshold: 0.3, minGroupSize: 1, stopWords: [] });
    // Phrases 1 and 2 share rare word "смартфон" → should cluster together
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('TF2: document-frequency — word in all docs has lower IDF', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить телефон', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'купить ноутбук', createdAt: Date.now() },
      { id: '3', groupId: 'g1', text: 'купить планшет', createdAt: Date.now() },
    ];
    const clusters = clusterByTFIDF(phrases, { threshold: 0.5, minGroupSize: 1, stopWords: [] });
    // "купить" is in all 3 → low IDF → low cosine similarity with threshold 0.5
    // They should NOT cluster (or form separate clusters)
    let allTogether = false;
    for (const [, cps] of clusters) {
      if (cps.length === 3) {
        allTogether = true;
      }
    }
    expect(allTogether).toBe(false);
  });

  it('TF4: threshold controls clustering strictness', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить ноутбук москва', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'ноутбук для работы', createdAt: Date.now() },
      { id: '3', groupId: 'g1', text: 'аренда авто', createdAt: Date.now() },
    ];
    const lowThreshold = clusterByTFIDF(phrases, { threshold: 0.1, minGroupSize: 1, stopWords: [] });
    const highThreshold = clusterByTFIDF(phrases, { threshold: 0.9, minGroupSize: 1, stopWords: [] });
    // Lower threshold → fewer clusters (more things grouped)
    expect(lowThreshold.size).toBeLessThanOrEqual(highThreshold.size);
  });

  it('TF5: minGroupSize filters small clusters', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить ноутбук', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'ремонт квартир', createdAt: Date.now() },
    ];
    const clusters = clusterByTFIDF(phrases, { threshold: 0.1, minGroupSize: 2, stopWords: [] });
    for (const [, cps] of clusters) {
      expect(cps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should handle ignoreNumbers option', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'iphone 15 pro', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'iphone 16 pro', createdAt: Date.now() },
      { id: '3', groupId: 'g1', text: 'аренда квартир', createdAt: Date.now() },
    ];
    const clusters = clusterByTFIDF(phrases, { threshold: 0.3, minGroupSize: 1, ignoreNumbers: true, stopWords: [] });
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should handle lemmatize option', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить телефоны дешево', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'купить телефон недорого', createdAt: Date.now() },
    ];
    const clusters = clusterByTFIDF(phrases, { threshold: 0.3, minGroupSize: 1, lemmatize: true, stopWords: [] });
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should handle custom stopWords', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'ноутбук москва купить', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'ноутбук питер купить', createdAt: Date.now() },
    ];
    const clusters = clusterByTFIDF(phrases, { threshold: 0.3, minGroupSize: 1, stopWords: ['москва', 'питер'] });
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should preserve all phrases across clusters', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить ноутбук', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'купить телефон', createdAt: Date.now() },
      { id: '3', groupId: 'g1', text: 'аренда квартиры', createdAt: Date.now() },
      { id: '4', groupId: 'g1', text: 'сдать квартиру', createdAt: Date.now() },
    ];
    const clusters = clusterByTFIDF(phrases, { threshold: 0.2, minGroupSize: 1, stopWords: [] });
    let total = 0;
    for (const [, cps] of clusters) total += cps.length;
    expect(total).toBe(phrases.length);
  });

  it('should generate unique cluster keys', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить а', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'купить б', createdAt: Date.now() },
      { id: '3', groupId: 'g1', text: 'продать в', createdAt: Date.now() },
      { id: '4', groupId: 'g1', text: 'продать г', createdAt: Date.now() },
    ];
    const clusters = clusterByTFIDF(phrases, { threshold: 0.3, minGroupSize: 1, stopWords: [] });
    const keys = [...clusters.keys()];
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('should return empty map for empty input', () => {
    const clusters = clusterByTFIDF([], { threshold: 0.3 });
    expect(clusters.size).toBe(0);
  });
});

// ============================================================
// UI Panel tests
// ============================================================

describe('TfIdfPanel — UI', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('TF1: renders without errors with empty data', () => {
    render(<TfIdfPanel ctx={ctx as any} />);
    expect(screen.getByText('Порог схожести')).toBeInTheDocument();
    expect(screen.getByText(/TF-IDF/)).toBeInTheDocument();
  });

  it('TF6: shows disabled button when no phrases', () => {
    render(<TfIdfPanel ctx={ctx as any} />);
    const btn = screen.getByText(/Кластеризовать/);
    expect(btn).toBeDisabled();
  });

  it('shows phrase count in button', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G1');
    store.addPhrases(['фраза 1', 'фраза 2', 'фраза 3'], gid);

    render(<TfIdfPanel ctx={ctx as any} />);
    expect(screen.getByText(/Кластеризовать \(3 фр\.\)/)).toBeInTheDocument();
  });

  it('shows threshold and minGroupSize controls', () => {
    render(<TfIdfPanel ctx={ctx as any} />);
    expect(screen.getByText('Порог схожести')).toBeInTheDocument();
    expect(screen.getByText('Мин. размер группы')).toBeInTheDocument();
  });

  it('shows preprocessing checkboxes', () => {
    render(<TfIdfPanel ctx={ctx as any} />);
    expect(screen.getByText('Лемматизация')).toBeInTheDocument();
    expect(screen.getByText('Игнорировать числа')).toBeInTheDocument();
  });

  it('shows stop words textarea', () => {
    render(<TfIdfPanel ctx={ctx as any} />);
    expect(screen.getByText('Стоп-слова (через запятую)')).toBeInTheDocument();
  });

  it('clusters phrases and shows results', async () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G1');
    store.addPhrases([
      'купить ноутбук москва',
      'купить ноутбук дешево',
      'аренда квартиры питер',
    ], gid);

    render(<TfIdfPanel ctx={ctx as any} />);
    await userEvent.click(screen.getByText(/Кластеризовать/));

    await waitFor(() => {
      expect(screen.getByText(/Найдено \d+ кластеров/)).toBeInTheDocument();
    });
  });

  it('TF6: empty state when no clusters found', async () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G1');
    store.addPhrases(['уникальное слово', 'совершенно другой текст'], gid);

    render(<TfIdfPanel ctx={ctx as any} />);
    await userEvent.click(screen.getByText(/Кластеризовать/));

    await waitFor(() => {
      expect(screen.getByText(/Не удалось найти кластеры/)).toBeInTheDocument();
    });
  });

  it('clicking "Создать группы" creates structure and emits events', async () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G1');
    store.addPhrases([
      'купить ноутбук москва',
      'купить ноутбук дешево',
      'аренда квартиры питер',
    ], gid);

    render(<TfIdfPanel ctx={ctx as any} />);
    await userEvent.click(screen.getByText(/Кластеризовать/));

    await waitFor(() => {
      expect(screen.getByText('Создать группы')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Создать группы'));

    const emitCalls = (ctx.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls;
    const eventTypes = emitCalls.map((c: unknown[]) => c[0]);
    expect(eventTypes).toContain('groups:changed');
    expect(eventTypes).toContain('phrases:changed');
  });

  it('uses only active group phrases when activeGroupId is set', () => {
    const store = useAppStore.getState();
    const gid1 = store.addGroup('G1');
    store.addPhrases(['купить телефон'], gid1);
    const gid2 = store.addGroup('G2');
    store.addPhrases(['аренда квартир'], gid2);
    store.setActiveGroup(gid1);

    render(<TfIdfPanel ctx={ctx as any} />);
    expect(screen.getByText(/Кластеризовать \(1 фр\.\)/)).toBeInTheDocument();
  });
});
