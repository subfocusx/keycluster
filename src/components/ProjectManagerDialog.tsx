import type { ProjectListItem } from '@/plugin-sdk';
// ============================================================
// KeyCluster — Project Management Dialog
// ============================================================
//
// Full-featured dialog for:
//   - Listing saved projects
//   - Creating new projects
//   - Loading existing projects
//   - Deleting projects
//   - Importing .kcproj files
//   - Exporting current project
//   - Auto-save settings (toggle + interval + status)
// ============================================================

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  saveProjectAs,
  saveCurrentProject,
  loadProject,
  listProjects,
  deleteProject,
  exportProjectWithDialog,
  importProject,
  getCurrentProjectId,
  enableAutoSave,
  disableAutoSave,
  isAutoSaveEnabled,
} from '@/plugin-sdk';
import { useAppStore } from '@/plugin-sdk';
import { useKCDialog } from '@/components/KCDialog';
import { AutoSaveSettings } from './AutoSaveSettings';
import { MIcon } from '@/shell/shared-icon';

// ---- Icon helper ----


// ---- Component ----

interface ProjectManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectManagerDialog({ open, onOpenChange }: ProjectManagerDialogProps) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kcDialog = useKCDialog();
  const currentId = getCurrentProjectId();
  const phrases = useAppStore(s => s.phrases);
  const groups = useAppStore(s => s.groups);

  // Load project list on open
  useEffect(() => {
    if (open) refreshList();
  }, [open]);

  const refreshList = async () => {
    setLoading(true);
    const result = await listProjects();
    if (result.success) {
      setProjects(result.projects);
    }
    setLoading(false);
  };

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // ---- Handlers ----

  const handleNewProject = async () => {
    if (!newProjectName.trim()) return;
    setLoading(true);
    // Save auto-save state, then disable to prevent saving empty state to old project
    const wasAutoSave = isAutoSaveEnabled();
    disableAutoSave();
    useAppStore.getState().clearAll();
    const result = await saveProjectAs(newProjectName.trim());
    if (wasAutoSave) enableAutoSave();
    if (result.success) {
      showMessage(`Проект «${newProjectName}» создан`);
      setNewProjectName('');
      setShowNewProject(false);
      await refreshList();
    } else {
      showMessage(result.error ?? 'Ошибка создания проекта', 'error');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setLoading(true);
    const result = await saveCurrentProject();
    if (result.success) {
      showMessage('Проект сохранён');
      await refreshList();
    } else {
      showMessage(result.error ?? 'Ошибка сохранения', 'error');
    }
    setLoading(false);
  };

  const handleLoad = async () => {
    if (!selectedId) return;
    setLoading(true);
    const result = await loadProject(selectedId);
    if (result.success) {
      showMessage(`Проект «${result.project?.name}» загружен`);
      await refreshList();
    } else {
      showMessage(result.error ?? 'Ошибка загрузки', 'error');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const project = projects.find(p => p.id === selectedId);
    if (!await kcDialog.confirm(`Удалить проект «${project?.name}»?`, { title: 'Удаление проекта', confirmLabel: 'Удалить', variant: 'destructive' })) return;
    setLoading(true);
    const result = await deleteProject(selectedId);
    if (result.success) {
      setSelectedId(null);
      showMessage('Проект удалён');
      await refreshList();
    } else {
      showMessage(result.error ?? 'Ошибка удаления', 'error');
    }
    setLoading(false);
  };

  const handleExport = async () => {
    const result = await exportProjectWithDialog();
    if (result.success) {
      showMessage('Проект экспортирован');
    } else if (result.error !== 'Отменено пользователем') {
      showMessage(result.error ?? 'Ошибка экспорта', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const result = await importProject(file);
    if (result.success) {
      showMessage('Проект импортирован');
      await refreshList();
    } else {
      showMessage(result.error ?? 'Ошибка импорта', 'error');
    }
    setLoading(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectedProject = projects.find(p => p.id === selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MIcon name="folder_special" className="!text-[20px] text-[var(--kc-blue)]" />
            Управление проектами
          </DialogTitle>
        </DialogHeader>

        {/* Status bar */}
        <div className="flex items-center gap-3 text-[12px] text-[var(--kc-text-secondary)] border-b border-[var(--kc-border)] pb-2">
          <span className="flex items-center gap-1">
            <MIcon name="database" className="!text-[14px]" />
            Текущий: {currentId ? projects.find(p => p.id === currentId)?.name ?? 'без имени' : 'несохранённый'}
          </span>
          <span className="opacity-60">|</span>
          <span>{phrases.length} фраз, {groups.filter(g => !g.isTrash).length} групп</span>
        </div>

        {/* Message */}
        {message && (
          <div className={`px-3 py-1.5 rounded text-[12px] ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
            {message.text}
          </div>
        )}

        <div className="flex-1 overflow-hidden flex gap-3 min-h-0">
          {/* Left: Project list */}
          <div className="flex-1 flex flex-col border border-[var(--kc-border)] rounded-[3px] overflow-hidden">
            <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--kc-toolbar-bg)] border-b border-[var(--kc-border)] shrink-0">
              <span className="font-h2 text-[var(--kc-text)] text-[11px]">Сохранённые проекты</span>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={refreshList} disabled={loading}>
                <MIcon name="refresh" className="!text-[14px] mr-1" />
                Обновить
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto compact-scroll">
              {projects.length === 0 ? (
                <div className="p-4 text-center text-[var(--kc-text-secondary)] text-[12px]">
                  <MIcon name="folder_off" className="!text-[32px] text-[var(--kc-text-disabled)] mb-2" />
                  <p>Нет сохранённых проектов</p>
                </div>
              ) : (
                projects.map(project => (
                  <div
                    key={project.id}
                    className={`flex items-center gap-2 px-3 py-2 border-b border-[var(--kc-border-light)] cursor-pointer transition-colors text-[12px] ${
                      selectedId === project.id ? 'bg-[var(--kc-blue-light)]' : 'hover:bg-[var(--kc-surface-hover)]'
                    } ${project.id === currentId ? 'border-l-2 border-l-[var(--kc-blue)]' : ''}`}
                    onClick={() => setSelectedId(project.id)}
                  >
                    <MIcon name={project.id === currentId ? 'folder_open' : 'folder'} className="!text-[16px] text-[var(--kc-text-secondary)]" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{project.name}</div>
                      <div className="text-[10px] text-[var(--kc-text-secondary)]">
                        {project.phraseCount} фраз · {project.groupCount} групп · {new Date(project.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    {project.id === currentId && (
                      <span className="text-[10px] bg-[var(--kc-blue)] text-white px-1.5 py-0.5 rounded">открыт</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="w-[220px] flex flex-col gap-2 shrink-0">
            {/* New project */}
            {!showNewProject ? (
              <Button variant="outline" size="sm" className="w-full justify-start text-[12px] h-8" onClick={() => setShowNewProject(true)}>
                <MIcon name="create_new_folder" className="!text-[14px] mr-1.5" />
                Новый проект
              </Button>
            ) : (
              <div className="space-y-1.5">
                <input
                  className="w-full h-7 px-2 text-[12px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--kc-blue)]"
                  placeholder="Название проекта..."
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNewProject()}
                  autoFocus
                />
                <div className="flex gap-1">
                  <Button size="sm" className="flex-1 h-7 text-[11px]" onClick={handleNewProject} disabled={!newProjectName.trim()}>
                    Создать
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => { setShowNewProject(false); setNewProjectName(''); }}>
                    ✕
                  </Button>
                </div>
              </div>
            )}

            <div className="h-px bg-[var(--kc-border)]" />

            {/* Save current */}
            <Button variant="outline" size="sm" className="w-full justify-start text-[12px] h-8" onClick={handleSave} disabled={loading}>
              <MIcon name="save" className="!text-[14px] mr-1.5" />
              Сохранить
            </Button>

            {/* Load selected */}
            <Button variant="outline" size="sm" className="w-full justify-start text-[12px] h-8" onClick={handleLoad} disabled={!selectedId || loading}>
              <MIcon name="folder_open" className="!text-[14px] mr-1.5" />
              Открыть
            </Button>

            {/* Delete selected */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-[12px] h-8 text-[var(--kc-red)] hover:text-[var(--kc-red)]"
              onClick={handleDelete}
              disabled={!selectedId || loading}
            >
              <MIcon name="delete" className="!text-[14px] mr-1.5" />
              Удалить
            </Button>

            <div className="h-px bg-[var(--kc-border)]" />

            {/* Export */}
            <Button variant="outline" size="sm" className="w-full justify-start text-[12px] h-8" onClick={handleExport}>
              <MIcon name="upload_file" className="!text-[14px] mr-1.5" />
              Экспорт .kcproj
            </Button>

            {/* Import */}
            <Button variant="outline" size="sm" className="w-full justify-start text-[12px] h-8" onClick={() => fileInputRef.current?.click()}>
              <MIcon name="file_open" className="!text-[14px] mr-1.5" />
              Импорт .kcproj
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".kcproj,.json"
              className="hidden"
              onChange={handleImport}
            />

            <div className="h-px bg-[var(--kc-border)]" />

            {/* Auto-save settings — replaces the simple toggle */}
            <AutoSaveSettings compact />

            {/* Selected project info */}
            {selectedProject && (
              <div className="mt-auto pt-2 border-t border-[var(--kc-border)] text-[11px] text-[var(--kc-text-secondary)] space-y-1">
                <div className="font-semibold text-[var(--kc-text)] truncate">{selectedProject.name}</div>
                <div>Фраз: {selectedProject.phraseCount}</div>
                <div>Групп: {selectedProject.groupCount}</div>
                <div>Создан: {new Date(selectedProject.createdAt).toLocaleDateString()}</div>
                <div>Обновлён: {new Date(selectedProject.updatedAt).toLocaleDateString()}</div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}