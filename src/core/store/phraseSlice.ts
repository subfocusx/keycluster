// ╔══════════════════════════════════════════════════════════╗
// ║  @core — ЯДРО KEYCLUSTER                                 ║
// ║  Плагины НЕ ДОЛЖНЫ импортировать этот файл напрямую.    ║
// ╚══════════════════════════════════════════════════════════╝
import { v4 as uuid } from 'uuid';
import type { Phrase, Group, KCID } from '../types';
import { LogStore } from '../logging/LogStore';
import { pluralize } from '../i18n/plural';

type PhraseWithTrashMeta = Phrase & { _originalGroupId?: KCID };

/** Название группы по id — для человекочитаемых подписей в истории изменений. */
function groupName(groups: Group[], id: KCID | null | undefined): string {
  if (!id) return '';
  return groups.find((g) => g.id === id)?.name ?? '';
}

/** «Добавление 6 фраз в «Кластеры»»; без названия группы — «Добавление 6 фраз». */
function withGroup(text: string, name: string): string {
  return name ? `${text} в «${name}»` : text;
}

export interface PhraseSlice {
  phrases: Phrase[];
  phraseMap: Map<KCID, number>;
  addPhrases: (texts: string[], groupId: KCID, extra?: Partial<Phrase>[]) => void;
  deletePhrases: (ids: KCID[]) => void;
  moveToTrash: (ids: KCID[]) => void;
  restoreFromTrash: (ids: KCID[]) => void;
  clearTrash: () => void;
  movePhrases: (ids: KCID[], targetGroupId: KCID) => void;
  copyPhrases: (ids: KCID[], targetGroupId: KCID) => void;
  updatePhrase: (id: KCID, updates: Partial<Phrase>) => void;
  updatePhraseNoUndo: (id: KCID, updates: Partial<Phrase>) => void;
  setPhrases: (phrases: Phrase[]) => void;
  togglePhraseStar: (id: KCID) => void;
  addTagToPhrase: (id: KCID, tag: string) => void;
  removeTagFromPhrase: (id: KCID, tag: string) => void;
  setPhraseIntent: (id: KCID, intent: 'transactional' | 'commercial' | 'informational' | 'navigational') => void;
  clearPhraseIntent: (id: KCID) => void;
}

export function rebuildPhraseMap(draftPhrases: any[]): Map<KCID, number> {
  const map = new Map<KCID, number>();
  for (let i = 0; i < draftPhrases.length; i++) {
    map.set(draftPhrases[i].id, i);
  }
  return map;
}

export function createPhraseSlice(set: any, get: any) {
  return {
    phrases: [] as Phrase[],
    phraseMap: new Map<KCID, number>(),
    addPhrases: (texts: string[], groupId: KCID, extra?: Partial<Phrase>[]) => {
      const targetName = groupName(get().groups, groupId);
      get().pushUndo(withGroup(
        `Добавление ${pluralize(texts.length, 'фразы', 'фраз', 'фраз')}`,
        targetName,
      ));
      const newPhrases: Phrase[] = texts.map((text, i) => ({
        id: uuid(),
        text: text.trim(),
        groupId,
        ...(extra?.[i] ?? {}),
        createdAt: Date.now(),
      })) as Phrase[];
      set((draft: any) => {
        draft.phrases.push(...newPhrases);
        draft.phraseMap = rebuildPhraseMap(draft.phrases);
      });
      LogStore._log('info', 'phrases', `${texts.length} phrases added to group ${groupId}`, { count: texts.length, groupId });
    },
    deletePhrases: (ids: KCID[]) => {
      get().pushUndo(`Удаление ${pluralize(ids.length, 'фразы', 'фраз', 'фраз')}`);
      const idSet = new Set(ids);
      LogStore._log('info', 'phrases', `${ids.length} phrases deleted`, { count: ids.length });
      set((draft: any) => {
        draft.phrases = draft.phrases.filter((p: Phrase) => !idSet.has(p.id));
        draft.phraseMap = rebuildPhraseMap(draft.phrases);
        draft.selectedPhraseIds = new Set([...draft.selectedPhraseIds].filter((pid: KCID) => !idSet.has(pid)));
      });
    },
    moveToTrash: (ids: KCID[]) => {
      get().pushUndo(`Перемещение ${pluralize(ids.length, 'фразы', 'фраз', 'фраз')} в корзину`);
      const state = get();
      const existingTrash = state.groups.find((g: any) => g.isTrash);
      let trashGroupId: KCID;

      if (existingTrash) {
        trashGroupId = existingTrash.id;
      } else {
        trashGroupId = uuid();
      }

      const idSet = new Set(ids);
      LogStore._log('info', 'phrases', `${ids.length} phrases moved to trash`, { count: ids.length, trashGroupId });
      set((draft: any) => {
        if (!existingTrash) {
          draft.groups.push({
            id: trashGroupId,
            name: 'Корзина',
            parentId: null,
            isExpanded: true,
            isTrash: true,
            createdAt: Date.now(),
          });
        }
        for (const p of draft.phrases) {
          if (idSet.has(p.id)) {
            (p as PhraseWithTrashMeta)._originalGroupId = p.groupId;
            p.groupId = trashGroupId;
          }
        }
        draft.selectedPhraseIds = new Set([...draft.selectedPhraseIds].filter((pid: KCID) => !idSet.has(pid)));
      });
    },
    restoreFromTrash: (ids: KCID[]) => {
      get().pushUndo(`Восстановление ${pluralize(ids.length, 'фразы', 'фраз', 'фраз')} из корзины`);
      const idSet = new Set(ids);
      LogStore._log('info', 'phrases', `${ids.length} phrases restored from trash`, { count: ids.length });
      set((draft: any) => {
        for (const p of draft.phrases) {
          if (idSet.has(p.id)) {
            const originalGroupId = (p as PhraseWithTrashMeta)._originalGroupId;
            delete (p as PhraseWithTrashMeta)._originalGroupId;
            const originExists = originalGroupId &&
              draft.groups.find((g: any) => g.id === originalGroupId && !g.isTrash);
            if (originExists) {
              p.groupId = originalGroupId!;
            }
            // If the original group no longer exists, keep the phrase in its
            // current group (the trash) instead of relocating it to a fallback.
          }
        }
      });
    },
    clearTrash: () => {
      const state = get();
      const trashGroup = state.groups.find((g: any) => g.isTrash);
      if (!trashGroup) return;
      get().pushUndo('Очистка корзины');
      const trashGroupId = trashGroup.id;
      LogStore._log('info', 'phrases', 'Trash cleared');
      set((draft: any) => {
        draft.phrases = draft.phrases.filter((p: Phrase) => p.groupId !== trashGroupId);
        draft.phraseMap = rebuildPhraseMap(draft.phrases);
      });
    },
    movePhrases: (ids: KCID[], targetGroupId: KCID) => {
      const targetName = groupName(get().groups, targetGroupId);
      get().pushUndo(withGroup(
        `Перенос ${pluralize(ids.length, 'фразы', 'фраз', 'фраз')}`,
        targetName,
      ));
      const idSet = new Set(ids);
      LogStore._log('debug', 'phrases', `${ids.length} phrases moved to group ${targetGroupId}`, { count: ids.length, targetGroupId });
      set((draft: any) => {
        for (const p of draft.phrases) {
          if (idSet.has(p.id)) p.groupId = targetGroupId;
        }
      });
    },
    copyPhrases: (ids: KCID[], targetGroupId: KCID) => {
      const targetName = groupName(get().groups, targetGroupId);
      get().pushUndo(withGroup(
        `Копирование ${pluralize(ids.length, 'фразы', 'фраз', 'фраз')}`,
        targetName,
      ));
      const idSet = new Set(ids);
      const source = get().phrases.filter((p: Phrase) => idSet.has(p.id));
      const copies: Phrase[] = source.map((p: Phrase) => ({ ...p, id: uuid(), groupId: targetGroupId, createdAt: Date.now() }));
      set((draft: any) => {
        draft.phrases.push(...copies);
        draft.phraseMap = rebuildPhraseMap(draft.phrases);
      });
      LogStore._log('info', 'phrases', `${ids.length} phrases copied to group ${targetGroupId}`, { count: ids.length, targetGroupId });
    },
  updatePhrase: (id: KCID, updates: Partial<Phrase>) => {
    get().pushUndo('Редактирование фразы');
    set((draft: any) => {
      const idx = draft.phraseMap.get(id);
      if (idx !== undefined) {
        const p = draft.phrases[idx];
        if (p) Object.assign(p, updates);
      }
    });
    LogStore._log('debug', 'phrases', `Phrase ${id} updated`, { id, updates });
  },
  updatePhraseNoUndo: (id: KCID, updates: Partial<Phrase>) => {
    set((draft: any) => {
      const idx = draft.phraseMap.get(id);
      if (idx !== undefined) {
        const p = draft.phrases[idx];
        if (p) Object.assign(p, updates);
      }
    });
  },
    setPhrases: (phrases: Phrase[]) => {
      LogStore._log('info', 'phrases', `Phrases replaced: ${phrases.length} total`, { count: phrases.length });
      const phraseMap = new Map<KCID, number>();
      for (let i = 0; i < phrases.length; i++) phraseMap.set(phrases[i].id, i);
      set({ phrases, phraseMap });
    },
    togglePhraseStar: (id: KCID) => {
      const isStarred = !!get().phrases.find((p: Phrase) => p.id === id)?.starredAt;
      get().pushUndo(isStarred ? 'Удаление фразы из избранного' : 'Добавление фразы в избранное');
      set((draft: any) => {
        const idx = draft.phraseMap.get(id);
        if (idx !== undefined) {
          const p = draft.phrases[idx];
          if (p) {
            p.starredAt = p.starredAt ? undefined : Date.now();
          }
        }
      });
    },
    addTagToPhrase: (id: KCID, tag: string) => {
      get().pushUndo(`Добавление тега «${tag.trim()}»`);
      set((draft: any) => {
        const idx = draft.phraseMap.get(id);
        if (idx !== undefined) {
          const p = draft.phrases[idx];
          if (p) {
            if (!p.tags) p.tags = [];
            const lower = tag.trim().toLowerCase();
            if (!p.tags.includes(lower)) p.tags.push(lower);
          }
        }
      });
    },
    removeTagFromPhrase: (id: KCID, tag: string) => {
      get().pushUndo(`Удаление тега «${tag}»`);
      set((draft: any) => {
        const idx = draft.phraseMap.get(id);
        if (idx !== undefined) {
          const p = draft.phrases[idx];
          if (p && p.tags) {
            p.tags = p.tags.filter((t: string) => t !== tag);
          }
        }
      });
    },
    setPhraseIntent: (id: KCID, intent: 'transactional' | 'commercial' | 'informational' | 'navigational') => {
      get().pushUndo('Назначение типа поиска фразы');
      set((draft: any) => {
        const idx = draft.phraseMap.get(id);
        if (idx !== undefined) {
          const p = draft.phrases[idx];
          if (p) {
            p.intent = intent;
            p.tags = (p.tags ?? []).filter((t: string) =>
              t !== 'transactional' && t !== 'commercial' && t !== 'informational' && t !== 'navigational');
          }
        }
      });
    },
    clearPhraseIntent: (id: KCID) => {
      get().pushUndo('Сброс типа поиска фразы');
      set((draft: any) => {
        const idx = draft.phraseMap.get(id);
        if (idx !== undefined) {
          const p = draft.phrases[idx];
          if (p) {
            p.intent = undefined;
          }
        }
      });
    },
  };
}
