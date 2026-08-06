import type { PromptKey } from 'plugin-sdk';
import React, { useState, useCallback } from 'react';
import { useAIStore, promptManager } from 'plugin-sdk';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from 'plugin-sdk';

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const PROMPT_KEYS: Array<{ key: PromptKey; icon: string; label: string; helpText: string }> = [
  { key: 'rename', icon: 'edit', label: 'Переименование групп', helpText: 'Создает короткие PPC-названия групп (2-4 слова) на основе ключевых фраз' },
  { key: 'group-notes', icon: 'notes', label: 'Описания групп', helpText: 'Генерирует краткое описание тематики группы (1 предложение, до 15 слов)' },
];

function PromptSection() {
  const [expanded, setExpanded] = useState(false);
  const [editingKey, setEditingKey] = useState<PromptKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [presets, setPresets] = useState<string[]>(() => promptManager.listPresets());

  const refreshPresets = useCallback(() => setPresets(promptManager.listPresets()), []);

  const startEdit = (key: PromptKey) => {
    setEditingKey(key);
    setEditValue(promptManager.getTemplate(key));
    setValidationError(null);
  };

  const saveEdit = () => {
    if (!editingKey) return;
    const err = promptManager.validate(editingKey);
    if (err) { setValidationError(err); return; }
    promptManager.setTemplate(editingKey, editValue);
    setEditingKey(null);
    setEditValue('');
    setValidationError(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
    setValidationError(null);
  };

  const resetEdit = () => {
    if (!editingKey) return;
    promptManager.resetToDefault(editingKey);
    setEditValue(promptManager.getTemplate(editingKey));
  };

  const resetAllPrompts = () => {
    promptManager.resetAll();
    setEditingKey(null);
    setEditValue('');
    setValidationError(null);
    useAIStore.getState().addLog('info', '[AI] Все prompts сброшены на defaults');
  };

  const handleExport = () => {
    const json = promptManager.exportPrompts();
    navigator.clipboard.writeText(json);
    useAIStore.getState().addLog('info', '[AI] Prompts экспортированы в буфер обмена');
  };

  const handleImport = () => {
    const err = promptManager.importPrompts(importText);
    if (err) {
      setImportError(err);
    } else {
      setShowImportDialog(false);
      setImportText('');
      setImportError(null);
      useAIStore.getState().addLog('info', '[AI] Prompts импортированы');
    }
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    promptManager.savePreset(presetName.trim());
    setPresetName('');
    setShowPresetDialog(false);
    refreshPresets();
  };

  const handleLoadPreset = (name: string) => {
    promptManager.loadPreset(name);
    refreshPresets();
  };

  const handleDeletePreset = (name: string) => {
    promptManager.deletePreset(name);
    refreshPresets();
  };

  return (
    <div className="space-y-2">
      <button
        className="flex items-center gap-1.5 w-full text-left cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="material-symbols-outlined !text-[12px] text-[var(--text-secondary)] transition-transform duration-200" style={{ transform: expanded ? 'rotate(90deg)' : '' }}>
          chevron_right
        </span>
        <span className="font-label-caps text-[var(--text-secondary)]">Prompt Settings</span>
      </button>

      {expanded && (
        <div className="space-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            <button
              className="flex items-center gap-1 px-2 py-1 text-[9px] rounded-[3px] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              onClick={() => setShowPresetDialog(true)}
            >
              <MIcon name="save" className="!text-[10px]" /> Сохранить
            </button>
            <button
              className="flex items-center gap-1 px-2 py-1 text-[9px] rounded-[3px] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              onClick={handleExport}
            >
              <MIcon name="file_download" className="!text-[10px]" /> Экспорт
            </button>
            <button
              className="flex items-center gap-1 px-2 py-1 text-[9px] rounded-[3px] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              onClick={() => setShowImportDialog(true)}
            >
              <MIcon name="file_upload" className="!text-[10px]" /> Импорт
            </button>
            <button
              className="flex items-center gap-1 px-2 py-1 text-[9px] rounded-[3px] border border-[var(--accent-red)] text-[var(--accent-red)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              onClick={resetAllPrompts}
            >
              <MIcon name="restart_alt" className="!text-[10px]" /> Сброс
            </button>
            {presets.length > 0 && (
              <select
                className="flex-1 h-6 text-[9px] rounded-[3px] border border-[var(--border)] bg-[var(--bg-surface)] px-1 text-[var(--text)]"
                value=""
                onChange={e => { if (e.target.value) handleLoadPreset(e.target.value); e.target.value = ''; }}
              >
                <option value="">Загрузить...</option>
                {presets.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
          </div>

          {PROMPT_KEYS.map(({ key, icon, label, helpText }) => (
            <div key={key} className="border border-[var(--border)] rounded-[4px] overflow-hidden" title={helpText}>
              <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--bg-panel)]">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined !text-[12px] text-[var(--accent-blue)]">{icon}</span>
                  <span className="text-[10px] font-medium">{label}</span>
                </div>
                {editingKey !== key ? (
                  <button className="text-[9px] text-[var(--accent-blue)] hover:underline cursor-pointer" onClick={() => startEdit(key)}>Edit</button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button className="text-[9px] text-[var(--text-secondary)] hover:underline cursor-pointer" onClick={cancelEdit}>Cancel</button>
                    <button className="text-[9px] text-[var(--accent-blue)] hover:underline cursor-pointer" onClick={saveEdit}>Save</button>
                  </div>
                )}
              </div>
              {editingKey === key ? (
                <div className="p-2 space-y-1">
                  <textarea
                    className="w-full min-h-[80px] text-[9px] font-mono rounded-[3px] border border-[var(--border)] bg-[var(--bg-surface)] p-1.5 resize-vertical focus:outline-none focus:border-[var(--accent-blue)]"
                    value={editValue}
                    onChange={e => { setEditValue(e.target.value); setValidationError(null); }}
                    style={{ fontFamily: 'JetBrains Mono, Consolas, monospace', lineHeight: '1.4' }}
                  />
                  {validationError && (
                    <div className="text-[8px] text-[var(--accent-red)]">{validationError}</div>
                  )}
                  <div className="flex items-center justify-between">
                    <button className="text-[8px] text-[var(--text-secondary)] hover:underline cursor-pointer" onClick={resetEdit}>Сбросить</button>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-[var(--text-disabled)]">Vars: {promptManager.getVariables(key).join(', ')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-2 py-1">
                  <div className="text-[8px] text-[var(--text-disabled)] truncate font-mono">{promptManager.getTemplate(key).slice(0, 80).replace(/\n/g, '↵ ')}...</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showPresetDialog} onOpenChange={setShowPresetDialog}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle className="text-[13px]">Сохранить пресет</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setShowPresetDialog(false); }}
            placeholder="Название пресета..."
            className="h-7 text-[11px]"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowPresetDialog(false)}>Отмена</Button>
            <Button size="sm" disabled={!presetName.trim()} onClick={handleSavePreset}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-[13px]">Импорт prompts</DialogTitle>
          </DialogHeader>
          <textarea
            className="w-full min-h-[120px] text-[10px] font-mono rounded-[3px] border border-[var(--border)] bg-[var(--bg-surface)] p-2 resize-vertical focus:outline-none"
            value={importText}
            onChange={e => { setImportText(e.target.value); setImportError(null); }}
            placeholder="Вставьте JSON с prompts..."
          />
          {importError && (
            <div className="text-[10px] text-[var(--accent-red)]">{importError}</div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(false)}>Отмена</Button>
            <Button size="sm" disabled={!importText.trim()} onClick={handleImport}>Импорт</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { PromptSection };
