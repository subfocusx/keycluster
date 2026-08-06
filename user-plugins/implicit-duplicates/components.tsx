// ============================================================
// Plugin: Implicit Duplicates — UI Panel
// ============================================================

import type { PluginContext } from 'plugin-sdk';
import React, { useState, useCallback, useMemo } from 'react';
import { useAppStore, Button, Badge, Checkbox, Label, Slider, ScrollArea, useKCDialog } from 'plugin-sdk';
import type { ImplicitDuplicateGroup, FindDuplicatesOptions } from './utils';
import { ImplicitDuplicatesWorkerBridge } from './worker-bridge';

let workerBridge: ImplicitDuplicatesWorkerBridge | null = null;

function getWorkerBridge(): ImplicitDuplicatesWorkerBridge {
  if (!workerBridge) {
    workerBridge = new ImplicitDuplicatesWorkerBridge();
  }
  return workerBridge;
}

export function terminateWorkerBridge() {
  if (workerBridge) {
    workerBridge.terminate();
    workerBridge = null;
  }
}

// ---- Icon helper ----

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

// ---- Группа дублей ----

function DuplicateGroupCard({
  group,
  selectedIds,
  onTogglePhrase,
  onToggleGroup,
  onKeepOnlyMain,
}: {
  group: ImplicitDuplicateGroup;
  selectedIds: Set<string>;
  onTogglePhrase: (id: string) => void;
  onToggleGroup: (ids: string[]) => void;
  onKeepOnlyMain: (mainId: string, duplicateIds: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const duplicateIds = group.phrases.filter(p => p.id !== group.mainPhrase.id).map(p => p.id);
  const allSelected = duplicateIds.length > 0 && duplicateIds.every(id => selectedIds.has(id));
  const someSelected = duplicateIds.some(id => selectedIds.has(id));

  return (
    <div className="border border-[var(--kc-border)] rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--kc-surface)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <MIcon
          name={expanded ? 'expand_less' : 'expand_more'}
          className="!text-[16px] text-[var(--kc-text-secondary)]"
        />
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-semibold text-[var(--kc-text)] truncate block">
            {group.mainPhrase.text}
          </span>
        </div>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 shrink-0">
          {group.phrases.length} фраз
        </Badge>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200 shrink-0">
          {Math.round(group.avgSimilarity * 100)}%
        </Badge>
        {/* Select all duplicates in group */}
        <div
          className="shrink-0"
          onClick={e => { e.stopPropagation(); onToggleGroup(duplicateIds); }}
          title={allSelected ? 'Снять выделение' : 'Выделить все дубли'}
        >
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={() => onToggleGroup(duplicateIds)}
          />
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-[var(--kc-border-light)]">
          {group.phrases.map(phrase => {
            const isMain = phrase.id === group.mainPhrase.id;
            const isSelected = selectedIds.has(phrase.id);

            return (
              <div
                key={phrase.id}
                className={`flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors ${
                  isMain
                    ? 'bg-green-50/50 text-[var(--kc-text)] font-medium'
                    : isSelected
                      ? 'bg-red-50/50 text-[var(--kc-text)]'
                      : 'text-[var(--kc-text-secondary)]'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  disabled={isMain}
                  onCheckedChange={() => !isMain && onTogglePhrase(phrase.id)}
                  className="scale-90"
                />
                <span className="flex-1 min-w-0 truncate">{phrase.text}</span>
                {phrase.frequency !== undefined && (
                  <span className="text-[10px] text-[var(--kc-text-disabled)] shrink-0">
                    freq: {phrase.frequency}
                  </span>
                )}
                {isMain && (
                  <Badge className="text-[8px] px-1 py-0 h-4 bg-green-100 text-green-700 border-green-200 shrink-0">
                    главная
                  </Badge>
                )}
              </div>
            );
          })}

          {/* Quick action: keep only main */}
          <div className="px-3 py-2 border-t border-[var(--kc-border-light)] flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2 text-red-600 hover:text-red-800"
              onClick={() => onKeepOnlyMain(group.mainPhrase.id, duplicateIds)}
            >
              <MIcon name="delete_sweep" className="!text-[12px] mr-1" />
              Удалить дубли в группе
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Panel ----

export function ImplicitDuplicatesPanel(_props?: { ctx?: PluginContext }) {
  const phrases = useAppStore(s => s.phrases);
  const moveToTrash = useAppStore(s => s.moveToTrash);
  const kcDialog = useKCDialog();
  const ctx = _props?.ctx;

  // Local UI state — read initial values from ctx or defaults
  const [threshold, setThreshold] = useState(ctx?.getSetting('threshold') as number ?? 80);
  const [ignoreStopWords, setIgnoreStopWords] = useState(ctx?.getSetting('ignoreStopWords') as boolean ?? true);
  const [compareWordOrder, setCompareWordOrder] = useState(ctx?.getSetting('compareWordOrder') as boolean ?? false);
  const [keepHigherFrequency, setKeepHigherFrequency] = useState(ctx?.getSetting('keepHigherFrequency') as boolean ?? true);
  const [groups, setGroups] = useState<ImplicitDuplicateGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTime, setSearchTime] = useState(0);

  // Активная группа (только не удалённые)
  const activePhrases = useMemo(() => {
    const trashGroup = useAppStore.getState().groups.find(g => g.isTrash);
    const trashId = trashGroup?.id;
    return phrases.filter(p => p.groupId !== trashId);
  }, [phrases]);

  // Поиск неявных дублей
  // Использует Web Worker для избежания блокировки UI
  const handleSearch = useCallback(() => {
    setIsSearching(true);
    setHasSearched(true);

    const startTime = performance.now();

    // Читаем свежее состояние напрямую из store
    const freshPhrases = useAppStore.getState().phrases;
    const trashGroup = useAppStore.getState().groups.find(g => g.isTrash);
    const trashId = trashGroup?.id;
    const freshActivePhrases = freshPhrases.filter(p => p.groupId !== trashId);

    const options: FindDuplicatesOptions = {
      threshold,
      ignoreStopWords,
      compareWordOrder,
      keepHigherFrequency,
    };

    const inputData = freshActivePhrases.map(p => ({
      id: p.id,
      text: p.text,
      frequency: p.frequency,
    }));

    const bridge = getWorkerBridge();

    bridge.findDuplicates(inputData, options, (percent) => {
      // Можно добавить индикатор прогресса при необходимости
    }).then((result) => {
      const elapsed = performance.now() - startTime;
      setGroups(result.groups);
      setSearchTime(elapsed);
      setIsSearching(false);
      setSelectedIds(new Set());
    }).catch((err) => {
      console.error('[ImplicitDuplicates] Worker error:', err);
      setIsSearching(false);
    });
  }, [threshold, ignoreStopWords, compareWordOrder, keepHigherFrequency]);

  // Выделение
  const togglePhrase = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const allSelected = ids.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  }, []);

  const selectAllDuplicates = useCallback(() => {
    const allDupIds = new Set<string>();
    groups.forEach(g => {
      g.phrases.forEach(p => {
        if (p.id !== g.mainPhrase.id) allDupIds.add(p.id);
      });
    });
    setSelectedIds(allDupIds);
  }, [groups]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Удалить выбранные
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await kcDialog.confirm(
      `Переместить ${selectedIds.size} фраз в корзину?`,
      { title: 'Удаление неявных дублей', confirmLabel: 'Удалить', variant: 'destructive' },
    );
    if (!confirmed) return;

    const idsToDelete = Array.from(selectedIds);
    moveToTrash(idsToDelete);
    setSelectedIds(new Set());
    // handleSearch читает свежие данные из store, поэтому повторный
    // поиск корректно увидит, что удалённые фразы уже в корзине.
    handleSearch();
  };

  // Удалить все дубли в группе (оставить только главную)
  const handleKeepOnlyMain = async (mainId: string, duplicateIds: string[]) => {
    const confirmed = await kcDialog.confirm(
      `Удалить ${duplicateIds.length} дублей, оставив главную фразу?`,
      { title: 'Удаление дублей', confirmLabel: 'Удалить', variant: 'destructive' },
    );
    if (!confirmed) return;

    moveToTrash(duplicateIds);
    // Очищаем результаты и запускаем повторный поиск с актуальными данными
    setGroups([]);
    setSelectedIds(new Set());
    handleSearch();
  };

  // Статистика
  const totalDuplicates = groups.reduce((sum, g) => sum + g.phrases.length - 1, 0);
  const totalPhrasesCount = activePhrases.length;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ maxWidth: '100%', width: '100%' }}>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {/* Заголовок */}
          <div className="flex items-center gap-1.5">
            <MIcon name="content_copy" className="!text-[16px] text-[var(--kc-blue)]" />
            <span className="text-[13px] font-semibold text-[var(--kc-text)]">Неявные дубликаты</span>
          </div>

          {/* Настройки */}
          <div className="space-y-2">
            <div>
              <Label className="text-[11px] font-medium">Порог схожести: {threshold}%</Label>
              <Slider
                min={30}
                max={100}
                step={5}
                value={[threshold]}
                onValueChange={v => setThreshold(v[0])}
                className="mt-2"
              />
              <div className="flex justify-between text-[9px] text-[var(--kc-text-disabled)] mt-1">
                <span>30% (больше дублей)</span>
                <span>100% (точное совпадение)</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                <Checkbox checked={ignoreStopWords} onCheckedChange={v => setIgnoreStopWords(!!v)} />
                Игнорировать стоп-слова
              </label>
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                <Checkbox checked={compareWordOrder} onCheckedChange={v => setCompareWordOrder(!!v)} />
                Учитывать порядок слов
              </label>
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                <Checkbox checked={keepHigherFrequency} onCheckedChange={v => setKeepHigherFrequency(!!v)} />
                Оставлять с большей частотностью
              </label>
            </div>
          </div>

          {/* Результаты */}
          {hasSearched && !isSearching && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-[var(--kc-text-secondary)]">
                  Найдено <span className="font-semibold text-[var(--kc-text)]">{groups.length}</span> групп,
                  {' '}<span className="font-semibold text-[var(--kc-text)]">{totalDuplicates}</span> дублей
                  {' '}(из {totalPhrasesCount} фраз)
                </div>
                <div className="text-[10px] text-[var(--kc-text-disabled)]">
                  {searchTime < 1000 ? `${searchTime.toFixed(0)}мс` : `${(searchTime / 1000).toFixed(1)}с`}
                </div>
              </div>

              {groups.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={selectAllDuplicates}
                  >
                    Выделить все дубли
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={clearSelection}
                    disabled={selectedIds.size === 0}
                  >
                    Снять выделение
                  </Button>
                </div>
              )}

              {/* Список групп */}
              {groups.length === 0 ? (
                <div className="text-center py-6 text-[12px] text-[var(--kc-text-disabled)]">
                  <MIcon name="check_circle" className="!text-[32px] text-green-400 mb-2 block mx-auto" />
                  Неявные дубли не найдены
                </div>
              ) : (
                <div className="space-y-2">
                  {groups.map(group => (
                    <DuplicateGroupCard
                      key={group.groupId}
                      group={group}
                      selectedIds={selectedIds}
                      onTogglePhrase={togglePhrase}
                      onToggleGroup={toggleGroup}
                      onKeepOnlyMain={handleKeepOnlyMain}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Пустое состояние до поиска */}
          {!hasSearched && (
            <div className="text-center py-6 text-[12px] text-[var(--kc-text-disabled)]">
              <MIcon name="search" className="!text-[32px] text-[var(--kc-text-disabled)] mb-2 block mx-auto" />
              Настройте параметры и нажмите «Найти дубли»
            </div>
          )}

          {/* Индикатор загрузки */}
          {isSearching && (
            <div className="text-center py-6">
              <MIcon name="progress_activity" className="!text-[24px] text-[var(--kc-blue)] animate-spin block mx-auto mb-2" />
              <span className="text-[12px] text-[var(--kc-text-secondary)]">
                Поиск дублей... ({totalPhrasesCount} фраз)
              </span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Sticky footer */}
      <div className="shrink-0 border-t border-[var(--kc-border-light)] p-3"
        style={{ background: 'var(--kc-bg, var(--kc-surface))' }}
      >
        <div className="flex gap-2">
          <Button
            onClick={handleSearch}
            disabled={isSearching || activePhrases.length === 0}
            className="flex-1"
            size="sm"
            style={{ backgroundColor: 'var(--kc-blue)', color: 'white' }}
          >
            <MIcon name="search" className="!text-[14px] mr-1" />
            Найти дубли
          </Button>
          <Button
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            variant="destructive"
            size="sm"
            className="flex-1"
          >
            <MIcon name="delete_sweep" className="!text-[14px] mr-1" />
            Удалить ({selectedIds.size})
          </Button>
        </div>
      </div>
    </div>
  );
}
