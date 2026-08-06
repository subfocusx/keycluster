import React, { useState, useMemo, useCallback, useEffect, useRef } from '../lib/react-shim';
import {
  useAppStore,
  dispatch,
  toast,
  getSetting,
  setSetting,
  handlerRefs,
  getPluginSettings,
  __consumePendingSync,
} from '../lib/sdk-shim';
import {
  filterRegistry,
  createLengthMoreFilter,
  createLengthLessFilter,
  createFrequencyMoreFilter,
  createSubstringFilter,
  removeSpecialChars,
} from '../lib/filters';
import type { PanelState } from '../lib/types';

const DEFAULT_SECTION_ORDER = [
  'cleanup',
  'wordFilters',
  'lengthFilters',
  'intentFilters',
  'frequencyFilter',
  'substringFilter',
  'stats',
  'history',
];

const SECTION_LABELS: Record<string, string> = {
  cleanup: 'Очистка',
  wordFilters: 'Фильтры по словам',
  lengthFilters: 'Фильтры по длине',
  intentFilters: 'Фильтры по интенту',
  frequencyFilter: 'Фильтр по частотности',
  substringFilter: 'Поиск по подстроке',
  stats: 'Статистика',
  history: 'История',
};

interface PanelProps {
  groupId?: string;
}

export default function SeoMultitoolPanel(props: PanelProps) {
  const groups = useAppStore((s: any) => s.groups ?? []);
  const allPhrases = useAppStore((s: any) => s.phrases ?? []);

  // Store's selectedGroupIds (Task 3)
  const appSelectedGroupIds = useAppStore((s: any) =>
    Array.from(s.selectedGroupIds ?? [])
  );

  // --- Task 1: Persistent settings ---
  const savedSettings = useMemo(() => getSetting<PanelState>('panelState'), []);
  const [filterMode, setFilterMode] = useState<'copy' | 'move'>(
    savedSettings?.filterMode ?? 'copy'
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    savedSettings?.selectedGroupId ?? props.groupId ?? ''
  );
  const [sections, setSections] = useState<Record<string, boolean>>(
    savedSettings?.openSections ?? {
      cleanup: true,
      wordFilters: true,
      lengthFilters: true,
      intentFilters: true,
      frequencyFilter: true,
      substringFilter: true,
      stats: false,
      history: false,
    }
  );
  const [sectionOrder, setSectionOrder] = useState<string[]>(
    savedSettings?.sectionOrder ?? DEFAULT_SECTION_ORDER
  );

  // Task 3: Multi-group
  const [multiMode, setMultiMode] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Task 6a: Progress
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Task 6b: History
  const [historyLog, setHistoryLog] = useState<{ time: string; msg: string }[]>([]);

  const [lengthN, setLengthN] = useState<string>('');
  const [frequencyN, setFrequencyN] = useState<string>('');
  const [substringQuery, setSubstringQuery] = useState<string>('');

  // --- Task 1: Save settings on change (debounced via setTimeout) ---
  const saveTimerRef = useRef<any>(null);
  const saveSettings = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSetting('panelState', {
        filterMode,
        selectedGroupId,
        openSections: sections,
        sectionOrder,
      } as PanelState);
    }, 500);
  }, [filterMode, selectedGroupId, sections, sectionOrder]);

  useEffect(() => {
    saveSettings();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [filterMode, selectedGroupId, sections, sectionOrder]);

  // BUG-4: sync from props
  useEffect(() => {
    if (props.groupId && props.groupId !== selectedGroupId && !multiMode) {
      setSelectedGroupId(props.groupId);
    }
  }, [props.groupId, selectedGroupId, multiMode]);

  // Task 3: "Use app selection" — pull store's selectedGroupIds
  const handleUseAppSelection = useCallback(() => {
    setSelectedGroupIds(appSelectedGroupIds);
    setMultiMode(true);
  }, [appSelectedGroupIds]);

  // Derived phrases: single or multi
  const isMultiGroup = multiMode && selectedGroupIds.length > 0;

  const activePhrases = useMemo(() => {
    if (isMultiGroup) {
      return allPhrases?.filter((p: any) => selectedGroupIds.includes(p.groupId)) ?? [];
    }
    return allPhrases?.filter((p: any) => p.groupId === selectedGroupId) ?? [];
  }, [allPhrases, selectedGroupId, selectedGroupIds, isMultiGroup]);

  const activeGroups = useMemo(() => {
    if (isMultiGroup) {
      return groups?.filter((g: any) => selectedGroupIds.includes(g.id)) ?? [];
    }
    const g = groups?.find((g: any) => g.id === selectedGroupId);
    return g ? [g] : [];
  }, [groups, selectedGroupId, selectedGroupIds, isMultiGroup]);

  const selectedGroup = useMemo(
    () => groups?.find((g: any) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  const groupPhraseCount = isMultiGroup
    ? activePhrases.length
    : activePhrases.length;

  const notify = useCallback((msg: string) => {
    try { toast(msg); } catch { /* ignore */ }
  }, []);

  const addHistory = useCallback((msg: string) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setHistoryLog((prev) => [{ time, msg }, ...prev].slice(0, historySize));
  }, []);

  // --- Task 4: Read plugin settings (from manifest settingsSchema) ---
  const pluginSettings = useMemo(() => getPluginSettings(), []);
  const historySize = pluginSettings.historySize ?? 10;
  const showStats = pluginSettings.showStats ?? true;
  const defaultFilterModeSetting = pluginSettings.defaultFilterMode ?? 'copy';

  // --- Task 3c: Poll for syncWithSelection updates ---
  useEffect(() => {
    const interval = setInterval(() => {
      const ids = __consumePendingSync();
      if (ids && ids.length > 0 && getSetting('syncWithSelection')) {
        setSelectedGroupIds(ids);
        setMultiMode(true);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // --- Task 5: Handler refs for hotkeys ---
  // (refs are assigned below after all useCallback)

  // --- Preview counts ---
  const filterPreviews = useMemo(() => {
    const result: Record<string, number> = {};
    filterRegistry.getAll().forEach((f) => {
      result[f.id] = activePhrases.filter((p: any) => f.check(p.text, p)).length;
    });
    return result;
  }, [activePhrases]);

  const totalPhrases = activePhrases.length;

  // --- Batch helpers (Task 2) ---
  const runBatchOperation = useCallback((
    targetPhrases: any[],
    mutator: (state: any, p: any) => boolean,
    successMsg: (count: number) => string,
    noopMsg?: string,
  ) => {
    if (targetPhrases.length === 0) {
      notify('Нет фраз для обработки');
      return;
    }

    const showProgress = targetPhrases.length > 100;
    if (showProgress) setProgress({ current: 0, total: targetPhrases.length });

    const schedule = () => {
      let count = 0;
      dispatch('batchOperation', (state: any) => {
        for (const p of targetPhrases) {
          const sp = state.phrases.find((sp: any) => sp.id === p.id);
          if (sp && mutator(state, sp)) count++;
        }
      });
      dispatch('pushUndo');
      setProgress(null);
      if (count > 0) {
        addHistory(successMsg(count));
        notify(successMsg(count));
      } else {
        notify(noopMsg ?? 'Нет изменений');
      }
    };

    if (showProgress) {
      setTimeout(schedule, 10);
    } else {
      schedule();
    }
  }, [notify, addHistory]);

  // --- Task 2: Trim (batch) ---
  const handleTrim = useCallback(() => {
    runBatchOperation(
      activePhrases,
      (_state: any, sp: any) => {
        const trimmed = sp.text.trim();
        if (trimmed !== sp.text) {
          sp.text = trimmed;
          return true;
        }
        return false;
      },
      (count: number) => `Обрезано пробелов: ${count} фраз`,
    );
  }, [activePhrases, runBatchOperation]);

  // --- Task 2: Lowercase (batch) ---
  const handleLowercase = useCallback(() => {
    runBatchOperation(
      activePhrases,
      (_state: any, sp: any) => {
        const lowered = sp.text.toLowerCase();
        if (lowered !== sp.text) {
          sp.text = lowered;
          return true;
        }
        return false;
      },
      (count: number) => `Переведено в нижний регистр: ${count} фраз`,
    );
  }, [activePhrases, runBatchOperation]);

  // --- Task 2: Clean chars (batch) ---
  const handleCleanChars = useCallback(() => {
    runBatchOperation(
      activePhrases,
      (_state: any, sp: any) => {
        const cleaned = removeSpecialChars(sp.text);
        if (cleaned !== sp.text) {
          sp.text = cleaned;
          return true;
        }
        return false;
      },
      (count: number) => `Спецсимволы удалены: ${count} фраз`,
    );
  }, [activePhrases, runBatchOperation]);

  // --- Deduplicate (uses moveToTrash, works on all active phrases) ---
  const handleDeduplicate = useCallback(() => {
    if (!selectedGroup && !isMultiGroup) return;
    const seen = new Set<string>();
    const toRemove: string[] = [];
    activePhrases.forEach((p: any) => {
      const key = (p.text ?? '').trim().toLowerCase();
      if (seen.has(key)) toRemove.push(p.id);
      else seen.add(key);
    });
    if (toRemove.length > 0) {
      dispatch('moveToTrash', toRemove);
    }
    const msg = `Удалено дублей: ${toRemove.length}`;
    addHistory(msg);
    notify(msg);
  }, [activePhrases, selectedGroup, isMultiGroup, notify, addHistory]);

  const handleRemoveEmpty = useCallback(() => {
    if (!selectedGroup && !isMultiGroup) return;
    const toRemove = activePhrases
      .filter((p: any) => p.text == null || p.text.trim().length === 0)
      .map((p: any) => p.id);
    if (toRemove.length > 0) {
      dispatch('moveToTrash', toRemove);
    }
    const msg = `Удалено пустых: ${toRemove.length}`;
    addHistory(msg);
    notify(msg);
  }, [activePhrases, selectedGroup, isMultiGroup, notify, addHistory]);

  // --- Filter handlers (adapt for multi-group) ---
  const handleFilter = useCallback((filterId: string) => {
    if (!selectedGroup && !isMultiGroup) return;
    const filter = filterRegistry.get(filterId);
    if (!filter) return;
    const matched = activePhrases.filter((p: any) => filter.check(p.text, p));
    if (!matched.length) {
      notify('Нет совпадений');
      return;
    }
    const groupName = isMultiGroup
      ? `Объединённая группа → ${filter.name}`
      : `${selectedGroup!.name} → ${filter.name}`;
    const existingIds = new Set(
      (useAppStore as any).getState().groups?.map((g: any) => g.id) ?? []
    );
    dispatch('addGroup', { name: groupName, parentId: null });
    const updatedGroups = (useAppStore as any).getState().groups ?? [];
    const newGroup = updatedGroups.find((g: any) => !existingIds.has(g.id));
    if (!newGroup) {
      notify('Ошибка: группа не создана');
      return;
    }
    if (filterMode === 'move') {
      dispatch('movePhrases', {
        ids: matched.map((p: any) => p.id),
        targetGroupId: newGroup.id,
      });
    } else {
      dispatch('addPhrases', {
        groupId: newGroup.id,
        texts: matched.map((p: any) => p.text),
      });
    }
    const msg = `Найдено: ${matched.length}`;
    addHistory(`${groupName}: ${msg}`);
    notify(msg);
  }, [activePhrases, selectedGroup, isMultiGroup, filterMode, notify, addHistory]);

  const handleLengthFilter = useCallback((type: 'more' | 'less') => {
    if (!selectedGroup && !isMultiGroup) return;
    if (!lengthN) return;
    const n = parseInt(lengthN, 10);
    if (isNaN(n) || n < 1) {
      notify('Введите корректное число');
      return;
    }
    const filter =
      type === 'more' ? createLengthMoreFilter(n) : createLengthLessFilter(n);
    const matched = activePhrases.filter((p: any) => filter.check(p.text, p));
    if (!matched.length) {
      notify('Нет совпадений');
      return;
    }
    const groupName = isMultiGroup
      ? `Объединённая группа → ${filter.name}`
      : `${selectedGroup!.name} → ${filter.name}`;
    const existingIds = new Set(
      (useAppStore as any).getState().groups?.map((g: any) => g.id) ?? []
    );
    dispatch('addGroup', { name: groupName, parentId: null });
    const updatedGroups = (useAppStore as any).getState().groups ?? [];
    const newGroup = updatedGroups.find((g: any) => !existingIds.has(g.id));
    if (!newGroup) {
      notify('Ошибка: группа не создана');
      return;
    }
    if (filterMode === 'move') {
      dispatch('movePhrases', {
        ids: matched.map((p: any) => p.id),
        targetGroupId: newGroup.id,
      });
    } else {
      dispatch('addPhrases', {
        groupId: newGroup.id,
        texts: matched.map((p: any) => p.text),
      });
    }
    const msg = `Найдено: ${matched.length}`;
    addHistory(`${groupName}: ${msg}`);
    notify(msg);
  }, [activePhrases, selectedGroup, isMultiGroup, lengthN, filterMode, notify, addHistory]);

  const handleFrequencyFilter = useCallback(() => {
    if (!selectedGroup && !isMultiGroup) return;
    if (!frequencyN) return;
    const n = parseInt(frequencyN, 10);
    if (isNaN(n) || n < 0) {
      notify('Введите корректное число');
      return;
    }
    const filter = createFrequencyMoreFilter(n);
    const matched = activePhrases.filter((p: any) => filter.check(p.text, p));
    if (!matched.length) {
      notify('Нет совпадений');
      return;
    }
    const groupName = isMultiGroup
      ? `Объединённая группа → ${filter.name}`
      : `${selectedGroup!.name} → ${filter.name}`;
    const existingIds = new Set(
      (useAppStore as any).getState().groups?.map((g: any) => g.id) ?? []
    );
    dispatch('addGroup', { name: groupName, parentId: null });
    const updatedGroups = (useAppStore as any).getState().groups ?? [];
    const newGroup = updatedGroups.find((g: any) => !existingIds.has(g.id));
    if (!newGroup) {
      notify('Ошибка: группа не создана');
      return;
    }
    if (filterMode === 'move') {
      dispatch('movePhrases', {
        ids: matched.map((p: any) => p.id),
        targetGroupId: newGroup.id,
      });
    } else {
      dispatch('addPhrases', {
        groupId: newGroup.id,
        texts: matched.map((p: any) => p.text),
      });
    }
    const msg = `Найдено: ${matched.length}`;
    addHistory(`${groupName}: ${msg}`);
    notify(msg);
  }, [activePhrases, selectedGroup, isMultiGroup, frequencyN, filterMode, notify, addHistory]);

  const handleSubstringFilter = useCallback(() => {
    if (!selectedGroup && !isMultiGroup) return;
    if (!substringQuery) return;
    const filter = createSubstringFilter(substringQuery);
    const matched = activePhrases.filter((p: any) => filter.check(p.text, p));
    if (!matched.length) {
      notify('Нет совпадений');
      return;
    }
    const groupName = isMultiGroup
      ? `Объединённая группа → ${filter.name}`
      : `${selectedGroup!.name} → ${filter.name}`;
    const existingIds = new Set(
      (useAppStore as any).getState().groups?.map((g: any) => g.id) ?? []
    );
    dispatch('addGroup', { name: groupName, parentId: null });
    const updatedGroups = (useAppStore as any).getState().groups ?? [];
    const newGroup = updatedGroups.find((g: any) => !existingIds.has(g.id));
    if (!newGroup) {
      notify('Ошибка: группа не создана');
      return;
    }
    if (filterMode === 'move') {
      dispatch('movePhrases', {
        ids: matched.map((p: any) => p.id),
        targetGroupId: newGroup.id,
      });
    } else {
      dispatch('addPhrases', {
        groupId: newGroup.id,
        texts: matched.map((p: any) => p.text),
      });
    }
    const msg = `Найдено: ${matched.length}`;
    addHistory(`${groupName}: ${msg}`);
    notify(msg);
  }, [activePhrases, selectedGroup, isMultiGroup, substringQuery, filterMode, notify, addHistory]);

  // Task 4: Clipboard copy
  const handleCopyToClipboard = useCallback(() => {
    const text = activePhrases.map((p: any) => p.text).join('\n');
    if (!text) {
      notify('Нет фраз для копирования');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      notify(`Скопировано фраз: ${activePhrases.length}`);
    }).catch(() => {
      notify('Не удалось скопировать');
    });
  }, [activePhrases, notify]);

  // --- Task 5: Assign handler refs (must be stable after all useCallback) ---
  useEffect(() => {
    handlerRefs.deduplicate = handleDeduplicate;
    handlerRefs.cleanChars  = handleCleanChars;
    handlerRefs.trim        = handleTrim;
    handlerRefs.lowercase   = handleLowercase;
    handlerRefs.removeEmpty = handleRemoveEmpty;
  }, [handleDeduplicate, handleCleanChars, handleTrim, handleLowercase, handleRemoveEmpty]);

  // --- Statistics ---
  const stats = useMemo(() => {
    if (!activePhrases.length) return null;
    const texts = activePhrases.map((p: any) => p.text);
    const lengths = texts.map((t: string) => t.length);
    const total = texts.length;
    const avgLength = lengths.reduce((a: number, b: number) => a + b, 0) / total;
    const minLength = Math.min(...lengths);
    const maxLength = Math.max(...lengths);

    const wordCounts = new Map<string, number>();
    const stopWords = new Set([
      'и', 'в', 'на', 'с', 'по', 'для', 'от', 'к', 'из', 'у',
      'за', 'о', 'об', 'а', 'но', 'да', 'не', 'ни', 'как', 'так',
      'что', 'это', 'или', 'то', 'до', 'во', 'со', 'при', 'про',
      'без', 'через', 'над', 'под', 'если', 'же', 'бы', 'ли', 'уже',
    ]);
    texts.forEach((t: string) => {
      t.toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .forEach((w: string) => {
          if (!stopWords.has(w) && w.length > 1) {
            wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
          }
        });
    });
    const topWords = [...wordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));

    return { total, avgLength, minLength, maxLength, topWords };
  }, [activePhrases]);

  // --- Section helpers ---
  const toggleSection = (key: string) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const moveSection = (key: string, direction: -1 | 1) => {
    setSectionOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const Chevron = ({ open }: { open: boolean }) => (
    <span className="inline-block w-3 text-xs select-none">
      {open ? '\u25BC' : '\u25B6'}
    </span>
  );

  const SectionHeader = ({
    label,
    sectionKey,
    defaultOpen,
  }: {
    label: string;
    sectionKey: string;
    defaultOpen?: boolean;
  }) => {
    const isOpen = sections[sectionKey] ?? defaultOpen ?? true;
    const orderIdx = sectionOrder.indexOf(sectionKey);
    const canMoveUp = orderIdx > 0;
    const canMoveDown = orderIdx < sectionOrder.length - 1;
    return (
      <div className="flex items-center gap-0.5 group">
        <button
          className="flex items-center gap-1 flex-1 text-xs font-semibold uppercase opacity-60 mb-1 px-1 py-0.5 hover:opacity-100 text-left"
          onClick={() => toggleSection(sectionKey)}
        >
          <Chevron open={isOpen} />
          {label}
        </button>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-40 transition-opacity mb-1">
          <button
            className="text-[10px] px-0.5 hover:opacity-100 disabled:opacity-20"
            disabled={!canMoveUp}
            onClick={() => moveSection(sectionKey, -1)}
            title="Вверх"
          >
            ▲
          </button>
          <button
            className="text-[10px] px-0.5 hover:opacity-100 disabled:opacity-20"
            disabled={!canMoveDown}
            onClick={() => moveSection(sectionKey, 1)}
            title="Вниз"
          >
            ▼
          </button>
        </div>
      </div>
    );
  };

  const SectionBody = ({
    sectionKey,
    children,
    defaultOpen,
  }: {
    sectionKey: string;
    children: any;
    defaultOpen?: boolean;
  }) => {
    const isOpen = sections[sectionKey] ?? defaultOpen ?? true;
    return isOpen ? <div className="space-y-1 pl-3">{children}</div> : null;
  };

  const FilterButton = ({
    filterId,
    name,
  }: {
    filterId: string;
    name: string;
  }) => {
    const count = filterPreviews[filterId] ?? 0;
    return (
      <button
        className="w-full text-xs px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40 flex justify-between items-center"
        disabled={!selectedGroup && !isMultiGroup}
        onClick={() => handleFilter(filterId)}
      >
        <span>{name}</span>
        <span className="text-[10px] ml-1 bg-white/20 text-white px-1.5 py-0 rounded">
          {count}
        </span>
      </button>
    );
  };

  // --- Section renderers ---
  const sectionRenderers: Record<string, () => React.ReactNode> = {
    cleanup: () => (
      <div>
        <SectionHeader label="Очистка" sectionKey="cleanup" />
        <SectionBody sectionKey="cleanup">
          <button
            className="w-full text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40"
            disabled={!selectedGroup && !isMultiGroup}
            onClick={handleDeduplicate}
          >
            Удалить дубли (в корзину)
          </button>
          <button
            className="w-full text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40"
            disabled={!selectedGroup && !isMultiGroup}
            onClick={handleRemoveEmpty}
          >
            Удалить пустые (в корзину)
          </button>
          <button
            className="w-full text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40"
            disabled={!selectedGroup && !isMultiGroup}
            onClick={handleCleanChars}
          >
            Удалить спецсимволы
          </button>
          <button
            className="w-full text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40"
            disabled={!selectedGroup && !isMultiGroup}
            onClick={handleTrim}
          >
            Обрезать пробелы
          </button>
          <button
            className="w-full text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40"
            disabled={!selectedGroup && !isMultiGroup}
            onClick={handleLowercase}
          >
            Нижний регистр
          </button>
        </SectionBody>
      </div>
    ),

    wordFilters: () => (
      <div>
        <SectionHeader label="Фильтры по словам" sectionKey="wordFilters" />
        <SectionBody sectionKey="wordFilters">
          {filterRegistry
            .getAll()
            .filter(
              (f) =>
                !f.id.startsWith('intent-') &&
                !f.id.startsWith('frequency-') &&
                !f.id.startsWith('substring-') &&
                !f.id.startsWith('length-')
            )
            .map((f) => (
              <FilterButton key={f.id} filterId={f.id} name={f.name} />
            ))}
        </SectionBody>
      </div>
    ),

    lengthFilters: () => (
      <div>
        <SectionHeader label="Фильтры по длине" sectionKey="lengthFilters" />
        <SectionBody sectionKey="lengthFilters">
          <div className="space-y-1">
            <input
              type="number"
              className="w-full text-sm rounded px-2 py-1"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              placeholder="N символов"
              value={lengthN}
              onChange={(e: any) => setLengthN(e.target.value)}
              min={1}
            />
            <div className="flex gap-1">
              <button
                className="flex-1 text-xs px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40"
                disabled={(!selectedGroup && !isMultiGroup) || !lengthN}
                onClick={() => handleLengthFilter('more')}
              >
                Больше N
              </button>
              <button
                className="flex-1 text-xs px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40"
                disabled={(!selectedGroup && !isMultiGroup) || !lengthN}
                onClick={() => handleLengthFilter('less')}
              >
                Меньше N
              </button>
            </div>
          </div>
        </SectionBody>
      </div>
    ),

    intentFilters: () => (
      <div>
        <SectionHeader label="Фильтры по интенту" sectionKey="intentFilters" />
        <SectionBody sectionKey="intentFilters">
          {filterRegistry
            .getAll()
            .filter((f) => f.id.startsWith('intent-'))
            .map((f) => (
              <FilterButton key={f.id} filterId={f.id} name={f.name} />
            ))}
        </SectionBody>
      </div>
    ),

    frequencyFilter: () => (
      <div>
        <SectionHeader label="Фильтр по частотности" sectionKey="frequencyFilter" />
        <SectionBody sectionKey="frequencyFilter">
          <div className="space-y-1">
            <input
              type="number"
              className="w-full text-sm rounded px-2 py-1"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              placeholder="Частота > N"
              value={frequencyN}
              onChange={(e: any) => setFrequencyN(e.target.value)}
              min={0}
            />
            {frequencyN && (
              <span className="text-xs opacity-50">
                Совпадений:{' '}
                {
                  activePhrases.filter((p: any) =>
                    createFrequencyMoreFilter(parseInt(frequencyN, 10) || 0).check(
                      p.text,
                      p
                    )
                  ).length
                }{' '}
                / {totalPhrases}
              </span>
            )}
            <button
              className="w-full text-xs px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40"
              disabled={(!selectedGroup && !isMultiGroup) || !frequencyN}
              onClick={handleFrequencyFilter}
            >
              Частота &gt; N
            </button>
          </div>
        </SectionBody>
      </div>
    ),

    substringFilter: () => (
      <div>
        <SectionHeader label="Поиск по подстроке" sectionKey="substringFilter" />
        <SectionBody sectionKey="substringFilter">
          <div className="space-y-1">
            <input
              type="text"
              className="w-full text-sm rounded px-2 py-1"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              placeholder="Введите слово или часть"
              value={substringQuery}
              onChange={(e: any) => setSubstringQuery(e.target.value)}
            />
            {substringQuery && (
              <span className="text-xs opacity-50">
                Совпадений:{' '}
                {
                  activePhrases.filter((p: any) =>
                    p.text.toLowerCase().includes(substringQuery.toLowerCase())
                  ).length
                }{' '}
                / {totalPhrases}
              </span>
            )}
            <button
              className="w-full text-xs px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40"
              disabled={(!selectedGroup && !isMultiGroup) || !substringQuery}
              onClick={handleSubstringFilter}
            >
              Найти
            </button>
          </div>
        </SectionBody>
      </div>
    ),

    stats: () => (
      <div>
        <SectionHeader label="Статистика" sectionKey="stats" defaultOpen={false} />
        <SectionBody sectionKey="stats" defaultOpen={false}>
          {stats ? (
            <div className="space-y-1 text-xs">
              <p>
                <span className="opacity-60">Всего фраз:</span>{' '}
                {stats.total}
              </p>
              <p>
                <span className="opacity-60">Средняя длина:</span>{' '}
                {stats.avgLength.toFixed(1)} симв.
              </p>
              <p>
                <span className="opacity-60">Мин / Макс длина:</span>{' '}
                {stats.minLength} / {stats.maxLength} симв.
              </p>
              <div>
                <span className="opacity-60">Топ-5 слов:</span>
                <ul className="list-disc list-inside mt-0.5">
                  {stats.topWords.map((w, i) => (
                    <li key={i}>
                      {w.word} — {w.count}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-xs opacity-40">Нет данных</p>
          )}
        </SectionBody>
      </div>
    ),

    history: () => (
      <div>
        <SectionHeader label="История" sectionKey="history" defaultOpen={false} />
        <SectionBody sectionKey="history" defaultOpen={false}>
          {historyLog.length === 0 ? (
            <p className="text-xs opacity-40">Нет операций</p>
          ) : (
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {historyLog.map((entry, i) => (
                <p key={i} className="text-[11px] opacity-60 leading-tight">
                  <span className="opacity-40">[{entry.time}]</span> {entry.msg}
                </p>
              ))}
            </div>
          )}
        </SectionBody>
      </div>
    ),
  };

  // --- Progress bar ---
  const ProgressBar = progress ? (
    <div className="w-full rounded h-2 overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
      <div
        className="h-full transition-all duration-200"
        style={{ width: `${(progress.current / progress.total) * 100}%`, background: 'var(--accent-blue)' }}
      />
    </div>
  ) : null;

  return (
    <div className="p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">SEO Multitool</h3>
        {/* Task 4: Clipboard */}
        <button
          className="text-xs px-2 py-0.5 rounded"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          onClick={handleCopyToClipboard}
          title="Копировать фразы в буфер"
        >
          📋
        </button>
      </div>

      {ProgressBar}

      {/* Group selector */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-xs opacity-70">Группа</label>
          <label className="flex items-center gap-1 text-xs opacity-50 ml-auto">
            <input
              type="checkbox"
              checked={multiMode}
              onChange={(e) => {
                setMultiMode(e.target.checked);
                if (!e.target.checked) setSelectedGroupIds([]);
              }}
            />
            Несколько
          </label>
        </div>

        {multiMode ? (
          <div className="space-y-1 max-h-48 overflow-y-auto rounded p-1.5"
            style={{ border: '1px solid var(--border)', background: 'var(--bg-base)' }}>
            <button
              className="text-xs px-2 py-0.5 rounded mb-1"
              style={{ background: 'var(--accent-blue)', color: '#fff' }}
              onClick={handleUseAppSelection}
            >
              Использовать выделение из приложения ({appSelectedGroupIds.length})
            </button>
            {groups?.map((g: any) => (
              <label
                key={g.id}
                className="flex items-center gap-1.5 text-xs px-1 py-0.5 hover:bg-gray-100 rounded cursor-pointer"
                style={{ color: 'var(--text-primary)' }}
              >
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(g.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedGroupIds((prev) => [...prev, g.id]);
                    } else {
                      setSelectedGroupIds((prev) => prev.filter((id) => id !== g.id));
                    }
                  }}
                />
                {g.name}
              </label>
            ))}
            {selectedGroupIds.length > 0 && (
              <p className="text-xs opacity-50 mt-1">
                Групп: {selectedGroupIds.length}, Фраз: {totalPhrases}
              </p>
            )}
          </div>
        ) : (
          <>
            <select
              className="w-full text-sm rounded px-2 py-1"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              <option value="">-- Выберите группу --</option>
              {groups?.map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {selectedGroup && (
              <p className="text-xs mt-1 opacity-50">
                Фраз: {totalPhrases}
              </p>
            )}
          </>
        )}
      </div>

      {/* Copy / Move toggle */}
      <div className="flex items-center gap-2 text-xs">
        <span className="opacity-60">Режим фильтра:</span>
        <button
          className={`px-2 py-0.5 rounded text-xs ${
            filterMode === 'copy' ? 'bg-blue-500 text-white' : ''
          }`}
          style={filterMode !== 'copy' ? { background: 'var(--bg-surface)', color: 'var(--text-secondary)' } : {}}
          onClick={() => setFilterMode('copy')}
        >
          Копировать
        </button>
        <button
          className={`px-2 py-0.5 rounded text-xs ${
            filterMode === 'move' ? 'bg-blue-500 text-white' : ''
          }`}
          style={filterMode !== 'move' ? { background: 'var(--bg-surface)', color: 'var(--text-secondary)' } : {}}
          onClick={() => setFilterMode('move')}
        >
          Переместить
        </button>
      </div>

      {/* Render sections in order */}
      {sectionOrder
        .filter((key) => sectionRenderers[key])
        .filter((key) => !(key === 'stats' && !showStats))
        .map((key) => (
          <div key={key}>
            {sectionRenderers[key]()}
          </div>
        ))}
    </div>
  );
}

// --- Task 2: Group Toolbar Button ---
export function GroupToolbarButton({ groupId }: { groupId?: string }) {
  const handleClick = () => {
    if (groupId) setSetting('selectedGroupId', groupId);
    dispatch('setLeftPanel', { open: true, module: 'seo-multitool' });
  };
  return (
    <button
      className="text-xs px-2 py-1 rounded"
      style={{ background: 'var(--accent-blue)', color: '#fff' }}
      onClick={handleClick}
      title="Open SEO Multitool"
    >
      Multitool
    </button>
  );
}
