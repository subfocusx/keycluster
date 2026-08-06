# Разработка плагинов

## Структура плагина
src/plugins/{id}/
  index.ts        — точка входа, export const {id}Module: AppModule
  manifest.json   — метаданные (id, name, version, category, slot)
  components/     — React-компоненты

## Обновление существующего плагина (dev workflow)
1. npm run dev
2. Отредактируй файлы в src/plugins/{id}/
3. Vite HMR подхватит изменения автоматически
4. Если UI не обновился — PluginManager → кнопка ↺ рядом с плагином

## Категории (поле category в manifest.json)
- algorithms — алгоритмы обработки (кластеризация, ngrams...)
- data       — импорт/экспорт, очистка данных
- analysis   — анализ и поиск по данным
- custom     — прочее

## Добавить новый плагин
1. Скопируй plugin-template/ в src/plugins/{new-id}/
2. Заполни manifest.json (id, name, version, category, entry)
3. npm run dev — плагин появится в PluginManager (регистрация автоматическая через модульную систему)
