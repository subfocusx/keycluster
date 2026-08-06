import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { KCID } from '@/plugin-sdk';
import { CHECKBOX_COL, type ColDef } from '../shared';

export function usePhraseColumns(params: {
  columnVisibility: Record<string, boolean>;
  columnLabels: Record<string, string>;
  columnColors: Record<string, string>;
  activeGroupId: KCID | null;
  multigroupMode: boolean;
  autoResizeTrigger: number;
  containerWidth: number;
}) {
  const { columnVisibility, columnLabels, activeGroupId, multigroupMode, autoResizeTrigger, containerWidth } = params;

  // Column definitions
  const baseCols: ColDef[] = [
    { key: 'text', label: columnLabels['text'] ?? 'Ключевая фраза', width: 340, minWidth: 100, maxWidth: 2000, align: 'left', sortable: true, visible: true },
    { key: 'notes', label: columnLabels['notes'] ?? 'Заметки', width: 120, minWidth: 60, maxWidth: 400, align: 'left', sortable: false, visible: false },
    { key: 'frequency', label: columnLabels['frequency'] ?? 'Частота', width: 100, minWidth: 70, maxWidth: 300, align: 'right', sortable: true, visible: true },
    { key: 'kei', label: columnLabels['kei'] ?? 'KEI', width: 80, minWidth: 55, maxWidth: 150, align: 'right', sortable: true, visible: true },
    { key: 'cpc', label: columnLabels['cpc'] ?? 'CPC', width: 90, minWidth: 55, maxWidth: 150, align: 'right', sortable: true, visible: true },
    { key: 'group', label: columnLabels['group'] ?? 'Группа', width: 140, minWidth: 80, maxWidth: 400, align: 'left', sortable: false, visible: true },
  ];

  const defaultCols: ColDef[] = baseCols.map(c => ({
    ...c,
    visible: c.key === 'group' ? (columnVisibility['group'] !== false && !activeGroupId) : (columnVisibility[c.key] !== false),
  }));

  const [colDefs, setColDefs] = useState<ColDef[]>(defaultCols);
  const colDefsRef = useRef(colDefs);
  colDefsRef.current = colDefs;
  const initialSized = useRef(false);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  // Sync colDefs when columnVisibility or columnLabels change from store
  useEffect(() => {
    setColDefs(prev =>
      defaultCols.map(bc => {
        const existing = prev.find(c => c.key === bc.key);
        return { ...bc, width: existing?.width ?? bc.width };
      })
    );
  }, [columnVisibility, columnLabels, params.columnColors, activeGroupId, multigroupMode]);

  // Visible columns
  const visibleCols = useMemo(() => colDefs.filter(c => c.visible), [colDefs]);

  // On first container width measurement, set text column to fill remaining space
  useEffect(() => {
    if (containerWidth > 0 && !initialSized.current) {
      initialSized.current = true;
      const dataColsTotalWidth = defaultCols
        .filter(c => c.visible && c.key !== 'text' && (c.key !== 'group' || !activeGroupId))
        .reduce((sum, c) => sum + c.width, 0);
      const remainingForText = containerWidth - CHECKBOX_COL - dataColsTotalWidth;
      const textWidth = Math.max(defaultCols.find(c => c.key === 'text')!.minWidth, remainingForText);
      setColDefs(prev => prev.map(c => c.key === 'text' ? { ...c, width: textWidth } : c));
    }
  }, [containerWidth, activeGroupId]);

  // Cleanup document listeners on unmount (P8: prevent leak during drag)
  useEffect(() => {
    return () => {
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
        resizeCleanupRef.current = null;
      }
    };
  }, []);

  // Auto-resize columns to fit container width when trigger changes
  useEffect(() => {
    if (autoResizeTrigger === 0 || containerWidth === 0) return;

    const visibleDefaults = defaultCols.filter(c => c.visible && (c.key !== 'group' || !activeGroupId));
    if (visibleDefaults.length === 0) return;

    const availableWidth = containerWidth - CHECKBOX_COL;
    const totalDefaultWidth = visibleDefaults.reduce((sum, c) => sum + c.width, 0);
    const scaleFactor = availableWidth / totalDefaultWidth;

    const newWidths = visibleDefaults.map(c => {
      const scaled = Math.round(c.width * scaleFactor);
      return Math.max(c.minWidth, Math.min(c.maxWidth, scaled));
    });

    let totalNew = newWidths.reduce((s, w) => s + w, 0);
    if (totalNew > availableWidth) {
      const excess = totalNew - availableWidth;
      const shrinkable = newWidths.map((w, i) => ({
        index: i,
        room: w - visibleDefaults[i].minWidth,
      })).filter(x => x.room > 0);
      const totalRoom = shrinkable.reduce((s, x) => s + x.room, 0);
      if (totalRoom > 0) {
        for (const item of shrinkable) {
          const shrink = Math.round(excess * (item.room / totalRoom));
          newWidths[item.index] = Math.max(visibleDefaults[item.index].minWidth, newWidths[item.index] - shrink);
        }
      }
    } else if (totalNew < availableWidth) {
      const leftover = availableWidth - totalNew;
      const textIdx = visibleDefaults.findIndex(c => c.key === 'text');
      if (textIdx >= 0) {
        newWidths[textIdx] = Math.min(visibleDefaults[textIdx].maxWidth, newWidths[textIdx] + leftover);
      }
    }

    setColDefs(prev => prev.map(c => {
      const visIdx = visibleDefaults.findIndex(vc => vc.key === c.key);
      if (visIdx >= 0) return { ...c, width: newWidths[visIdx] };
      return c;
    }));
  }, [autoResizeTrigger, containerWidth, activeGroupId]);

  // Total table width
  const tableWidth = useMemo(() => {
    return CHECKBOX_COL + visibleCols.reduce((sum, c) => sum + c.width, 0);
  }, [visibleCols]);

  // Column resize handler
  const handleColResize = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const currentCols = colDefsRef.current;
    const leftCol = visibleCols[colIdx];
    if (!leftCol) {
      console.warn('[PhrasesTable] Resize: no column at index', colIdx);
      return;
    }
    const leftStartWidth = leftCol.width;
    const rightCol = colIdx < visibleCols.length - 1 ? visibleCols[colIdx + 1] : null;
    const rightStartWidth = rightCol?.width ?? 0;
    const isLastColumn = rightCol === null;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newLeftWidth = Math.max(leftCol.minWidth, Math.min(leftCol.maxWidth, leftStartWidth + delta));
      const actualDelta = newLeftWidth - leftStartWidth;

      if (isLastColumn) {
        setColDefs(prev => prev.map(c => c.key === leftCol.key ? { ...c, width: newLeftWidth } : c));
      } else if (rightCol) {
        const newRightWidth = Math.max(rightCol.minWidth, Math.min(rightCol.maxWidth, rightStartWidth - actualDelta));
        const effectiveDelta = rightStartWidth - newRightWidth;
        const finalLeftWidth = leftStartWidth + effectiveDelta;

        setColDefs(prev => prev.map(c => {
          if (c.key === leftCol.key) return { ...c, width: finalLeftWidth };
          if (c.key === rightCol.key) return { ...c, width: newRightWidth };
          return c;
        }));
      }
    };

    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      resizeCleanupRef.current = null;
    };

    resizeCleanupRef.current = onUp;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [visibleCols]);

  // Cell styles
  const getCellStyle = useCallback((colKey: string, columnColors: Record<string, string>, phrase: any): React.CSSProperties => {
    const color = columnColors[colKey];
    const colorStyle = color ? { backgroundColor: `${color}15`, color } : {};
    if (colKey === 'cpc') {
      const cpc = phrase.cpc;
      const cpcColor = cpc == null ? 'var(--kc-text-secondary)' : cpc >= 5 ? '#2E7D32' : cpc >= 2 ? '#F57F17' : '#C62828';
      return { ...colorStyle, color: cpcColor };
    }
    if (colKey === 'text') {
      return { ...colorStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
    }
    return colorStyle;
  }, []);

  const getHeaderStyle = useCallback((colKey: string, columnColors: Record<string, string>): React.CSSProperties => {
    const color = columnColors[colKey];
    if (!color) return {};
    return { backgroundColor: `${color}20` };
  }, []);

  const getCellClass = useCallback((colKey: string): string => {
    const base = 'py-0';
    if (colKey === 'text') return `${base} pl-2 pr-3 font-body`;
    if (colKey === 'notes') return `${base} px-2 cursor-pointer`;
    if (colKey === 'group') return `${base} px-2`;
    return `${base} px-3 text-right font-mono-data text-[var(--kc-text)]`;
  }, []);

  return {
    baseCols,
    colDefs, setColDefs,
    visibleCols,
    tableWidth,
    handleColResize,
    getCellStyle,
    getHeaderStyle,
    getCellClass,
  };
}