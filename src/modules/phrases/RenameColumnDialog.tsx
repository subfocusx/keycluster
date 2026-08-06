'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface RenameColumnDialogProps {
  columnKey: string | null;
  columnLabel: string;
  onApply: (key: string, label: string) => void;
  onCancel: () => void;
}

export function RenameColumnDialog({ columnKey, columnLabel, onApply, onCancel }: RenameColumnDialogProps) {
  const [value, setValue] = useState(columnLabel);

  useEffect(() => {
    setValue(columnLabel);
  }, [columnLabel, columnKey]);

  const handleApply = () => {
    if (columnKey && value.trim()) {
      onApply(columnKey, value.trim());
    }
  };

  return (
    <Dialog open={!!columnKey} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader><DialogTitle className="text-[14px]">Переименовать столбец</DialogTitle></DialogHeader>
        <Input autoFocus value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && value.trim()) handleApply();
            if (e.key === 'Escape') onCancel();
          }}
          className="h-8 text-[12px]" placeholder="Новое название..." />
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" className="text-[12px]" onClick={onCancel}>Отмена</Button>
          <Button size="sm" className="text-[12px]" disabled={!value.trim()}
            onClick={handleApply}>
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
