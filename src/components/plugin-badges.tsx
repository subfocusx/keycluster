import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { ModuleStatus, PluginStatusDetail } from '@/plugin-sdk';
import { MIcon } from '@/shell/shared-icon';

function StatusBadge({ status }: { status: ModuleStatus['status'] }) {
  const variants: Record<string, { label: string; className: string }> = {
    ok: { label: 'Загружен', className: 'bg-green-100 text-green-800 border-green-200' },
    failed: { label: 'Ошибка', className: 'bg-red-100 text-red-800 border-red-200' },
    loading: { label: 'Загрузка', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    disabled: { label: 'Отключён', className: 'bg-gray-100 text-gray-600 border-gray-200' },
    'not-loaded': { label: 'Не инициализирован', className: 'bg-blue-100 text-blue-600 border-blue-200' },
    'structure-error': { label: 'Ошибка структуры', className: 'bg-orange-100 text-orange-800 border-orange-200' },
    'import-error': { label: 'Ошибка импорта', className: 'bg-red-200 text-red-900 border-red-300' },
    'no-ui': { label: 'Нет UI', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    'api-mismatch': { label: 'API несовместим', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  };
  const v = variants[status] ?? variants['not-loaded'];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${v.className}`}>
      {v.label}
    </Badge>
  );
}

function SourceBadge({ source }: { source: 'builtin' | 'user' }) {
  if (source === 'user') {
    return (
      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-teal-100 text-teal-700 border-teal-200">
        Пользовательский
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-slate-100 text-slate-600 border-slate-200">
      Встроен
    </Badge>
  );
}

export { MIcon, StatusBadge, SourceBadge };
