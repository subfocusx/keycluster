// ============================================================
// KeyCluster Command Registry — централизованный реестр команд
// ============================================================
//
// Связывает ModuleRuntime.commands с UI (Command Palette).
// Хранит метаданные (label, category, keybinding) для отображения.
// ============================================================

import { STORAGE_KEYS } from './storage/local-storage';

/** Запись о зарегистрированной команде */
export interface CommandEntry {
  /** Полный идентификатор команды (moduleId:commandId) */
  id: string;
  /** Человекочитаемая метка для Command Palette */
  label: string;
  /** ID модуля-владельца (категория) */
  category: string;
  /** Клавиатурное сокращение (опционально) */
  keybinding?: string;
  /** Обработчик команды */
  handler: () => void;
}

const RECENT_COMMANDS_KEY = STORAGE_KEYS.RECENT_COMMANDS;
const MAX_RECENT = 5;

class CommandRegistryImpl {
  private commands = new Map<string, CommandEntry>();

  /**
   * Зарегистрировать команду в реестре.
   * Если команда с таким id уже есть — она обновляется.
   *
   * @param entry — полная запись команды
   */
  register(entry: CommandEntry): void {
    this.commands.set(entry.id, entry);
  }

  /**
   * Удалить команду из реестра по id.
   *
   * @param id — полный идентификатор команды (moduleId:commandId)
   * @returns true если команда была найдена и удалена
   */
  unregister(id: string): boolean {
    return this.commands.delete(id);
  }

  /**
   * Получить все зарегистрированные команды.
   *
   * @returns массив всех CommandEntry
   */
  getAll(): CommandEntry[] {
    return Array.from(this.commands.values());
  }

  /**
   * Получить команду по id.
   */
  get(id: string): CommandEntry | undefined {
    return this.commands.get(id);
  }

  /**
   * Поиск команд по запросу.
   * Ищет вхождение query (case-insensitive) в id и label.
   *
   * @param query — строка поиска
   * @returns отфильтрованный массив CommandEntry
   */
  search(query: string): CommandEntry[] {
    if (!query.trim()) return this.getAll();

    const q = query.toLowerCase();
    return this.getAll().filter(cmd =>
      cmd.id.toLowerCase().includes(q) ||
      cmd.label.toLowerCase().includes(q),
    );
  }

  /**
   * Выполнить команду по id и записать в «недавние».
   *
   * @param id — полный идентификатор команды
   * @returns true если команда найдена и выполнена
   */
  execute(id: string): boolean {
    const cmd = this.commands.get(id);
    if (!cmd) return false;
    cmd.handler();
    this.addRecent(id);
    return true;
  }

  /**
   * Получить 5 последних использованных команд.
   * Хранится в localStorage.
   */
  getRecent(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(RECENT_COMMANDS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Очистить все зарегистрированные команды.
   */
  clear(): void {
    this.commands.clear();
  }

  // ---- Private ----

  private addRecent(id: string): void {
    if (typeof window === 'undefined') return;
    try {
      const recent = this.getRecent().filter(r => r !== id);
      recent.unshift(id);
      localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
    } catch {
      // localStorage unavailable — silently skip
    }
  }
}

// Singleton
let instance: CommandRegistryImpl | null = null;

export function getCommandRegistry(): CommandRegistryImpl {
  if (!instance) {
    instance = new CommandRegistryImpl();
  }
  return instance;
}

/** Для тестов — создать свежий реестр */
export function createCommandRegistry(): CommandRegistryImpl {
  instance = new CommandRegistryImpl();
  return instance;
}
