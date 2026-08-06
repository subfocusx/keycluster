import React, { useState, useRef, useCallback } from 'react';

export function ResizablePanel({
  initialWidth,
  minWidth,
  maxWidth,
  onWidthChange,
  children,
}: {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  onWidthChange?: (width: number) => void;
  children: React.ReactNode;
}) {
  const [width, setWidth] = useState(initialWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const widthRef = useRef(width);
  widthRef.current = width;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = widthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onWidthChange?.(widthRef.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [minWidth, maxWidth, onWidthChange]);

  return (
    <div
      className="border-l border-[var(--border)] bg-[var(--bg-surface)] flex flex-col shrink-0 relative"
      style={{ width: `${width}px` }}
    >
      {children}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-blue)] active:bg-[var(--accent-blue)] z-10"
        style={{ transform: 'translateX(-50%)' }}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
