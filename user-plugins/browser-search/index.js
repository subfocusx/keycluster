"use client";
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@tauri-apps/api/external/tslib/tslib.es6.js
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
var init_tslib_es6 = __esm({
  "node_modules/@tauri-apps/api/external/tslib/tslib.es6.js"() {
  }
});

// node_modules/@tauri-apps/api/core.js
function transformCallback(callback, once = false) {
  return window.__TAURI_INTERNALS__.transformCallback(callback, once);
}
async function invoke(cmd, args = {}, options) {
  return window.__TAURI_INTERNALS__.invoke(cmd, args, options);
}
var _Channel_onmessage, _Channel_nextMessageIndex, _Channel_pendingMessages, _Channel_messageEndIndex, _Resource_rid, SERIALIZE_TO_IPC_FN, Channel;
var init_core = __esm({
  "node_modules/@tauri-apps/api/core.js"() {
    init_tslib_es6();
    SERIALIZE_TO_IPC_FN = "__TAURI_TO_IPC_KEY__";
    Channel = class {
      constructor(onmessage) {
        _Channel_onmessage.set(this, void 0);
        _Channel_nextMessageIndex.set(this, 0);
        _Channel_pendingMessages.set(this, []);
        _Channel_messageEndIndex.set(this, void 0);
        __classPrivateFieldSet(this, _Channel_onmessage, onmessage || (() => {
        }), "f");
        this.id = transformCallback((rawMessage) => {
          const index = rawMessage.index;
          if ("end" in rawMessage) {
            if (index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) {
              this.cleanupCallback();
            } else {
              __classPrivateFieldSet(this, _Channel_messageEndIndex, index, "f");
            }
            return;
          }
          const message = rawMessage.message;
          if (index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) {
            __classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message);
            __classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
            while (__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") in __classPrivateFieldGet(this, _Channel_pendingMessages, "f")) {
              const message2 = __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
              __classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message2);
              delete __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
              __classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
            }
            if (__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") === __classPrivateFieldGet(this, _Channel_messageEndIndex, "f")) {
              this.cleanupCallback();
            }
          } else {
            __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[index] = message;
          }
        });
      }
      cleanupCallback() {
        window.__TAURI_INTERNALS__.unregisterCallback(this.id);
      }
      set onmessage(handler) {
        __classPrivateFieldSet(this, _Channel_onmessage, handler, "f");
      }
      get onmessage() {
        return __classPrivateFieldGet(this, _Channel_onmessage, "f");
      }
      [(_Channel_onmessage = /* @__PURE__ */ new WeakMap(), _Channel_nextMessageIndex = /* @__PURE__ */ new WeakMap(), _Channel_pendingMessages = /* @__PURE__ */ new WeakMap(), _Channel_messageEndIndex = /* @__PURE__ */ new WeakMap(), SERIALIZE_TO_IPC_FN)]() {
        return `__CHANNEL__:${this.id}`;
      }
      toJSON() {
        return this[SERIALIZE_TO_IPC_FN]();
      }
    };
    _Resource_rid = /* @__PURE__ */ new WeakMap();
  }
});

// node_modules/@tauri-apps/plugin-shell/dist-js/index.js
var dist_js_exports = {};
__export(dist_js_exports, {
  Child: () => Child,
  Command: () => Command,
  EventEmitter: () => EventEmitter,
  open: () => open
});
async function open(path, openWith) {
  await invoke("plugin:shell|open", {
    path,
    with: openWith
  });
}
var EventEmitter, Child, Command;
var init_dist_js = __esm({
  "node_modules/@tauri-apps/plugin-shell/dist-js/index.js"() {
    init_core();
    EventEmitter = class {
      constructor() {
        this.eventListeners = /* @__PURE__ */ Object.create(null);
      }
      /**
       * Alias for `emitter.on(eventName, listener)`.
       *
       * @since 2.0.0
       */
      addListener(eventName, listener) {
        return this.on(eventName, listener);
      }
      /**
       * Alias for `emitter.off(eventName, listener)`.
       *
       * @since 2.0.0
       */
      removeListener(eventName, listener) {
        return this.off(eventName, listener);
      }
      /**
       * Adds the `listener` function to the end of the listeners array for the
       * event named `eventName`. No checks are made to see if the `listener` has
       * already been added. Multiple calls passing the same combination of `eventName`and `listener` will result in the `listener` being added, and called, multiple
       * times.
       *
       * Returns a reference to the `EventEmitter`, so that calls can be chained.
       *
       * @since 2.0.0
       */
      on(eventName, listener) {
        if (eventName in this.eventListeners) {
          this.eventListeners[eventName].push(listener);
        } else {
          this.eventListeners[eventName] = [listener];
        }
        return this;
      }
      /**
       * Adds a **one-time**`listener` function for the event named `eventName`. The
       * next time `eventName` is triggered, this listener is removed and then invoked.
       *
       * Returns a reference to the `EventEmitter`, so that calls can be chained.
       *
       * @since 2.0.0
       */
      once(eventName, listener) {
        const wrapper = (arg) => {
          this.removeListener(eventName, wrapper);
          listener(arg);
        };
        return this.addListener(eventName, wrapper);
      }
      /**
       * Removes the all specified listener from the listener array for the event eventName
       * Returns a reference to the `EventEmitter`, so that calls can be chained.
       *
       * @since 2.0.0
       */
      off(eventName, listener) {
        if (eventName in this.eventListeners) {
          this.eventListeners[eventName] = this.eventListeners[eventName].filter((l) => l !== listener);
        }
        return this;
      }
      /**
       * Removes all listeners, or those of the specified eventName.
       *
       * Returns a reference to the `EventEmitter`, so that calls can be chained.
       *
       * @since 2.0.0
       */
      removeAllListeners(event) {
        if (event) {
          delete this.eventListeners[event];
        } else {
          this.eventListeners = /* @__PURE__ */ Object.create(null);
        }
        return this;
      }
      /**
       * @ignore
       * Synchronously calls each of the listeners registered for the event named`eventName`, in the order they were registered, passing the supplied arguments
       * to each.
       *
       * @returns `true` if the event had listeners, `false` otherwise.
       *
       * @since 2.0.0
       */
      emit(eventName, arg) {
        if (eventName in this.eventListeners) {
          const listeners = this.eventListeners[eventName];
          for (const listener of listeners)
            listener(arg);
          return true;
        }
        return false;
      }
      /**
       * Returns the number of listeners listening to the event named `eventName`.
       *
       * @since 2.0.0
       */
      listenerCount(eventName) {
        if (eventName in this.eventListeners)
          return this.eventListeners[eventName].length;
        return 0;
      }
      /**
       * Adds the `listener` function to the _beginning_ of the listeners array for the
       * event named `eventName`. No checks are made to see if the `listener` has
       * already been added. Multiple calls passing the same combination of `eventName`and `listener` will result in the `listener` being added, and called, multiple
       * times.
       *
       * Returns a reference to the `EventEmitter`, so that calls can be chained.
       *
       * @since 2.0.0
       */
      prependListener(eventName, listener) {
        if (eventName in this.eventListeners) {
          this.eventListeners[eventName].unshift(listener);
        } else {
          this.eventListeners[eventName] = [listener];
        }
        return this;
      }
      /**
       * Adds a **one-time**`listener` function for the event named `eventName` to the_beginning_ of the listeners array. The next time `eventName` is triggered, this
       * listener is removed, and then invoked.
       *
       * Returns a reference to the `EventEmitter`, so that calls can be chained.
       *
       * @since 2.0.0
       */
      prependOnceListener(eventName, listener) {
        const wrapper = (arg) => {
          this.removeListener(eventName, wrapper);
          listener(arg);
        };
        return this.prependListener(eventName, wrapper);
      }
    };
    Child = class {
      constructor(pid) {
        this.pid = pid;
      }
      /**
       * Writes `data` to the `stdin`.
       *
       * @param data The message to write, either a string or a byte array.
       * @example
       * ```typescript
       * import { Command } from '@tauri-apps/plugin-shell';
       * const command = Command.create('node');
       * const child = await command.spawn();
       * await child.write('message');
       * await child.write([0, 1, 2, 3, 4, 5]);
       * ```
       *
       * @returns A promise indicating the success or failure of the operation.
       *
       * @since 2.0.0
       */
      async write(data) {
        await invoke("plugin:shell|stdin_write", {
          pid: this.pid,
          buffer: data
        });
      }
      /**
       * Kills the child process.
       *
       * @returns A promise indicating the success or failure of the operation.
       *
       * @since 2.0.0
       */
      async kill() {
        await invoke("plugin:shell|kill", {
          cmd: "killChild",
          pid: this.pid
        });
      }
    };
    Command = class _Command extends EventEmitter {
      /**
       * @ignore
       * Creates a new `Command` instance.
       *
       * @param program The program name to execute.
       * It must be configured in your project's capabilities.
       * @param args Program arguments.
       * @param options Spawn options.
       */
      constructor(program, args = [], options) {
        super();
        this.stdout = new EventEmitter();
        this.stderr = new EventEmitter();
        this.program = program;
        this.args = typeof args === "string" ? [args] : args;
        this.options = options ?? {};
      }
      /**
       * Creates a command to execute the given program.
       * @example
       * ```typescript
       * import { Command } from '@tauri-apps/plugin-shell';
       * const command = Command.create('my-app', ['run', 'tauri']);
       * const output = await command.execute();
       * ```
       *
       * @param program The program to execute.
       * It must be configured in your project's capabilities.
       */
      static create(program, args = [], options) {
        return new _Command(program, args, options);
      }
      /**
       * Creates a command to execute the given sidecar program.
       * @example
       * ```typescript
       * import { Command } from '@tauri-apps/plugin-shell';
       * const command = Command.sidecar('my-sidecar');
       * const output = await command.execute();
       * ```
       *
       * @param program The program to execute.
       * It must be configured in your project's capabilities.
       */
      static sidecar(program, args = [], options) {
        const instance = new _Command(program, args, options);
        instance.options.sidecar = true;
        return instance;
      }
      /**
       * Executes the command as a child process, returning a handle to it.
       *
       * @returns A promise resolving to the child process handle.
       *
       * @since 2.0.0
       */
      async spawn() {
        const program = this.program;
        const args = this.args;
        const options = this.options;
        if (typeof args === "object") {
          Object.freeze(args);
        }
        const onEvent = new Channel();
        onEvent.onmessage = (event) => {
          switch (event.event) {
            case "Error":
              this.emit("error", event.payload);
              break;
            case "Terminated":
              this.emit("close", event.payload);
              break;
            case "Stdout":
              this.stdout.emit("data", event.payload);
              break;
            case "Stderr":
              this.stderr.emit("data", event.payload);
              break;
          }
        };
        return await invoke("plugin:shell|spawn", {
          program,
          args,
          options,
          onEvent
        }).then((pid) => new Child(pid));
      }
      /**
       * Executes the command as a child process, waiting for it to finish and collecting all of its output.
       * @example
       * ```typescript
       * import { Command } from '@tauri-apps/plugin-shell';
       * const output = await Command.create('echo', 'message').execute();
       * assert(output.code === 0);
       * assert(output.signal === null);
       * assert(output.stdout === 'message');
       * assert(output.stderr === '');
       * ```
       *
       * @returns A promise resolving to the child process output.
       *
       * @since 2.0.0
       */
      async execute() {
        const program = this.program;
        const args = this.args;
        const options = this.options;
        if (typeof args === "object") {
          Object.freeze(args);
        }
        return await invoke("plugin:shell|execute", {
          program,
          args,
          options
        });
      }
    };
  }
});

// user-plugins/browser-search/index.ts
import { useSettingsStore, getSearchProvider, getAllSearchProviders, registerSearchProvider, unregisterSearchProvider } from "plugin-sdk";
var BUILTIN_PROVIDERS = [
  { id: "yandex", name: "\u042F\u043D\u0434\u0435\u043A\u0441", urlTemplate: "https://yandex.ru/search/?text={query}" },
  { id: "google", name: "Google", urlTemplate: "https://www.google.com/search?q={query}" },
  { id: "wordstat", name: "Wordstat", urlTemplate: "https://wordstat.yandex.ru/?words={query}" },
  { id: "keys.so", name: "Keys.so", urlTemplate: "https://keys.so/report?q={query}" }
];
var CUSTOM_PROVIDER = {
  id: "custom",
  name: "Custom",
  urlTemplate: "https://custom.search?q={query}"
};
var DEFAULT_SEARCH_ENGINES = [...BUILTIN_PROVIDERS, CUSTOM_PROVIDER];
function getSearchUrl(query) {
  const engineId = useSettingsStore.getState().getModuleSetting("core", "searchEngine") ?? "yandex";
  if (engineId === "custom") {
    const customUrl = useSettingsStore.getState().getModuleSetting("core", "customSearchUrl") || "";
    if (customUrl) {
      return customUrl.replace("{query}", encodeURIComponent(query));
    }
  }
  const engine = getSearchProvider(engineId) ?? getAllSearchProviders()[0];
  if (!engine) {
    const fallback = BUILTIN_PROVIDERS.find((e) => e.id === engineId) ?? BUILTIN_PROVIDERS[0];
    return fallback.urlTemplate.replace("{query}", encodeURIComponent(query));
  }
  return engine.urlTemplate.replace("{query}", encodeURIComponent(query));
}
async function openInBrowser(query) {
  const url = getSearchUrl(query);
  try {
    const { open: open2 } = await Promise.resolve().then(() => (init_dist_js(), dist_js_exports));
    await open2(url);
  } catch {
    window.open(url, "_blank");
  }
}
var browserSearchModule = {
  manifest: {
    id: "browser-search",
    name: "\u041F\u043E\u0438\u0441\u043A \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435",
    version: "1.0.0",
    description: "\u041A\u043D\u043E\u043F\u043A\u0430 \u043F\u043E\u0438\u0441\u043A\u0430 \u043D\u0430\u043F\u0440\u043E\u0442\u0438\u0432 \u043A\u0430\u0436\u0434\u043E\u0439 \u0444\u0440\u0430\u0437\u044B + \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u043F\u043E\u0438\u0441\u043A\u043E\u0432\u043E\u0439 \u0441\u0438\u0441\u0442\u0435\u043C\u044B",
    category: "data",
    slot: ["phrase-row:actions"],
    settingsSchema: [
      { key: "searchEngine", type: "string", label: "\u041F\u043E\u0438\u0441\u043A\u043E\u0432\u0438\u043A", default: "yandex" },
      { key: "customSearchUrl", type: "string", label: "URL \u0448\u0430\u0431\u043B\u043E\u043D", default: "https://google.com/search?q={query}" }
    ],
    repository: "https://github.com/keycluster/kc-browser-search",
    minAppVersion: "0.3.0"
  },
  init(ctx) {
    for (const p of BUILTIN_PROVIDERS) {
      registerSearchProvider(p);
    }
    ctx.registerUI({
      slot: "phrase-row:actions",
      label: "\u041F\u043E\u0438\u0441\u043A \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435",
      icon: "search",
      action: (phrase, _actionCtx) => {
        openInBrowser(phrase.text);
      },
      order: 100
    });
    ctx.registerCommand("open-search", () => {
      const text = document.getSelection()?.toString();
      if (text) openInBrowser(text);
    });
    ctx.registerKeybinding?.("ctrl+shift+f", "open-search", { label: "\u041F\u043E\u0438\u0441\u043A \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435" });
  },
  destroy() {
    for (const p of BUILTIN_PROVIDERS) {
      unregisterSearchProvider(p.id);
    }
  }
};
var index_default = browserSearchModule;
export {
  DEFAULT_SEARCH_ENGINES,
  index_default as default,
  getSearchUrl,
  openInBrowser
};
