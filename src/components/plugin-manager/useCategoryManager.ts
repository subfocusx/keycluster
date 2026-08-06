'use client';

import { useState, useCallback } from 'react';
import { storageGet, storageSet, STORAGE_KEYS } from '@/core/storage/local-storage';

const DEFAULT_CATEGORIES = {
  order: ['system', 'algorithms', 'data', 'analysis', 'custom'],
  labels: {
    system: '⚙️ Система',
    algorithms: '🧮 Алгоритмы',
    data: '📦 Данные',
    analysis: '🔍 Анализ',
    custom: '🧩 Плагины',
  },
  hidden: [] as string[],
};

interface CategoryConfig {
  order: string[];
  labels: Record<string, string>;
  hidden: string[];
}

function loadCategoryConfig(): CategoryConfig {
  const config = storageGet<CategoryConfig>(STORAGE_KEYS.CATEGORY_CONFIG);
  if (config) return { ...DEFAULT_CATEGORIES, ...config };
  return { ...DEFAULT_CATEGORIES };
}

function saveCategoryConfig(config: CategoryConfig): void {
  storageSet(STORAGE_KEYS.CATEGORY_CONFIG, config);
}

function loadCategoryOverrides(): Record<string, string> {
  return storageGet<Record<string, string>>(STORAGE_KEYS.CATEGORY_OVERRIDES) ?? {};
}

function saveCategoryOverrides(overrides: Record<string, string>): void {
  storageSet(STORAGE_KEYS.CATEGORY_OVERRIDES, overrides);
}

export function useCategoryManager() {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig>(DEFAULT_CATEGORIES);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryLabel, setEditCategoryLabel] = useState('');

  const refreshConfig = useCallback(() => {
    setCategoryConfig(loadCategoryConfig());
  }, []);

  const handleAddCategory = useCallback(() => {
    const key = newCategoryName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!key || categoryConfig.order.includes(key)) return;
    const config = { ...categoryConfig };
    config.order.push(key);
    config.labels = { ...config.labels, [key]: newCategoryName.trim() };
    saveCategoryConfig(config);
    setCategoryConfig(config);
    setNewCategoryName('');
  }, [newCategoryName, categoryConfig]);

  const handleRenameCategory = useCallback((oldKey: string) => {
    if (!editCategoryLabel.trim()) return;
    const config = { ...categoryConfig };
    config.labels = { ...config.labels, [oldKey]: editCategoryLabel.trim() };
    saveCategoryConfig(config);
    setCategoryConfig(config);
    setEditingCategory(null);
  }, [editCategoryLabel, categoryConfig]);

  const movePluginToCategory = useCallback((pluginId: string, category: string) => {
    const overrides = loadCategoryOverrides();
    overrides[pluginId] = category;
    saveCategoryOverrides(overrides);
  }, []);

  const handleDragStart = useCallback((pluginId: string) => {
    setDraggingId(pluginId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverCategory(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, cat: string) => {
    e.preventDefault();
    setDragOverCategory(cat);
  }, []);

  const handleDrop = useCallback((cat: string) => {
    if (draggingId) {
      movePluginToCategory(draggingId, cat);
    }
    setDraggingId(null);
    setDragOverCategory(null);
  }, [draggingId, movePluginToCategory]);

  const categoryOverrides = loadCategoryOverrides();
  const visibleCategories = categoryConfig.order.filter(c => !categoryConfig.hidden.includes(c));

  return {
    draggingId,
    dragOverCategory,
    showCategoryEditor,
    categoryConfig,
    newCategoryName,
    editingCategory,
    editCategoryLabel,
    categoryOverrides,
    visibleCategories,
    setShowCategoryEditor,
    setNewCategoryName,
    setEditingCategory,
    setEditCategoryLabel,
    refreshConfig,
    handleAddCategory,
    handleRenameCategory,
    movePluginToCategory,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  };
}
