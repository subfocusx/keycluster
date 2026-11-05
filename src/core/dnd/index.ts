// ============================================================
// Core: Drag & Drop — публичные экспорты
// ============================================================

export {
  DND_MIME,
  applyGroupDrop,
  beginDrag,
  canAcceptGroupDrop,
  canDropGroupOnGroup,
  canDropPhraseOnGroup,
  cancelDrag,
  createDragImage,
  describePayload,
  endDrag,
  getDragPayload,
  getDropTargetId,
  isDragCancelled,
  isGroupDescendant,
  readPayload,
  setDragImageSafe,
  setDropTargetId,
  subscribeDrag,
  writePayload,
} from './groupDnd';

export type {
  DragPayload,
  GroupDragPayload,
  GroupDropActions,
  PhraseDragPayload,
} from './groupDnd';
