// ============================================================
// Module: Find & Replace — UI Panel (Key Collector style)
// ============================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore, AppEvents, Button, Input, Checkbox, Label, useKCDialog } from 'plugin-sdk';
import type { PluginContext, Phrase } from 'plugin-sdk';


// ---- Icon helper ----

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export function FindReplacePanel({ ctx }: { ctx: PluginContext }) {
  const phrases = useAppStore(s => s.phrases);
  const activeGroupId = useAppStore(s => s.activeGroupId);
  const updatePhrase = useAppStore(s => s.updatePhrase);
  const updatePhraseNoUndo = useAppStore(s => s.updatePhraseNoUndo);
  const pushUndo = useAppStore(s => s.pushUndo);
  const kcDialog = useKCDialog();

  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [useRegex, setUseRegex] = useState(() => ctx.getSetting('useRegex') as boolean ?? false);
  const [caseSensitive, setCaseSensitive] = useState(() => ctx.getSetting('caseSensitive') as boolean ?? false);
  const [wholeWords, setWholeWords] = useState(false);
  const [preview, setPreview] = useState<{ id: string; from: string; to: string }[]>([]);
  const [scopeGroupOnly, setScopeGroupOnly] = useState(false);

  useEffect(() => {
    const sync = () => {
      setUseRegex(ctx.getSetting('useRegex') as boolean ?? false);
      setCaseSensitive(ctx.getSetting('caseSensitive') as boolean ?? false);
    };
    ctx.registerLifecycleHook?.('onSettingsChange', sync);
  }, [ctx]);

  const handleFind = () => {
    if (!findText) { setPreview([]); return; }

    const scopePhrases = scopeGroupOnly && activeGroupId
      ? phrases.filter(p => p.groupId === activeGroupId)
      : phrases;
    const results: { id: string; from: string; to: string }[] = [];

    let regex: RegExp;
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      let pattern = useRegex ? findText : findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (wholeWords) pattern = `\\b${pattern}\\b`;
      regex = new RegExp(pattern, flags);
    } catch {
      return;
    }

    for (const phrase of scopePhrases) {
      if (regex.test(phrase.text)) {
        regex.lastIndex = 0;
        const newText = phrase.text.replace(regex, replaceText);
        if (newText !== phrase.text) {
          results.push({ id: phrase.id, from: phrase.text, to: newText });
        }
      }
    }

    setPreview(results);
  };

  const handleReplaceAll = async () => {
    if (preview.length === 0) return;
    if (!await kcDialog.confirm(`Заменить в ${preview.length} фразах?`, { title: 'Замена', confirmLabel: 'Заменить' })) return;

    pushUndo();
    for (const item of preview) {
      updatePhraseNoUndo(item.id, { text: item.to });
    }

    ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
    setPreview([]);
  };

  return (
    <div className="h-full flex flex-col" style={{ maxWidth: '100%', width: '100%' }}>
        <div className="flex-1 overflow-y-auto compact-scroll p-3 space-y-3">
          <div>
            <Label className="text-[12px] font-medium">Найти</Label>
            <Input
              className="h-7 text-[12px] mt-1 border-[var(--kc-border)]"
              value={findText}
              onChange={e => setFindText(e.target.value)}
              placeholder="Текст или regex..."
            />
          </div>
          <div>
            <Label className="text-[12px] font-medium">Заменить на</Label>
            <Input
              className="h-7 text-[12px] mt-1 border-[var(--kc-border)]"
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
              placeholder="Новый текст..."
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-[11px]">
              <Checkbox checked={useRegex} onCheckedChange={v => setUseRegex(!!v)} />
              Regex
            </label>
            <label className="flex items-center gap-1.5 text-[11px]">
              <Checkbox checked={caseSensitive} onCheckedChange={v => setCaseSensitive(!!v)} />
              С учётом регистра
            </label>
            <label className="flex items-center gap-1.5 text-[11px]">
              <Checkbox checked={wholeWords} onCheckedChange={v => setWholeWords(!!v)} />
              Целые слова
            </label>
            <label className="flex items-center gap-1.5 text-[11px]">
              <Checkbox checked={scopeGroupOnly} onCheckedChange={v => setScopeGroupOnly(!!v)} disabled={!activeGroupId} />
              Только текущая группа
            </label>
          </div>

          {preview.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[12px] font-semibold">Найдено: {preview.length} совпадений</span>
              <div className="max-h-[200px] overflow-y-auto compact-scroll space-y-1">
                {preview.map(item => (
                  <div key={item.id} className="text-[11px] border border-[var(--kc-border)] rounded-[2px] p-1.5">
                    <span style={{ color: 'var(--kc-red)', textDecoration: 'line-through' }}>{item.from}</span>
                    <span className="mx-1 text-[var(--kc-text-secondary)]">→</span>
                    <span style={{ color: 'var(--kc-green)' }}>{item.to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      {/* Footer: pinned to bottom */}
      <div className="shrink-0 border-t border-[var(--kc-border-light)] p-3" style={{ background: 'var(--kc-bg, var(--kc-surface))' }}>
        <div className="flex gap-2">
          <Button onClick={handleFind} disabled={!findText} className="flex-1" size="sm"
            style={{ backgroundColor: 'var(--kc-blue)', color: 'white' }}
          >
            <MIcon name="search" className="!text-[14px] mr-1" /> Найти
          </Button>
          <Button onClick={handleReplaceAll} disabled={preview.length === 0} variant="default" size="sm" className="flex-1">
            Заменить все
          </Button>
        </div>
      </div>
    </div>
  );
}