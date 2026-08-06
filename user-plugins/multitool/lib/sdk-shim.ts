import React from './react-shim';

let _ctx: any = null;

export function __setCtx(ctx: any) {
  _ctx = ctx;
}

function useAppStoreHook(selector?: any) {
  const store = _ctx?.store;
  const selectorRef = React.useRef(selector);
  selectorRef.current = selector;

  const [value, setValue] = React.useState(() => {
    if (!store) return {};
    const state = store.getState();
    return selector ? selector(state) : state;
  });

  React.useEffect(() => {
    if (!store) return;
    const notify = (state: any) => {
      const next = selectorRef.current ? selectorRef.current(state) : state;
      setValue(next);
    };
    notify(store.getState());
    const unsub = store.subscribe(notify);
    return typeof unsub === 'function' ? unsub : undefined;
  }, [store]);

  return value;
}

export function useAppStore(selector?: any) {
  return (useAppStoreHook as any)(selector);
}
(useAppStore as any).getState = () => _ctx?.store?.getState?.() ?? {};

export function dispatch(action: string, payload?: any) {
  const store = _ctx?.store;
  if (!store?.dispatch) return;

  if (action === 'addPhrases') {
    return dispatchAddPhrases(payload);
  }

  try {
    store.dispatch(action, payload);
  } catch (e: any) {
    console.error('[seo-multitool] dispatch ERROR:', action, e.message);
  }
}

function dispatchAddPhrases(payload: any) {
  const store = _ctx?.store;
  if (typeof store?.dispatch !== 'function') return;

  let groupId: string;
  let texts: string[];

  if (Array.isArray(payload)) {
    groupId = payload[0]?.groupId ?? '';
    texts = payload.map((p: any) => (typeof p === 'string' ? p : p.text ?? ''));
  } else {
    groupId = payload?.groupId ?? '';
    const raw = payload?.texts ?? payload?.phrases ?? [];
    texts = raw.map((p: any) => (typeof p === 'string' ? p : p.text ?? ''));
  }

  if (!texts.length) return;

  store.dispatch('addPhrases', { groupId, texts });
}

export function toast(msg: string) {
  if (_ctx?.eventBus?.emit) {
    _ctx.eventBus.emit('notify', { message: msg, duration: 3000 });
  }
}

export function getSetting<T>(key: string): T | undefined {
  return _ctx?.getSetting?.(key) as T | undefined;
}

export function setSetting(key: string, value: unknown): void {
  _ctx?.setSetting?.(key, value);
}

// Task 5: Handler refs for hotkey commands (set by component mount, called by init)
export const handlerRefs: Record<string, () => void> = {
  deduplicate: () => {},
  cleanChars:  () => {},
  trim:        () => {},
  lowercase:   () => {},
  removeEmpty: () => {},
};

// --- Task 4 + 3: Settings management ---
let _pluginSettings: Record<string, any> = {
  syncWithSelection: false,
  showStats: true,
  historySize: 10,
  defaultFilterMode: 'copy',
};
const _settingsListeners: Array<() => void> = [];

export function __updatePluginSettings(s: Record<string, any>) {
  _pluginSettings = { ..._pluginSettings, ...s };
  _settingsListeners.forEach(fn => fn());
}

export function getPluginSettings(): Record<string, any> {
  return _pluginSettings;
}

// --- Task 3c: Cross-boundary sync ---
let _pendingSync: string[] | null = null;

export function __setPendingSync(ids: string[]) {
  _pendingSync = ids;
}

export function __consumePendingSync(): string[] | null {
  const v = _pendingSync;
  _pendingSync = null;
  return v;
}


