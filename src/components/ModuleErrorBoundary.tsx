// ============================================================
// ModuleErrorBoundary — изоляция ошибок на уровне модулей
// ============================================================
//
// Оборачивает каждый UI-contribution модуля. Если компонент падает,
// показывает компактный fallback вместо обрушения всего приложения.
// Ошибка логируется в EventBus ('module:error').
// ============================================================

'use client';

import React from 'react';
import { getEventBus } from '@/plugin-sdk';

interface ModuleErrorBoundaryProps {
  moduleId: string;
  error?: Error;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * - Показывает компактный fallback: "Модуль {moduleId} недоступен" + кнопка "Перезагрузить"
 * - Кнопка перезагрузки сбрасывает state.hasError
 */
export class ModuleErrorBoundary extends React.Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Логируем в EventBus — другие модули могут реагировать
    try {
      const eventBus = getEventBus();
      eventBus.emit('module:error', {
        moduleId: this.props.moduleId,
        error,
        errorInfo,
        phase: 'render',
      });
    } catch {
      // EventBus может быть не инициализирован
      console.error(`[ModuleErrorBoundary] Error in module "${this.props.moduleId}":`, error);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded border border-red-200 bg-red-50 text-red-700 text-[12px]"
          style={{
            borderColor: 'var(--kc-border, #fecaca)',
            backgroundColor: 'var(--kc-surface, #fef2f2)',
            color: 'var(--kc-text, #b91c1c)',
          }}
        >
          <span className="material-symbols-outlined !text-[16px] shrink-0">warning</span>
          <span className="flex-1">
            Модуль <strong>{this.props.moduleId}</strong> недоступен
          </span>
          <button
            onClick={this.handleReset}
            className="px-2 py-0.5 text-[11px] rounded border border-current opacity-80 hover:opacity-100 transition-opacity"
            title="Перезагрузить модуль"
          >
            Перезагрузить
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ModuleErrorBoundary;
