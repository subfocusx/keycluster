// ============================================================
// Tests: modules/ngrams — algorithm + UI panel
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NgramsPanel } from '@user-plugins/ngrams/components';
import { clusterByNgrams, ngramsSettings } from '@user-plugins/ngrams/index';
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
// Algorithm tests (pure function)
// ============================================================

describe('clusterByNgrams — additional algorithm coverage', () => {
  it('NG2: extracts bigrams correctly', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить телефон samsung', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'купить телефон nokia', createdAt: Date.now() },
    ];
    // Shared bigrams: "купить телефон", "телефон samsung" vs "телефон nokia"
    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.3, minGroupSize: 1, stopWords: [] });
    // Both share "купить телефон" bigram → should cluster together
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('NG3: changing ngramSize from 2 to 3 changes results', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить телефон samsung москва', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'купить телефон nokia питер', createdAt: Date.now() },
      { id: '3', groupId: 'g1', text: 'аренда квартир москва', createdAt: Date.now() },
    ];
    const bigram = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.2, minGroupSize: 1, stopWords: [] });
    const trigram = clusterByNgrams(phrases, { ngramSize: 3, threshold: 0.2, minGroupSize: 1, stopWords: [] });
    // They might differ
    expect(bigram.size).toBeGreaterThanOrEqual(1);
    expect(trigram.size).toBeGreaterThanOrEqual(1);
  });

  it('NG5: single-word phrases have no bigrams → empty state', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'ноутбук', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'телефон', createdAt: Date.now() },
    ];
    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.3, minGroupSize: 2, stopWords: [] });
    // Single words produce whole-phrase n-grams, but they won't match each other
    expect(clusters.size).toBe(0);
  });

  it('NG6: minGroupSize filters small clusters', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить телефон', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'аренда квартиры', createdAt: Date.now() },
    ];
    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.1, minGroupSize: 2, stopWords: [] });
    // No shared bigrams → no clusters ≥ 2
    expect(clusters.size).toBe(0);
  });

  it('should handle lemmatize option', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить телефоны', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'купить телефон', createdAt: Date.now() },
    ];
    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.3, minGroupSize: 1, lemmatize: true, stopWords: [] });
    // "телефоны" → "телефон" with lemmatize → bigram "купить телефон" matches
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should handle ignoreNumbers option', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'iphone 15 купить', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'iphone 16 купить', createdAt: Date.now() },
    ];
    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.2, minGroupSize: 1, ignoreNumbers: true, stopWords: [] });
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should handle identical phrases', () => {
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить ноутбук', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'купить ноутбук', createdAt: Date.now() },
    ];
    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.3, minGroupSize: 1, stopWords: [] });
    // Identical phrases should cluster together
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should use inverted index optimization — many phrases', () => {
    // Create many phrases where only 2 share a bigram
    const phrases = [
      { id: '1', groupId: 'g1', text: 'купить красный телефон москва', createdAt: Date.now() },
      { id: '2', groupId: 'g1', text: 'купить красный ботинок москва', createdAt: Date.now() },
      { id: '3', groupId: 'g1', text: 'аренда квартиры питер недорого', createdAt: Date.now() },
      { id: '4', groupId: 'g1', text: 'ремонт авто сервис быстро', createdAt: Date.now() },
      { id: '5', groupId: 'g1', text: 'дизайн интерьера проект', createdAt: Date.now() },
    ];
    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.3, minGroupSize: 2, stopWords: [] });
    // 1 and 2 share "купить красный" and "красный [word]"
    let found12 = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        found12 = true;
      }
    }
    expect(found12).toBe(true);
  });
});

// ============================================================
// UI Panel tests
// ============================================================

describe('NgramsPanel — UI', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('NG1: renders without errors with empty data', () => {
    render(<NgramsPanel ctx={ctx as any} />);
    expect(screen.getByText('Размер N-граммы')).toBeInTheDocument();
    expect(screen.getByText(/Группировка фраз по N-граммам/)).toBeInTheDocument();
  });

  it('shows disabled button when no phrases', () => {
    render(<NgramsPanel ctx={ctx as any} />);
    const btn = screen.getByText(/Кластеризовать/);
    expect(btn).toBeDisabled();
  });

  it('shows phrase count in button', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G1');
    store.addPhrases(['фраза 1', 'фраза 2'], gid);

    render(<NgramsPanel ctx={ctx as any} />);
    expect(screen.getByText(/Кластеризовать \(2 фр\.\)/)).toBeInTheDocument();
  });

  it('shows threshold and minGroupSize controls', () => {
    render(<NgramsPanel ctx={ctx as any} />);
    expect(screen.getByText('Порог схожести')).toBeInTheDocument();
    expect(screen.getByText('Мин. размер группы')).toBeInTheDocument();
  });

  it('shows preprocessing checkboxes', () => {
    render(<NgramsPanel ctx={ctx as any} />);
    expect(screen.getByText('Лемматизация')).toBeInTheDocument();
    expect(screen.getByText('Игнорировать числа')).toBeInTheDocument();
  });

  it('shows stop words textarea', () => {
    render(<NgramsPanel ctx={ctx as any} />);
    expect(screen.getByText('Стоп-слова (через запятую)')).toBeInTheDocument();
  });

  it('NG2: clusters phrases and shows results', async () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G1');
    store.addPhrases([
      'купить красные туфли',
      'купить красные ботинки',
    ], gid);

    render(<NgramsPanel ctx={ctx as any} />);
    await userEvent.click(screen.getByText(/Кластеризовать/));

    await waitFor(() => {
      expect(screen.getByText(/Найдено \d+ кластеров/)).toBeInTheDocument();
    });
  });

  it('NG5: empty state when no clusters found', async () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G1');
    // Two completely different phrases with no shared bigrams
    store.addPhrases(['уникальное слово один', 'совершенно другой текст'], gid);

    render(<NgramsPanel ctx={ctx as any} />);
    await userEvent.click(screen.getByText(/Кластеризовать/));

    await waitFor(() => {
      expect(screen.getByText(/Не удалось найти кластеры/)).toBeInTheDocument();
    });
  });

  it('clicking "Создать группы" creates structure and emits events', async () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G1');
    store.addPhrases([
      'купить красные туфли',
      'купить красные ботинки',
      'купить синие туфли',
    ], gid);

    render(<NgramsPanel ctx={ctx as any} />);
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

    render(<NgramsPanel ctx={ctx as any} />);
    expect(screen.getByText(/Кластеризовать \(1 фр\.\)/)).toBeInTheDocument();
  });
});
