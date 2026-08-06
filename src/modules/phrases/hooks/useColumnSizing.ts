'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '@/plugin-sdk';
import type { KCID } from '@/plugin-sdk';
import type { ColDef } from '../shared';
import { CHECKBOX_COL } from '../shared';

const LOG_PREFIX = '[ColumnSizing]';

function log(...args: unknown[]) {
  if (typeof console !== 'undefined') console.log(LOG_PREFIX, ...args);
}

export function useColumnSizing(_baseCols: ColDef[], defaultCols: ColDef[], containerWidth: number, activeGroupId: KCID | null) {
  const [colDefs, setColDefs] = useState<ColDef[]>(() => defaultCols);
  const latestColDefsRef = useRef(colDefs);
  latestColDefsRef.current = colDefs;

  const autoResizeTrigger = useAppStore(s => s.ui.columnAutoResizeTrigger);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setColDefs(prev => {
      const merged = prev.map(p => {
        const d = defaultCols.find(dc => dc.key === p.key);
        if (!d) return p;
        if (
          p.visible !== d.visible ||
          p.label !== d.label ||
          p.minWidth !== d.minWidth ||
          p.maxWidth !== d.maxWidth ||
          p.align !== d.align ||
          p.sortable !== d.sortable
        ) {
          return { ...d, width: p.width };
        }
        return p;
      });
      for (const d of defaultCols) {
        if (!merged.some(m => m.key === d.key)) {
          merged.push(d);
        }
      }
      const filtered = merged.filter(m => defaultCols.some(d => d.key === m.key));
      return filtered;
    });
  }, [defaultCols]);

  useEffect(() => {
    return () => {
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
        resizeCleanupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (containerWidth <= 0) return;
    setColDefs(prev => {
      const dataColsTotalWidth = prev
        .filter(c => c.visible && c.key !== 'text' && c.key !== 'group')
        .reduce((sum, c) => sum + c.width, 0);
      const remainingForText = containerWidth - CHECKBOX_COL - dataColsTotalWidth;
      const textDef = prev.find(c => c.key === 'text');
      if (!textDef) return prev;
      const textWidth = Math.max(textDef.minWidth, Math.min(textDef.maxWidth, remainingForText));
      if (textDef.width === textWidth && remainingForText >= textDef.minWidth) return prev;
      log(`[reflow] containerWidth=${containerWidth} dataColsTotal=${dataColsTotalWidth} remainingForText=${remainingForText} textDef.width=${textDef.width} → textWidth=${textWidth} (clamped ${textDef.minWidth}..${textDef.maxWidth})`);
      return prev.map(c => c.key === 'text' ? { ...c, width: textWidth } : c);
    });
  }, [containerWidth, activeGroupId]);

  useEffect(() => {
    if (autoResizeTrigger === 0 || containerWidth === 0) {
      log(`[autoResize] skipped trigger=${autoResizeTrigger} width=${containerWidth}`);
      return;
    }

    setColDefs(prev => {
      const currentCols = prev;
      const visible = currentCols.filter(c => c.visible && (c.key !== 'group' || !activeGroupId));
      if (visible.length === 0) {
        log(`[autoResize] no visible columns, skipped`);
        return prev;
      }

      const availableWidth = containerWidth - CHECKBOX_COL;
      const totalCurrentWidth = visible.reduce((sum, c) => sum + c.width, 0);
      if (totalCurrentWidth === 0) return prev;

      const scaleFactor = availableWidth / totalCurrentWidth;
      log(`[autoResize] trigger#${autoResizeTrigger} available=${availableWidth} totalCurrent=${totalCurrentWidth} scaleFactor=${scaleFactor.toFixed(4)}`);

      const newWidths = visible.map(c => {
        const scaled = Math.round(c.width * scaleFactor);
        const clamped = Math.max(c.minWidth, Math.min(c.maxWidth, scaled));
        log(`[autoResize]   col="${c.key}" cur=${c.width} scaled=${scaled} clamped=${clamped} (bounds ${c.minWidth}..${c.maxWidth})`);
        return clamped;
      });

      let totalNew = newWidths.reduce((s, w) => s + w, 0);
      log(`[autoResize] totalAfterClamp=${totalNew} diff=${totalNew - availableWidth}`);

      if (totalNew > availableWidth) {
        const excess = totalNew - availableWidth;
        const shrinkable = newWidths
          .map((w, i) => ({ index: i, room: w - visible[i].minWidth, col: visible[i].key }))
          .filter(x => x.room > 0);
        const totalRoom = shrinkable.reduce((s, x) => s + x.room, 0);
        log(`[autoResize] shrink phase: excess=${excess} shrinkableCols=${shrinkable.length} totalRoom=${totalRoom}`);
        if (totalRoom > 0) {
          let redistributed = 0;
          for (const item of shrinkable) {
            const shrink = Math.round(excess * (item.room / totalRoom));
            const before = newWidths[item.index];
            newWidths[item.index] = Math.max(visible[item.index].minWidth, newWidths[item.index] - shrink);
            const actual = before - newWidths[item.index];
            redistributed += actual;
            log(`[autoResize]   shrink col="${item.col}" room=${item.room} shrink=${shrink} ${before}→${newWidths[item.index]}`);
          }
          const slack = excess - redistributed;
          if (slack > 0) {
            log(`[autoResize]   slack=${slack} distributing 1px to first ${slack} shrinkable col(s)`);
            for (let i = 0; i < slack && i < shrinkable.length; i++) {
              const idx = shrinkable[i].index;
              newWidths[idx] = Math.max(visible[idx].minWidth, newWidths[idx] - 1);
            }
          }
        }
        totalNew = newWidths.reduce((s, w) => s + w, 0);
        log(`[autoResize] totalAfterShrink=${totalNew}`);
      }

      if (totalNew < availableWidth) {
        const leftover = availableWidth - totalNew;
        log(`[autoResize] leftover=${leftover} distributing across ALL columns proportionally`);

        const expandable = newWidths
          .map((w, i) => ({ index: i, capacity: visible[i].maxWidth - w, col: visible[i].key }))
          .filter(x => x.capacity > 0);
        const totalCapacity = expandable.reduce((s, x) => s + x.capacity, 0);

        if (totalCapacity > 0) {
          let distributed = 0;
          for (const item of expandable) {
            const add = Math.min(item.capacity, Math.round(leftover * (item.capacity / totalCapacity)));
            const before = newWidths[item.index];
            newWidths[item.index] += add;
            distributed += add;
            log(`[autoResize]   expand col="${item.col}" capacity=${item.capacity} add=${add} ${before}→${newWidths[item.index]}`);
          }
          const slack = leftover - distributed;
          if (slack > 0) {
            log(`[autoResize]   slack=${slack} distributing 1px to first ${slack} expandable col(s)`);
            for (let i = 0; i < slack && i < expandable.length; i++) {
              const idx = expandable[i].index;
              if (newWidths[idx] < visible[idx].maxWidth) {
                newWidths[idx] += 1;
              }
            }
          }
        } else {
          log(`[autoResize]   NO column has capacity — leftover=${leftover} LOST (all cols at maxWidth)`);
        }

        totalNew = newWidths.reduce((s, w) => s + w, 0);
        log(`[autoResize] totalAfterExpand=${totalNew} diff=${totalNew - availableWidth}`);
      }

      return currentCols.map(c => {
        const visIdx = visible.findIndex(vc => vc.key === c.key);
        if (visIdx >= 0) return { ...c, width: newWidths[visIdx] };
        return c;
      });
    });
  }, [autoResizeTrigger, containerWidth, activeGroupId]);

  const visibleCols = useMemo(() => colDefs.filter(c => c.visible), [colDefs]);
  const tableWidth = useMemo(() => CHECKBOX_COL + visibleCols.reduce((sum, c) => sum + c.width, 0), [visibleCols]);

  const handleColResize = (colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const cols = latestColDefsRef.current;
    const leftCol = visibleCols[colIdx];
    if (!leftCol) return;
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
        setColDefs((prev) => prev.map(c => c.key === leftCol.key ? { ...c, width: newLeftWidth } : c));
      } else if (rightCol) {
        const newRightWidth = Math.max(rightCol.minWidth, Math.min(rightCol.maxWidth, rightStartWidth - actualDelta));
        const effectiveDelta = rightStartWidth - newRightWidth;
        const finalLeftWidth = leftStartWidth + effectiveDelta;
        setColDefs((prev) => prev.map(c => {
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
  };

  return { colDefs, setColDefs, visibleCols, tableWidth, handleColResize };
}
