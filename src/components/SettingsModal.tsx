import type { ModuleUIContribution } from '@/plugin-sdk';
// ============================================================
// KeyCluster Settings Modal — управление плагинами + справка
// ============================================================
//
// Единая точка входа (шестерёнка в тулбаре):
//   Левая колонка:
//     - «Модули и плагины» — PluginManager (вкл/выкл, настройки, установка)
//     - «Справка» — описание плагинной системы
// ============================================================

'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useTheme } from 'next-themes';
import { PluginManagerSection } from './PluginManager';
import { useAppStore, getRuntime } from '@/plugin-sdk';
import { getEventBus } from '@/plugin-sdk';
import { ModuleErrorBoundary } from './ModuleErrorBoundary';
import { MIcon } from '@/shell/shared-icon';

// ---- Icon helper ----


// ---- Sections ----

type SectionId = 'general' | 'plugins' | 'help' | string;

interface SectionTab {
  id: SectionId;
  label: string;
  icon: string;
}

const SECTIONS: SectionTab[] = [
  { id: 'general', label: 'Основное', icon: 'tune' },
  { id: 'plugins', label: 'Модули и плагины', icon: 'extension' },
  { id: 'help', label: 'Справка', icon: 'help' },
];

// ---- Help Section ----

function HelpSection() {
  return (
    <div className="p-4 space-y-4 text-[12px] leading-relaxed">
      <div>
        <h4 className="text-[13px] font-semibold text-[var(--kc-text)] mb-1.5 flex items-center gap-1.5">
          <MIcon name="info" className="!text-[16px] text-[var(--kc-blue)]" />
          Что такое плагины?
        </h4>
        <p className="text-[var(--kc-text-secondary)]">
          Плагины — это модули, расширяющие возможности KeyCluster. Каждый плагин добавляет
          свои функции: кнопки в тулбар, панели, команды, горячие клавиши. Система плагинов
          построена по аналогии с Obsidian — вы можете устанавливать и удалять плагины без
          пересборки приложения.
        </p>
      </div>

      <div className="h-px bg-[var(--kc-border-light)]" />

      <div>
        <h4 className="text-[13px] font-semibold text-[var(--kc-text)] mb-1.5 flex items-center gap-1.5">
          <MIcon name="code" className="!text-[16px] text-[var(--kc-blue)]" />
          Встроенные плагины
        </h4>
        <p className="text-[var(--kc-text-secondary)]">
          Встроенные плагины (бейдж «Встроен») поставляются вместе с KeyCluster и всегда
          доступны. Это базовые модули: управление группами, ключевые фразы, кластеризация,
          минус-фразы, перекрёстный поиск, поиск-замена, импорт-экспорт. Их нельзя удалить,
          но можно отключить — тогда их функции не будут отображаться в интерфейсе.
        </p>
      </div>

      <div className="h-px bg-[var(--kc-border-light)]" />

      <div>
        <h4 className="text-[13px] font-semibold text-[var(--kc-text)] mb-1.5 flex items-center gap-1.5">
          <MIcon name="folder" className="!text-[16px] text-[var(--kc-blue)]" />
          Локальные плагины
        </h4>
        <p className="text-[var(--kc-text-secondary)]">
          Локальные плагины (бейдж «Локальный») — это дополнительные модули, расположенные
          в папке <code className="px-1 py-0.5 bg-[var(--kc-bg)] rounded text-[11px] font-mono">src/plugins/</code>.
          Каждый плагин состоит из файла <code className="px-1 py-0.5 bg-[var(--kc-bg)] rounded text-[11px] font-mono">manifest.json</code> с
          метаданными и файла <code className="px-1 py-0.5 bg-[var(--kc-bg)] rounded text-[11px] font-mono">index.ts</code> с кодом.
          Локальные плагины можно удалять через кнопку корзины.
        </p>
      </div>

      <div className="h-px bg-[var(--kc-border-light)]" />

      <div>
        <h4 className="text-[13px] font-semibold text-[var(--kc-text)] mb-1.5 flex items-center gap-1.5">
          <MIcon name="add_circle" className="!text-[16px] text-[var(--kc-blue)]" />
          Как добавить плагин
        </h4>
        <p className="text-[var(--kc-text-secondary)]">
          Перейдите на вкладку «Управление плагинами», введите ID плагина в поле «Добавить плагин»
          и нажмите «Загрузить». Система прочитает <code className="px-1 py-0.5 bg-[var(--kc-bg)] rounded text-[11px] font-mono">manifest.json</code> из
          папки <code className="px-1 py-0.5 bg-[var(--kc-bg)] rounded text-[11px] font-mono">src/plugins/{'{pluginId}'}/</code> и
          покажет превью с названием, версией и описанием. Нажмите «Установить» — плагин будет
          загружен и активирован без перезагрузки страницы.
        </p>
      </div>

      <div className="h-px bg-[var(--kc-border-light)]" />

      <div>
        <h4 className="text-[13px] font-semibold text-[var(--kc-text)] mb-1.5 flex items-center gap-1.5">
          <MIcon name="storage" className="!text-[16px] text-[var(--kc-blue)]" />
          Сохранение в базу данных
        </h4>
        <p className="text-[var(--kc-text-secondary)]">
          По умолчанию все данные хранятся в localStorage браузера. Если включить переключатель
          «Сохранять в базу данных», данные будут синхронизироваться с серверной SQLite-базой.
          Это обеспечивает более надёжное хранение и защиту от потери данных при очистке кэша
          браузера. Синхронизация происходит автоматически с задержкой в 1 секунду после
          каждого изменения.
        </p>
      </div>

      <div className="h-px bg-[var(--kc-border-light)]" />

      <div>
        <h4 className="text-[13px] font-semibold text-[var(--kc-text)] mb-1.5 flex items-center gap-1.5">
          <MIcon name="toggle_on" className="!text-[16px] text-[var(--kc-blue)]" />
          Включение и отключение
        </h4>
        <p className="text-[var(--kc-text-secondary)]">
          Каждый плагин можно временно отключить переключателем «Вкл/Выкл». Отключённый плагин
          не удаляется — его функции просто скрываются из интерфейса. При повторном включении
          плагин инициализируется заново. В режиме разработки (dev) также доступна кнопка
          перезагрузки модуля для hot reload без перезагрузки страницы.
        </p>
      </div>
    </div>
  );
}

// ---- General Section ----

function GeneralSection() {
  const storeTheme = useAppStore(s => s.ui.theme);
  const setStoreTheme = useAppStore(s => s.setTheme);
  const { setTheme: setNextTheme } = useTheme();

  const themes: Array<{ id: 'light' | 'dark' | 'dark-pro'; label: string; icon: string }> = [
    { id: 'light', label: 'Light', icon: 'light_mode' },
    { id: 'dark', label: 'Dark', icon: 'dark_mode' },
    { id: 'dark-pro', label: 'Dark Pro', icon: 'contrast' },
  ];

  return (
    <div className="p-4 space-y-4 text-[12px]">
      <h4 className="text-[13px] font-semibold text-[var(--kc-text)] mb-1.5 flex items-center gap-1.5">
        <MIcon name="palette" className="!text-[16px] text-[var(--kc-blue)]" />
        Тема оформления
      </h4>
      <div className="flex gap-2">
        {themes.map(t => (
          <button
            key={t.id}
            className={`flex items-center gap-2 px-3 py-2 rounded border text-[12px] transition-all cursor-pointer ${
              storeTheme === t.id
                ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10 font-medium'
                : 'border-[var(--border)] hover:border-[var(--accent-blue)]'
            }`}
            onClick={() => {
              setStoreTheme(t.id);
              setNextTheme(t.id);
              document.documentElement.classList.toggle('dark', t.id === 'dark' || t.id === 'dark-pro');
            }}
          >
            <MIcon name={t.icon} className="!text-[16px]" />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Main Settings Modal ----

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [pluginTabs, setPluginTabs] = useState<ModuleUIContribution[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalSize, setModalSize] = useState({ width: 780, height: 540 });
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    const update = () => {
      const rt = getRuntime();
      if (rt) setPluginTabs(rt.getUIContributions('settings:tab'));
    };
    update();
    let debounceTimer: ReturnType<typeof setTimeout>;
    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(update, 50);
    };
    const bus = getEventBus();
    const RUNTIME_EVENTS = ['module:registered', 'module:initialized', 'module:enabled', 'module:disabled', 'module:reloaded', 'plugin:uninstalled', 'module:error'];
    const unsubs = RUNTIME_EVENTS.map(e => bus.on(e, debouncedUpdate));
    return () => {
      clearTimeout(debounceTimer);
      unsubs.forEach(u => u());
    };
  }, []);

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isResizing.current = true;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: modalSize.width,
      h: modalSize.height,
    };
  };

  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizing.current) return;
    setModalSize({
      width:  Math.max(560, Math.min(window.innerWidth  * 0.95, resizeStart.current.w + e.clientX - resizeStart.current.x)),
      height: Math.max(440, Math.min(window.innerHeight * 0.92, resizeStart.current.h + e.clientY - resizeStart.current.y)),
    });
  };

  const onResizePointerUp = (e: React.PointerEvent) => {
    isResizing.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div
        ref={modalRef}
        data-testid="settings-modal"
        className="relative bg-[var(--kc-surface)] border border-[var(--kc-border)] rounded-lg shadow-2xl flex overflow-hidden"
        style={{
          width: modalSize.width,
          height: modalSize.height,
          minWidth: 560,
          minHeight: 440,
          maxWidth: '95vw',
          maxHeight: '92vh',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
      >
        {/* Left: Section tabs */}
        <div className="w-[200px] border-r border-[var(--kc-border)] bg-[var(--kc-bg)] flex flex-col shrink-0 overflow-y-auto">
          <div className="px-3 h-10 flex items-center border-b border-[var(--kc-border)]">
            <span className="material-symbols-outlined !text-[18px] text-[var(--kc-text-secondary)] mr-2">
              settings
            </span>
            <span className="text-[13px] font-semibold text-[var(--kc-text)]">Настройки</span>
          </div>

          <div className="flex-1 py-1">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                className={`w-full text-left px-3 py-2.5 text-[12px] transition-colors flex items-center gap-2 ${
                  activeSection === section.id
                    ? 'bg-[var(--kc-blue-light)] text-[var(--kc-text)]'
                    : 'text-[var(--kc-text)] hover:bg-[var(--kc-surface)]'
                }`}
                onClick={() => setActiveSection(section.id)}
              >
                <span className="material-symbols-outlined !text-[16px] text-[var(--kc-text-secondary)]">
                  {section.icon}
                </span>
                <span>{section.label}</span>
              </button>
            ))}
{pluginTabs.map((tab, index) => (
                <button
                  key={tab.moduleId ?? tab.label ?? index}
                className={`w-full text-left px-3 py-2.5 text-[12px] transition-colors flex items-center gap-2 ${
                  activeSection === tab.moduleId
                    ? 'bg-[var(--kc-blue-light)] text-[var(--kc-text)]'
                    : 'text-[var(--kc-text)] hover:bg-[var(--kc-surface)]'
                }`}
                onClick={() => setActiveSection(tab.moduleId ?? '')}
              >
                <span className="material-symbols-outlined !text-[16px] text-[var(--kc-text-secondary)]">
                  {tab.icon ?? 'extension'}
                </span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="px-4 h-10 flex items-center justify-between border-b border-[var(--kc-border)]">
            <span className="text-[13px] font-semibold text-[var(--kc-text)] flex items-center gap-1.5">
              <MIcon name={SECTIONS.find(s => s.id === activeSection)?.icon ?? 'settings'} className="!text-[16px] text-[var(--kc-blue)]" />
              {SECTIONS.find(s => s.id === activeSection)?.label ?? activeSection}
            </span>
            <button
              className="tool-btn !w-7 !h-7"
              onClick={onClose}
            >
              <span className="material-symbols-outlined !text-[16px]">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden compact-scroll min-h-0">
            {activeSection === 'general' && <GeneralSection />}
            {activeSection === 'plugins' && <PluginManagerSection />}
            {activeSection === 'help' && <HelpSection />}
            {activeSection !== 'general' && activeSection !== 'plugins' && activeSection !== 'help' && (() => {
              const tab = pluginTabs.find(t => t.moduleId === activeSection);
              if (!tab?.component) return null;
              const Comp = tab.component;
              return (
                <ModuleErrorBoundary moduleId={tab.moduleId ?? 'unknown'}>
                  <div className="min-h-0 flex flex-col h-full overflow-y-auto compact-scroll">
                    <Suspense fallback={<span className="text-xs opacity-50">...</span>}>
                      <Comp />
                    </Suspense>
                  </div>
                </ModuleErrorBoundary>
              );
            })()}
          </div>
        </div>

        {/* Resize handle */}
        <div
          data-testid="resize-handle"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-10 flex items-end justify-end pb-1 pr-1 opacity-30 hover:opacity-80 transition-opacity select-none"
          title="Изменить размер окна"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M9 1L1 9" stroke="var(--kc-text-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M9 5L5 9" stroke="var(--kc-text-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
