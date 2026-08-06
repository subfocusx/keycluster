export function InlineDocs() {
  return (
    <div
      className="text-[11px] rounded p-3 space-y-3 border"
      style={{ borderColor: 'var(--kc-border)', backgroundColor: 'var(--kc-bg)' }}
    >
      <div className="font-semibold text-[12px]">Как написать плагин для KeyCluster</div>

      {/* Структура файлов */}
      <div>
        <div className="font-semibold mb-1">1. Структура папки плагина</div>
        <pre className="font-mono opacity-80 leading-relaxed whitespace-pre">{`my-plugin/
  manifest.json   ← метаданные (id, name, slot, entry)
  index.ts        ← исходный код (TypeScript, нужно скомпилировать в JS)
  index.js        ← скомпилированная точка входа (указывается в entry)
  components/
    MyPanel.tsx   ← React-компоненты`}</pre>
      </div>

      {/* Важно про компиляцию */}
      <div className="p-2 rounded" style={{ backgroundColor: 'var(--kc-surface)', borderLeft: '3px solid var(--kc-primary)' }}>
        <div className="font-semibold mb-0.5">⚠ Обязательна компиляция TS → JS</div>
        <div className="opacity-80">
          Плагин устанавливается как <strong>скомпилированный .js-файл</strong>. TypeScript-исходник компилируется вручную.
          Хост принимает только <code>.js</code> — файлы <code>.ts</code> или <code>.tsx</code> в <code>entry</code> не работают.
        </div>
      </div>

      {/* manifest.json */}
      <div>
        <div className="font-semibold mb-1">2. manifest.json</div>
        <pre className="font-mono opacity-80 text-[10px] leading-relaxed whitespace-pre">{`{
  "id": "my-plugin",        // латиница, цифры, дефис — уникальный
  "name": "Мой плагин",
  "version": "1.0.0",
  "description": "...",
  "author": "Имя",
  "icon": "extension",
  "category": "custom",
  "slot": ["ribbon:tools"],
  "entry": "index.js",      // ← указываем .js (скомпилированный файл)
  "dependencies": []
}`}</pre>
        <div className="opacity-70 mt-1">
          Поле <code>entry</code> — относительный путь к точке входа. Должен указывать на <strong>скомпилированный .js-файл</strong>.
        </div>
      </div>

      {/* index.ts — исходник */}
      <div>
        <div className="font-semibold mb-1">3. index.ts — исходный код (требует компиляции)</div>
        <pre className="font-mono opacity-80 text-[10px] leading-relaxed whitespace-pre">{`import type { AppModule, PluginContext } from 'plugin-sdk';
import MyPanel from './components/MyPanel';

const myPlugin: AppModule = {
  manifest: {
    id: 'my-plugin',              // должен совпадать с manifest.json
    name: 'Мой плагин',
    version: '1.0.0',
    description: '...',
    icon: 'extension',
    slot: ['ribbon:tools'],
  },

  init(ctx: PluginContext) {
    ctx.registerUI({
      slot: 'ribbon:tools',
      label: 'Мой плагин',
      icon: 'extension',
      component: MyPanel,         // React-компонент
      order: 100,
    });
  },

  destroy() {},                   // обязательный метод, даже пустой
};

export default myPlugin;          // ← обязательный default export`}</pre>
        <div className="opacity-80 mt-1">
          После написания — скомпилируйте в <code>index.js</code>:<br />
          <code className="text-[10px]">npx esbuild index.ts --bundle --format=esm --outfile=index.js --external:react --external:react-dom</code>
        </div>
      </div>

      {/* Компонент */}
      <div>
        <div className="font-semibold mb-1">4. components/MyPanel.tsx</div>
        <pre className="font-mono opacity-80 text-[10px] leading-relaxed whitespace-pre">{`import React from 'react';              // резолвится из хоста при --external:react
import { useAppStore } from 'plugin-sdk';

export default function MyPanel() {
  const groups = useAppStore(s => s.groups);
  return (
    <div style={{ padding: 16 }}>
      <h3>Мой плагин</h3>
      <p>Групп: {groups.length}</p>
    </div>
  );
}`}</pre>
      </div>

      {/* Важные правила */}
      <div>
        <div className="font-semibold mb-1">5. Правила и частые ошибки</div>
        <div className="space-y-0.5 opacity-80">
          <div>✅ Все импорты из SDK — только из <code>'plugin-sdk'</code> (не <code>@/plugin-sdk</code>)</div>
          <div>✅ <code>manifest.id</code> в index.ts должен совпадать с id в manifest.json</div>
          <div>✅ Обязательны: <code>manifest</code>, <code>init()</code>, <code>destroy()</code>, <code>export default</code></div>
          <div>✅ После каждого изменения index.ts — перекомпилировать в index.js</div>
          <div>❌ <code>entry</code> должен указывать на <code>.js</code>, не на <code>.ts</code> или <code>.tsx</code></div>
          <div>❌ <code>--external:react --external:react-dom</code> обязательны — без них React дублируется и хуки не работают</div>
          <div>❌ Не импортировать из <code>'react'</code> DOM-методы напрямую (использовать JSX)</div>
          <div>❌ Не писать <code>container.innerHTML = ...</code> — SDK передаёт виртуальный объект</div>
        </div>
      </div>

      {/* Слоты */}
      <div>
        <div className="font-semibold mb-1">Доступные слоты для registerUI</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 opacity-80 font-mono">
          <div>'ribbon:tools' → кнопка в toolbar</div>
          <div>'group:toolbar' → шапка группы</div>
          <div>'settings:tab' → вкладка настроек</div>
          <div>'phrase-row:actions' → иконка в строке</div>
          <div>'context-menu:phrase' → контекстное меню</div>
          <div>'context-menu:group' → меню группы</div>
          <div>'left-panel' → панель слева</div>
          <div>'right-panel' → панель справа</div>
          <div>'status-bar' → статус-бар</div>
          <div>'workspace:panel' → доп. панель</div>
        </div>
      </div>

      <div className="pt-1 opacity-40 text-[10px]">
        Установка: Настройки → Модули и плагины → Выбрать папку с плагином → Установить
      </div>
    </div>
  );
}
