import React from 'react';
import type { Phrase, KCID, ModuleUIContribution, PhraseActionContext } from '@/plugin-sdk';
import { useAppStore } from '@/plugin-sdk';
import { MIcon } from '@/shell/shared-icon';
import { LABEL_COLOR_MAP, LABEL_NAMES } from './shared';

function getCpcColor(cpc: number): string {
  if (cpc >= 5) return '#2E7D32';
  if (cpc >= 2) return '#F57F17';
  return '#C62828';
}

export function getCellClass(colKey: string): string {
  const base = 'py-0';
  if (colKey === 'text') return `${base} pl-2 pr-3 font-body`;
  if (colKey === 'notes') return `${base} px-2 cursor-pointer`;
  if (colKey === 'group') return `${base} px-2`;
  return `${base} px-3 text-right font-mono-data text-[var(--kc-text)]`;
}

export function getHeaderStyle(colKey: string, columnColors: Record<string, string>): React.CSSProperties {
  const color = columnColors[colKey];
  if (!color) return {};
  return { backgroundColor: `${color}20` };
}

export function getCellStyle(colKey: string, phrase: Phrase, columnColors: Record<string, string>): React.CSSProperties {
  const color = columnColors[colKey];
  const colorStyle = color ? { backgroundColor: `${color}15`, color } : {};
  if (colKey === 'cpc') return { ...colorStyle, color: getCpcColor(phrase.cpc ?? 0) };
  if (colKey === 'text') return { ...colorStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  return colorStyle;
}

export function renderKeyword(
  text: string,
  minusWordTexts: { exactTexts: Set<string>; broadTexts: Set<string> },
  handleWordClick: (word: string) => void,
): React.ReactNode {
  const words = text.split(/(\s+)/);
  return words.map((word, i) => {
    if (/^\s+$/.test(word)) return <span key={`${i}-${word}`}>{word}</span>;
    const isNegative = minusWordTexts.broadTexts.has(word.toLowerCase());
    return (
      <span
        key={`${i}-${word}`} data-word={word}
        className={`keyword-word ${isNegative ? 'is-negative' : ''}`}
        onClick={(e) => { e.stopPropagation(); handleWordClick(word); }}
        title={isNegative ? `Убрать «${word}» из минус-фраз` : `Добавить «${word}» в минус-фразы`}
      >
        {word}
      </span>
    );
  });
}

export interface CellRendererDeps {
  minusWordTexts: { exactTexts: Set<string>; broadTexts: Set<string> };
  handleWordClick: (word: string) => void;
  editingNotesId: KCID | null;
  editingNotesValue: string;
  setEditingNotesValue: (v: string) => void;
  commitNotesEdit: () => void;
  cancelNotesEdit: () => void;
  startNotesEdit: (id: KCID, notes: string) => void;
  getGroupName: (id: KCID) => string;
  getGroupColor: (id: KCID) => string | undefined;
  columnColors: Record<string, string>;
  phraseActions?: ModuleUIContribution[];
  phraseActionCtx?: PhraseActionContext;
}

export function renderCellValue(colKey: string, phrase: Phrase, deps: CellRendererDeps): React.ReactNode {
  if (!phrase) return null;
  const {
    minusWordTexts, handleWordClick,
    editingNotesId, editingNotesValue, setEditingNotesValue,
    commitNotesEdit, cancelNotesEdit, startNotesEdit,
    getGroupName, getGroupColor, columnColors,
    phraseActions, phraseActionCtx,
  } = deps;

  if (colKey === 'text') {
    return (
      <span className="inline-flex items-center gap-0.5 w-full min-w-0">
        <span className="flex-1 truncate">{renderKeyword(phrase.text, minusWordTexts, handleWordClick)}</span>
        {phrase.intent && (
          <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] leading-[14px] font-medium shrink-0 mr-0.5 ${
            phrase.intent === 'commercial' ? 'bg-orange-100 text-orange-700' :
            phrase.intent === 'informational' ? 'bg-blue-100 text-blue-700' :
            phrase.intent === 'transactional' ? 'bg-green-100 text-green-700' :
            'bg-purple-100 text-purple-700'
          }`}>
            {phrase.intent === 'commercial' ? 'Комм' :
             phrase.intent === 'informational' ? 'Инфо' :
             phrase.intent === 'transactional' ? 'Транз' : 'Нав'}
          </span>
        )}
        {phrase.tags && phrase.tags.filter(t => LABEL_COLOR_MAP[t]).length > 0 && (
          <span className="flex gap-0.5 shrink-0 mr-1">
            {phrase.tags.filter(t => LABEL_COLOR_MAP[t]).map(tag => (
              <span key={tag} className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] leading-[14px] font-medium"
                style={{ backgroundColor: `${LABEL_COLOR_MAP[tag]}20`, color: LABEL_COLOR_MAP[tag] }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: LABEL_COLOR_MAP[tag] }} />
                {LABEL_NAMES[tag] || tag}
              </span>
            ))}
          </span>
        )}
        {phrase.tags && phrase.tags.filter(t => !LABEL_COLOR_MAP[t]).length > 0 && (
          <span className="flex gap-0.5 shrink-0 mr-1">
            {phrase.tags.filter(t => !LABEL_COLOR_MAP[t]).map(tag => (
              <span key={tag} className="inline-flex items-center px-1 py-0 rounded text-[9px] leading-[14px] font-medium bg-[var(--kc-blue-light)] text-[var(--kc-blue)]">
                {tag}
              </span>
            ))}
          </span>
        )}
        {phrase.starredAt ? (
          <button key="star-filled" className="shrink-0 transition-opacity cursor-pointer flex items-center justify-center select-none p-0.5 rounded"
            style={{ color: '#f59e0b' }}
            onClick={e => { e.stopPropagation(); useAppStore.getState().togglePhraseStar(phrase.id); }}
            title="Убрать из избранного">
            <MIcon name="star" className="!text-[14px]" />
          </button>
        ) : (
          <button key="star-outline" className="shrink-0 opacity-40 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center select-none p-0.5 rounded"
            onClick={e => { e.stopPropagation(); useAppStore.getState().togglePhraseStar(phrase.id); }}
            title="В избранное">
            <MIcon name="star_outline" className="!text-[14px]" />
          </button>
        )}
        {(phraseActions ?? []).map(contrib => (
          <button key={contrib.moduleId ?? contrib.label} className="shrink-0 opacity-40 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center select-none p-0.5 rounded"
            style={{ color: 'var(--kc-blue)' }}
            onClick={e => { e.stopPropagation(); contrib.action?.(phrase, phraseActionCtx!); }}
            title={contrib.tooltip ?? contrib.label}>
            <MIcon name={contrib.icon ?? 'arrow_forward'} className="!text-[14px]" />
          </button>
        ))}
      </span>
    );
  }
  if (colKey === 'notes') {
    if (phrase.id === editingNotesId) {
      return (
        <input className="w-full h-full bg-[var(--bg-surface)] border border-[var(--accent-blue)] rounded-[2px] px-1 text-[11px] focus:outline-none"
          autoFocus value={editingNotesValue}
          onChange={e => setEditingNotesValue(e.target.value)}
          onBlur={commitNotesEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitNotesEdit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelNotesEdit(); }
          }}
          onClick={e => e.stopPropagation()}
        />
      );
    }
    return (
      <span className="text-[11px] text-[var(--text-secondary)] truncate block cursor-pointer" title={phrase.notes || ''}
        onDoubleClick={(e) => { e.stopPropagation(); startNotesEdit(phrase.id, phrase.notes || ''); }}>
        {phrase.notes ? (
          <span className="flex items-center gap-1">
            <MIcon name="notes" className="!text-[10px] text-[var(--text-disabled)] shrink-0" />
            <span className="truncate">{phrase.notes}</span>
          </span>
        ) : (
          <span className="text-[var(--text-disabled)]">—</span>
        )}
      </span>
    );
  }
  if (colKey === 'frequency') return phrase.frequency?.toLocaleString() ?? '—';
  if (colKey === 'kei') return phrase.kei ?? '—';
  if (colKey === 'cpc') return phrase.cpc != null ? phrase.cpc.toFixed(1) : '—';
  if (colKey === 'group') {
    const groupColor = getGroupColor(phrase.groupId);
    return (
      <span className="group-badge" style={{
        backgroundColor: groupColor ? `${groupColor}18` : 'var(--kc-surface-hover)',
        color: groupColor ?? 'var(--kc-text-secondary)',
      }}>
        {getGroupName(phrase.groupId)}
      </span>
    );
  }
  return null;
}

interface CellValueProps {
  colKey: string;
  phrase: Phrase;
  deps: CellRendererDeps;
}

export const CellValue = React.memo(function CellValue({ colKey, phrase, deps }: CellValueProps) {
  return <>{renderCellValue(colKey, phrase, deps)}</>;
});