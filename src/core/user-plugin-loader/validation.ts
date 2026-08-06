import { LogStore } from '../logging/LogStore';
import { VALID_SLOTS } from '../slot-registry-constants';
import { PLUGIN_API_VERSION } from '../plugin-api';

export function validatePluginModule(mod: unknown, pluginId: string): string | null {
  if (!mod || typeof mod !== 'object') {
    return `Плагин "${pluginId}" не является объектом. Ожидается: export default { manifest, init, destroy }`;
  }

  const m = mod as Record<string, unknown>;

  if (!m.manifest || typeof m.manifest !== 'object') {
    return `Плагин "${pluginId}" не имеет поля manifest. Ожидается: export default { manifest: { id, name, ... }, init, destroy }`;
  }

  const manifest = m.manifest as Record<string, unknown>;
  if (!manifest.id || typeof manifest.id !== 'string') {
    return `Плагин "${pluginId}" имеет некорректный manifest.id. Ожидается строка.`;
  }

  if (manifest.id !== pluginId) {
    return `Плагин "${pluginId}" имеет несовпадающий manifest.id="${manifest.id}". id должен совпадать с именем папки.`;
  }

  if (manifest.id.startsWith('YOUR_') || manifest.id === 'PLACEHOLDER_ID') {
    LogStore._log('warn', 'plugin-validate', `Плагин "${pluginId}" имеет ID-заглушку "${manifest.id}". Замените на уникальный ID плагина.`);
    return `Плагин "${pluginId}" имеет ID-заглушку "${manifest.id}". Замените на уникальный ID плагина (латиница, без пробелов, уникальный в экосистеме).`;
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    return `Плагин "${pluginId}" не имеет manifest.name. Ожидается строка.`;
  }

  if (typeof m.init !== 'function') {
    return `Плагин "${pluginId}" не имеет метода init(). Ожидается: init(ctx) { ... }`;
  }

  if (typeof m.destroy !== 'function') {
    return `Плагин "${pluginId}" не имеет метода destroy(). Ожидается: destroy() { ... }`;
  }

  const slot = manifest.slot;
  if (!Array.isArray(slot)) {
    return `Плагин "${pluginId}" не имеет manifest.slot. Ожидается массив слотов: ["context-menu:group", "ribbon:tools", ...]`;
  }

  for (const s of slot) {
    if (typeof s !== 'string') {
      return `Плагин "${pluginId}" имеет некорректный слот "${String(s)}". Все слоты должны быть строками.`;
    }
    if (!VALID_SLOTS.has(s)) {
      LogStore._log('warn', 'plugin-validate', `Плагин "${pluginId}" использует неизвестный слот "${s}"`);
    }
  }

  const VALID_CATEGORIES = new Set([
    'system', 'algorithms', 'data', 'analysis', 'custom',
    'seo', 'import', 'export', 'ai', 'tools',
  ]);
  const category = manifest.category as string | undefined;
  if (category && !VALID_CATEGORIES.has(category)) {
    LogStore._log(
      'warn',
      'plugin-validate',
      `Плагин "${pluginId}" использует неизвестную категорию "${category}". ` +
      `Допустимые: ${[...VALID_CATEGORIES].join(', ')}. ` +
      `Плагин будет виден, но может отображаться в отдельной секции.`
    );
  }

  const entry = manifest.entry as string | undefined;
  if (entry && entry.endsWith('.js')) {
    LogStore._log(
      'warn',
      'plugin-validate',
      `Плагин "${pluginId}" использует entry="${entry}". ` +
      `Если плагин написан на TypeScript — используйте "index.ts". ` +
      `"index.js" нужен только для скомпилированных плагинов без исходников.`
    );
  }

  const minAppVersion = manifest.minAppVersion as string | undefined;
  if (minAppVersion) {
    LogStore._log(
      'info',
      'plugin-validate',
      `Плагин "${pluginId}" требует минимальную версию приложения "${minAppVersion}". Текущая версия API: ${PLUGIN_API_VERSION}.`
    );
  }

  return null;
}

export function validatePluginContributions(manifest: Record<string, unknown>, pluginId: string): string[] {
  const warnings: string[] = [];
  const slot = manifest.slot as string[] | undefined;

  if (slot && slot.includes('context-menu:group') && !slot.includes('ribbon:tools') && !slot.includes('right-panel')) {
    LogStore._log('info', 'plugin-validate', `Плагин "${pluginId}" использует контекстное меню группы. Убедитесь, что зарегистрирован action.`);
  }

  return warnings;
}
