// ============================================================
// Core: Drag & Drop — перенос фраз в группы и групп между группами
// ============================================================
// Нативный HTML5 DnD (draggable / dragstart / dragover / dragleave / drop).
// Без внешних зависимостей.
//
// Модуль хранит единственный «активный перенос» в памяти:
//   — источник (строка таблицы или элемент дерева) кладёт payload в dataTransfer
//     и дополнительно регистрирует его здесь;
//   — цель (группа в дереве) читает payload, подсвечивается и по drop
//     вызывает store-экшен movePhrases / moveGroup.
//
// Регистрация payload в модуле нужна потому, что во время dragover браузер
// не отдаёт содержимое dataTransfer (доступны только типы) — иначе нельзя
// понять, фраза это или группа, и куда её вообще можно положить.
// ============================================================

import type { Group, KCID } from '../types';

/** MIME-тип для внутренней передачи payload между элементами. */
export const DND_MIME = 'application/x-keycluster-dnd';

/** Payload перетаскиваемой фразы (одной или нескольких). */
export interface PhraseDragPayload {
  kind: 'phrase';
  /** Переносимые фразы. */
  phraseIds: KCID[];
  /** Фраза, с которой начался перенос (источник dragstart). */
  sourceId: KCID;
  /** Подпись для drag-картинки. */
  label?: string;
}

/** Payload перетаскиваемой группы. */
export interface GroupDragPayload {
  kind: 'group';
  /** Переносимая группа. */
  groupId: KCID;
  /** Подпись для drag-картинки. */
  label?: string;
}

export type DragPayload = PhraseDragPayload | GroupDragPayload;

// ---- Состояние активного переноса ----

let currentPayload: DragPayload | null = null;
let currentDropTargetId: KCID | null = null;
let cancelled = false;

const listeners = new Set<() => void>();
let escapeListenerAttached = false;

function notify(): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      /* слушатель не должен ломать DnD */
    }
  }
}

/** Текущий payload переноса (null — переноса нет). */
export function getDragPayload(): DragPayload | null {
  return currentPayload;
}

/** true, если перенос был отменён (Esc) — drop не должен ничего делать. */
export function isDragCancelled(): boolean {
  return cancelled;
}

/** Id группы, которая сейчас подсвечена как drop-target. */
export function getDropTargetId(): KCID | null {
  return currentDropTargetId;
}

/** Подписка на изменения состояния переноса (для React useSyncExternalStore). */
export function subscribeDrag(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function onEscapeKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  if (!currentPayload) return;
  event.preventDefault();
  cancelDrag();
}

function attachEscapeListener(): void {
  if (escapeListenerAttached || typeof document === 'undefined') return;
  escapeListenerAttached = true;
  document.addEventListener('keydown', onEscapeKeyDown, true);
}

function detachEscapeListener(): void {
  if (!escapeListenerAttached || typeof document === 'undefined') return;
  escapeListenerAttached = false;
  document.removeEventListener('keydown', onEscapeKeyDown, true);
}

/** Начало переноса: регистрируем payload и подписку на Esc. */
export function beginDrag(payload: DragPayload): void {
  currentPayload = payload;
  currentDropTargetId = null;
  cancelled = false;
  attachEscapeListener();
  notify();
}

/** Перенос завершён (drop или drop вне цели). */
export function endDrag(): void {
  currentPayload = null;
  currentDropTargetId = null;
  cancelled = false;
  detachEscapeListener();
  notify();
}

/** Перенос отменён (Esc) — цель не примет drop. */
export function cancelDrag(): void {
  currentPayload = null;
  currentDropTargetId = null;
  cancelled = true;
  detachEscapeListener();
  notify();
}

/** Отметить группу как текущую drop-цель (null — снять подсветку). */
export function setDropTargetId(groupId: KCID | null): void {
  if (currentDropTargetId === groupId) return;
  currentDropTargetId = groupId;
  notify();
}

// ---- Работа с dataTransfer ----

/** Записать payload в dataTransfer (с запасным вариантом в text/plain). */
export function writePayload(dataTransfer: DataTransfer | null | undefined, payload: DragPayload): void {
  if (!dataTransfer) return;
  try {
    dataTransfer.setData(DND_MIME, JSON.stringify(payload));
    dataTransfer.setData('text/plain', describePayload(payload));
    dataTransfer.effectAllowed = 'move';
  } catch {
    /* dataTransfer может быть недоступен — перенос всё равно работает через модуль */
  }
}

/** Прочитать payload: сначала из состояния модуля, затем из dataTransfer. */
export function readPayload(dataTransfer: DataTransfer | null | undefined): DragPayload | null {
  if (currentPayload) return currentPayload;
  if (!dataTransfer) return null;
  try {
    const raw = dataTransfer.getData(DND_MIME);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DragPayload;
    return isDragPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isDragPayload(value: unknown): value is DragPayload {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === 'phrase') return Array.isArray((value as PhraseDragPayload).phraseIds);
  if (kind === 'group') return typeof (value as GroupDragPayload).groupId === 'string';
  return false;
}

/** Человекочитаемое описание переноса (для подсказок и drag-картинки). */
export function describePayload(payload: DragPayload): string {
  if (payload.kind === 'phrase') {
    const count = payload.phraseIds.length;
    if (count === 1) return `Перенос фразы «${payload.label ?? ''}»`;
    return `Перенос ${count} фраз`;
  }
  return `Перенос группы «${payload.label ?? ''}»`;
}

// ---- Правила валидности цели ----

/** Является ли candidateId потомком ancestorId. */
export function isGroupDescendant(groups: Group[], ancestorId: KCID, candidateId: KCID): boolean {
  const byId = new Map(groups.map(g => [g.id, g]));
  const seen = new Set<KCID>();
  let current = byId.get(candidateId);
  while (current && current.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.parentId === ancestorId) return true;
    current = byId.get(current.parentId);
  }
  return false;
}

/** Можно ли перенести группу sourceId внутрь группы targetId. */
export function canDropGroupOnGroup(groups: Group[], sourceId: KCID, targetId: KCID): boolean {
  if (sourceId === targetId) return false;
  const target = groups.find(g => g.id === targetId);
  if (!target || target.isTrash) return false;
  // Нельзя ронять группу в саму себя и в собственного потомка.
  if (isGroupDescendant(groups, sourceId, targetId)) return false;
  return true;
}

/** Можно ли положить фразу в группу targetId. */
export function canDropPhraseOnGroup(groups: Group[], targetId: KCID): boolean {
  const target = groups.find(g => g.id === targetId);
  if (!target || target.isTrash) return false;
  return true;
}

/** Можно ли принять текущий payload в группу targetId. */
export function canAcceptGroupDrop(groups: Group[], payload: DragPayload | null, targetId: KCID): boolean {
  if (!payload) return false;
  if (payload.kind === 'phrase') return canDropPhraseOnGroup(groups, targetId);
  return canDropGroupOnGroup(groups, payload.groupId, targetId);
}

// ---- Применение переноса ----

export interface GroupDropActions {
  movePhrases: (ids: KCID[], targetGroupId: KCID) => void;
  moveGroup: (id: KCID, newParentId: KCID | null) => void;
}

/**
 * Применить перенос в группу targetId.
 * Возвращает true, если перенос выполнен, false — если цель невалидна.
 */
export function applyGroupDrop(
  payload: DragPayload | null,
  targetGroupId: KCID,
  groups: Group[],
  actions: GroupDropActions,
): boolean {
  if (!payload) return false;
  if (!canAcceptGroupDrop(groups, payload, targetGroupId)) return false;

  if (payload.kind === 'phrase') {
    if (payload.phraseIds.length === 0) return false;
    actions.movePhrases(payload.phraseIds, targetGroupId);
    return true;
  }

  actions.moveGroup(payload.groupId, targetGroupId);
  return true;
}

// ---- Drag-картинка ----

/**
 * Создать «плашку» для drag-картинки. Элемент добавляется в body и удаляется
 * следующим тиком — браузер снимает картинку синхронно в setDragImage.
 */
export function createDragImage(label: string, kind: 'phrase' | 'group'): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  const el = document.createElement('div');
  el.setAttribute('data-kc-drag-image', 'true');
  el.textContent = kind === 'phrase' ? `Перенос: «${label}»` : `Группа: ${label}`;
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.zIndex = '-1';
  el.style.pointerEvents = 'none';
  el.style.padding = '2px 8px';
  el.style.borderRadius = '4px';
  el.style.fontSize = '12px';
  el.style.whiteSpace = 'nowrap';
  el.style.background = 'var(--kc-surface, #ffffff)';
  el.style.color = 'var(--text-primary, #111827)';
  el.style.border = '1px solid var(--kc-blue, #0066b8)';
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
  document.body.appendChild(el);
  setTimeout(() => { el.remove(); }, 0);
  return el;
}

/** Установить drag-картинку (в jsdom setDragImage может отсутствовать). */
export function setDragImageSafe(dataTransfer: DataTransfer | null | undefined, element: HTMLElement | null): void {
  if (!dataTransfer || !element) return;
  if (typeof dataTransfer.setDragImage !== 'function') return;
  try {
    dataTransfer.setDragImage(element, 12, 12);
  } catch {
    /* не критично */
  }
}
