import type { MinusWordResult } from 'plugin-sdk';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Group } from 'plugin-sdk';
import { useAppStore , AppEvents} from 'plugin-sdk';
import type { PluginContext, MinusWord, MinusWordGroup, Phrase, KCID } from 'plugin-sdk';
import { Button, Input, Checkbox, useKCDialog, toast } from 'plugin-sdk';
import { suggestMinusWords } from 'plugin-sdk';
import { matchPhrases } from './minus-words-matcher';
import { scopedMinusWords } from './minus-words-scope';
import { MIcon } from './minus-word-row';
import { MinusWordsList } from './minus-words-list';
import { MinusWordsPreview } from './minus-words-preview';
import { MinusWordsSuggestModal } from './minus-words-suggest-modal';
import { MinusWordsImportDialog } from './minus-words-import-dialog';
import { minusWordsSettings } from './index';

function collectGroupIds(gid: KCID, groups: Group[]): Set<KCID> {
  const ids = new Set<KCID>();
  const walk = (id: KCID) => {
    ids.add(id);
    groups.filter(g => g.parentId === id).forEach(g => walk(g.id));
  };
  walk(gid);
  return ids;
}

export function MinusWordsPanel({ ctx }: { ctx: PluginContext }) {
  const minusWords = useAppStore(s => s.minusWords);
  const minusWordGroups = useAppStore(s => s.minusWordGroups);
  const addMinusWord = useAppStore(s => s.addMinusWord);
  const removeMinusWord = useAppStore(s => s.removeMinusWord);
  const setMinusWordMwGroup = useAppStore(s => s.setMinusWordMwGroup);
  const applyMinusWords = useAppStore(s => s.applyMinusWords);
  const previewMinusWords = useAppStore(s => s.previewMinusWords);
  const createMinusWordGroup = useAppStore(s => s.createMinusWordGroup);
  const renameMinusWordGroup = useAppStore(s => s.renameMinusWordGroup);
  const deleteMinusWordGroup = useAppStore(s => s.deleteMinusWordGroup);
  const groups = useAppStore(s => s.groups);
  const phrases = useAppStore(s => s.phrases);
  const activeGroupId = useAppStore(s => s.activeGroupId);
  const kcDialog = useKCDialog();

  const [newWord, setNewWord] = useState('');
  const [isExact, setIsExact] = useState(false);
  const [searchType, setSearchType] = useState<MinusWord['searchType']>(minusWordsSettings.broadMatch ? 'broad' : 'broad_modified');
  const [targetGroupId, setTargetGroupId] = useState<KCID | null>(activeGroupId);
  const [mwGroupId, setMwGroupId] = useState<MinusWordGroup['id'] | null>(null);
  const [showMatched, setShowMatched] = useState(false);
  const [applyResult, setApplyResult] = useState<{ removed: number; groups: KCID[] } | null>(null);
  const [previewData, setPreviewData] = useState<{ removed: number; phrases: Phrase[] } | null>(null);
  const [pendingRemoveIds, setPendingRemoveIds] = useState<Set<KCID>>(new Set());
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<{ words: string[]; duplicates: number; empty: number } | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<KCID | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestions, setSuggestions] = useState<{ results: MinusWordResult[]; loading: boolean }>({ results: [], loading: false });
  const [editingGroupName, setEditingGroupName] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<KCID>>(() => new Set(minusWordGroups.map(g => g.id)));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMwIds, setSelectedMwIds] = useState<Set<KCID>>(new Set());

  useEffect(() => {
    setTargetGroupId(activeGroupId);
  }, [activeGroupId]);

  const scopeGroupIds = useMemo(
    () => (targetGroupId ? collectGroupIds(targetGroupId, groups) : null),
    [targetGroupId, groups],
  );

  const scopeGroupName = useMemo(
    () => (targetGroupId ? (groups.find(g => g.id === targetGroupId)?.name ?? null) : null),
    [targetGroupId, groups],
  );

  const visibleMinusWords = useMemo(
    () => scopedMinusWords(minusWords, targetGroupId),
    [minusWords, targetGroupId],
  );

  const filteredMinusWords = useMemo(() => {
    if (!searchQuery.trim()) return visibleMinusWords;
    const q = searchQuery.trim().toLowerCase();
    return visibleMinusWords.filter(mw => mw.text.toLowerCase().includes(q));
  }, [visibleMinusWords, searchQuery]);

  const toggleMwSelection = (id: KCID) => {
    setSelectedMwIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleDeleteWord = (id: KCID) => {
    setSelectedMwIds(prev => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    removeMinusWord(id);
  };

  const handleBulkDelete = () => {
    for (const id of selectedMwIds) removeMinusWord(id);
    setSelectedMwIds(new Set());
  };

  const moveSelectedToGroup = (targetMwGroupId: KCID | null) => {
    for (const id of selectedMwIds) setMinusWordMwGroup(id, targetMwGroupId);
    setSelectedMwIds(new Set());
  };

  const allMwSelected = visibleMinusWords.length > 0 && selectedMwIds.size === visibleMinusWords.length;

  const toggleSelectAllMw = () => {
    if (allMwSelected) setSelectedMwIds(new Set());
    else setSelectedMwIds(new Set(visibleMinusWords.map(mw => mw.id)));
  };

  const copyMwGroupToClipboard = async (groupId: KCID | null) => {
    const items = visibleMinusWords.filter(mw => (mw.mwGroupId ?? null) === groupId);
    const text = items.map(mw => mw.text).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `Скопировано: ${items.length} минус-фраз`, duration: 2000 });
    } catch { /* ignored */ }
  };

  const handleAdd = () => {
    if (!newWord.trim()) return;
    addMinusWord(newWord.trim(), isExact, targetGroupId, searchType, mwGroupId);
    setNewWord('');
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    createMinusWordGroup(newGroupName.trim());
    setNewGroupName('');
    setShowNewGroupInput(false);
  };

  const handleRenameGroup = (id: KCID) => {
    if (!editingGroupName.trim()) return;
    renameMinusWordGroup(id, editingGroupName.trim());
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  const handleDeleteGroup = async (id: KCID) => {
    if (!await kcDialog.confirm('Удалить группу минус-фраз?', { title: 'Удалить группу', confirmLabel: 'Удалить', variant: 'destructive' })) return;
    deleteMinusWordGroup(id);
  };

  const groupedMinusWords = useMemo(() => {
    const groupsMap = new Map<KCID | null, MinusWord[]>();
    for (const mw of filteredMinusWords) {
      const key = mw.mwGroupId ?? '__nogroup__';
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(mw);
    }
    return groupsMap;
  }, [filteredMinusWords]);

  const [exportCopied, setExportCopied] = useState(false);

  const handleApply = () => {
    const preview = previewMinusWords(scopeGroupIds);
    setPreviewData(preview);
    setPendingRemoveIds(new Set());
  };

  const handleConfirmApply = () => {
    if (!previewData) return;
    setPreviewData(null);
    setPendingRemoveIds(new Set());
    const toRemove = previewData.phrases.filter(p => !pendingRemoveIds.has(p.id)).map(p => p.id);
    if (toRemove.length > 0) {
      ctx.store.dispatch('moveToTrash', toRemove);
      setApplyResult({ removed: toRemove.length, groups: [] });
      ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
      ctx.eventBus.emit(AppEvents.MINUS_WORDS_CHANGED);
      setTimeout(() => setApplyResult(null), 5000);
    }
  };

  const handleImportParse = useCallback((raw: string) => {
    const lines = raw.split('\n');
    const words: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/[,;\t]+/);
      for (const part of parts) {
        const w = part.trim().replace(/\s+/g, ' ');
        if (w) words.push(w);
      }
    }
    const existing = new Set(minusWords.map(mw => mw.text.toLowerCase()));
    const unique: string[] = [];
    let duplicates = 0;
    for (const w of words) {
      if (existing.has(w.toLowerCase())) duplicates++;
      else if (!unique.some(u => u.toLowerCase() === w.toLowerCase())) unique.push(w);
    }
    setImportPreview({ words: unique, duplicates, empty: words.length - unique.length - duplicates });
  }, [minusWords]);

  const handleImportConfirm = useCallback(() => {
    if (!importPreview || importPreview.words.length === 0) return;
    for (const w of importPreview.words) addMinusWord(w, isExact, targetGroupId, searchType, mwGroupId);
    setShowImportDialog(false);
    setImportText('');
    setImportPreview(null);
    toast({ title: `Импортировано: ${importPreview.words.length} минус-фраз`, duration: 2000 });
    ctx.eventBus.emit(AppEvents.MINUS_WORDS_CHANGED);
  }, [importPreview, addMinusWord, isExact, targetGroupId, searchType, mwGroupId, ctx.eventBus]);

  const handleImportTxt = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const path = await open({ filters: [{ name: 'Text Files', extensions: ['txt'] }], multiple: false });
      if (!path) return;
      const content = await readTextFile(path as string);
      setImportText(content);
      handleImportParse(content);
    } catch {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const content = await file.text();
        setImportText(content);
        handleImportParse(content);
      };
      input.click();
    }
  }, [handleImportParse]);

  const handleCopyClipboard = async () => {
    const text = visibleMinusWords.map(mw => mw.text).join(', ');
    try {
      await navigator.clipboard.writeText(text);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    }
  };

  const handleExportTxt = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const path = await save({ filters: [{ name: 'Text Files', extensions: ['txt'] }], defaultPath: 'minus-words.txt' });
      if (!path) return;
      await writeTextFile(path, visibleMinusWords.map(mw => mw.text).join('\n'));
    } catch {
      const blob = new Blob([visibleMinusWords.map(mw => mw.text).join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'minus-words.txt';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const matchedPhrases = useMemo(() => {
    if (!showMatched) return [];
    return matchPhrases(phrases, minusWords, scopeGroupIds);
  }, [showMatched, phrases, minusWords, scopeGroupIds]);

  const handleSuggest = useCallback(async () => {
    setSuggestions(prev => ({ ...prev, loading: true }));
    try {
      const results = suggestMinusWords(phrases, groups, { maxResults: 50 });
      setSuggestions({ results, loading: false });
      setShowSuggest(true);
    } catch {
      setSuggestions({ results: [], loading: false });
    }
  }, [phrases, groups]);

  const handleAddSuggestedWord = useCallback((word: string) => {
    addMinusWord(word, false, targetGroupId, 'broad_modified', null);
    toast({ title: `Добавлено: ${word}`, duration: 1500 });
  }, [addMinusWord, targetGroupId]);

  const handleAddAllSuggested = useCallback(() => {
    for (const r of suggestions.results) {
      const exists = minusWords.some(mw => mw.text.toLowerCase() === r.word.toLowerCase());
      if (!exists) addMinusWord(r.word, false, targetGroupId, 'broad_modified', null);
    }
    setShowSuggest(false);
    toast({ title: `Добавлено: ${suggestions.results.length} минус-слов`, duration: 2000 });
  }, [suggestions.results, addMinusWord, minusWords, targetGroupId]);

  return (
    <div className="h-full flex flex-col" style={{ maxWidth: '100%', width: '100%' }}>
      <div className="shrink-0 p-3 pb-2 space-y-2">
        <div className="flex gap-2">
          <Input className="h-7 text-[12px] border-[var(--kc-border)]" placeholder="Минус-фраза или слово..." value={newWord}
            onChange={e => setNewWord(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <Button size="sm" className="h-7 px-3" onClick={handleAdd} disabled={!newWord.trim()}
            style={{ backgroundColor: 'var(--kc-blue)', color: 'white' }}>
            <MIcon name="add" className="!text-[16px]" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px]">
            <Checkbox checked={isExact} onCheckedChange={v => setIsExact(!!v)} />
            Точная фраза
          </label>
          <select className="h-6 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 text-[11px]"
            value={searchType} onChange={e => setSearchType(e.target.value as MinusWord['searchType'])}>
            <option value="broad">Широкий поиск</option>
            <option value="broad_modified">По словам</option>
            <option value="exact">Точное совпадение</option>
          </select>
        </div>
        <select className="w-full h-6 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 text-[11px]"
          value={targetGroupId ?? 'global'} onChange={e => setTargetGroupId(e.target.value === 'global' ? null : e.target.value)}>
          <option value="global">Глобально (все группы)</option>
          {groups.filter(g => !g.isTrash).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div className="h-px bg-[var(--kc-border-light)] mx-3" />
      <div className="flex items-center gap-1 px-3 pt-2">
        {!showNewGroupInput ? (
          <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1 px-1" onClick={() => setShowNewGroupInput(true)}>
            <MIcon name="create_new_folder" className="!text-[12px]" /> Новая папка
          </Button>
        ) : (
          <div className="flex gap-1 items-center flex-1">
            <Input className="h-6 text-[11px] border-[var(--kc-border)] flex-1" placeholder="Название папки..."
              value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowNewGroupInput(false); }} autoFocus />
            <Button size="sm" className="h-6 px-2 text-[10px]" onClick={handleCreateGroup} disabled={!newGroupName.trim()}
              style={{ backgroundColor: 'var(--kc-blue)', color: 'white' }}>
              <MIcon name="check" className="!text-[12px]" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-1 text-[10px]"
              onClick={() => { setShowNewGroupInput(false); setNewGroupName(''); }}>
              <MIcon name="close" className="!text-[12px]" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
        <MIcon name={scopeGroupName ? 'filter_alt' : 'all_inbox'} className="!text-[13px] text-[var(--text-secondary)]" />
        <span className="text-[11px] text-[var(--text-secondary)] truncate">
          {scopeGroupName ? `Список: группа «${scopeGroupName}» + глобальные` : 'Список: все минус-фразы'}
        </span>
      </div>
      <MinusWordsList
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        minusWords={visibleMinusWords} filteredCount={filteredMinusWords.length} totalCount={visibleMinusWords.length}
        selectedMwIds={selectedMwIds} allSelected={allMwSelected}
        onToggleSelectAll={toggleSelectAllMw} moveSelectedToGroup={moveSelectedToGroup}
        minusWordGroups={minusWordGroups} handleBulkDelete={handleBulkDelete}
        showMatched={showMatched} onToggleMatched={() => setShowMatched(!showMatched)} matchedPhrases={matchedPhrases}
        groupedMinusWords={groupedMinusWords} minusWordGroupsList={minusWordGroups}
        expandedGroups={expandedGroups} onToggleGroup={(id) => setExpandedGroups(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
        editingGroupId={editingGroupId} editingGroupName={editingGroupName}
        onEditingGroupChange={(id, name) => { setEditingGroupId(id); setEditingGroupName(name); }}
        onRenameGroup={handleRenameGroup} onCopyGroup={copyMwGroupToClipboard} onDeleteGroup={handleDeleteGroup}
        onToggleMw={toggleMwSelection} onDeleteMw={handleDeleteWord} groups={groups}
      />
      {previewData ? (
        <MinusWordsPreview
          phrases={previewData.phrases} pendingRemoveIds={pendingRemoveIds}
          onToggleExclude={(id) => setPendingRemoveIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
          onCancel={() => { setPreviewData(null); setPendingRemoveIds(new Set()); }}
          onConfirm={handleConfirmApply}
        />
      ) : (
        <div className="shrink-0 border-t border-[var(--kc-border-light)] p-3 pt-2 space-y-2" style={{ background: 'var(--kc-bg, var(--kc-surface))' }}>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1 gap-1" onClick={() => setShowImportDialog(true)}>
              <MIcon name="file_upload" className="!text-[12px]" /> Импорт списка
            </Button>
            {minusWords.length > 0 && (
              <>
                <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1 gap-1" onClick={handleCopyClipboard}>
                  <MIcon name={exportCopied ? 'check' : 'content_copy'} className="!text-[12px]" />
                  {exportCopied ? 'Скопировано' : 'Копировать'}
                </Button>
                <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1 gap-1" onClick={handleExportTxt}>
                  <MIcon name="save_alt" className="!text-[12px]" /> Сохранить TXT
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button className="flex-1 h-7 text-[11px] rounded border border-[var(--kc-blue)] bg-transparent text-[var(--kc-blue)] hover:bg-[var(--kc-blue)] hover:text-white transition-colors flex items-center justify-center gap-1"
              onClick={handleSuggest} disabled={suggestions.loading}>
              <MIcon name="lightbulb" className="!text-[13px]" />
              {suggestions.loading ? 'Анализ...' : 'Подобрать минус-слова'}
            </button>
            <button className="w-[90px] h-7 bg-[var(--kc-red)] text-white text-[12px] rounded hover:opacity-90 flex items-center justify-center gap-1 disabled:opacity-40"
              onClick={handleApply} disabled={minusWords.length === 0}>
              <MIcon name="block" className="!text-[13px]" /> Применить
            </button>
          </div>
          {applyResult && (
            <div className="flex items-center gap-2 p-2 rounded-[3px] text-[12px]" style={{ backgroundColor: 'var(--kc-green-light)', color: 'var(--kc-green)' }}>
              <MIcon name="check_circle" className="!text-[16px]" />
              Перемещено в корзину: {applyResult.removed} фраз из {applyResult.groups.length} групп
            </div>
          )}
        </div>
      )}
      {showSuggest && suggestions.results.length > 0 && (
        <MinusWordsSuggestModal
          results={suggestions.results}
          isWordAdded={(word) => minusWords.some(mw => mw.text.toLowerCase() === word.toLowerCase())}
          onAddWord={handleAddSuggestedWord}
          onAddAll={handleAddAllSuggested}
          onClose={() => setShowSuggest(false)}
        />
      )}
      <MinusWordsImportDialog
        open={showImportDialog}
        text={importText}
        preview={importPreview}
        onOpenChange={(v) => { setShowImportDialog(v); if (!v) { setImportText(''); setImportPreview(null); } }}
        onTextChange={(t) => { setImportText(t); setImportPreview(null); }}
        onParse={() => handleImportParse(importText)}
        onImportTxt={handleImportTxt}
        onConfirm={handleImportConfirm}
      />
    </div>
  );
}