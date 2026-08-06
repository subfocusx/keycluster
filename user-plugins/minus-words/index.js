var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../node_modules/@tauri-apps/api/external/tslib/tslib.es6.js
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
  "../../node_modules/@tauri-apps/api/external/tslib/tslib.es6.js"() {
  }
});

// ../../node_modules/@tauri-apps/api/core.js
function transformCallback(callback, once = false) {
  return window.__TAURI_INTERNALS__.transformCallback(callback, once);
}
async function invoke(cmd, args = {}, options) {
  return window.__TAURI_INTERNALS__.invoke(cmd, args, options);
}
var _Channel_onmessage, _Channel_nextMessageIndex, _Channel_pendingMessages, _Channel_messageEndIndex, _Resource_rid, SERIALIZE_TO_IPC_FN, Channel, Resource;
var init_core = __esm({
  "../../node_modules/@tauri-apps/api/core.js"() {
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
          const message2 = rawMessage.message;
          if (index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) {
            __classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message2);
            __classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
            while (__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") in __classPrivateFieldGet(this, _Channel_pendingMessages, "f")) {
              const message3 = __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
              __classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message3);
              delete __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
              __classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
            }
            if (__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") === __classPrivateFieldGet(this, _Channel_messageEndIndex, "f")) {
              this.cleanupCallback();
            }
          } else {
            __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[index] = message2;
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
    Resource = class {
      get rid() {
        return __classPrivateFieldGet(this, _Resource_rid, "f");
      }
      constructor(rid) {
        _Resource_rid.set(this, void 0);
        __classPrivateFieldSet(this, _Resource_rid, rid, "f");
      }
      /**
       * Destroys and cleans up this resource from memory.
       * **You should not call any method on this object anymore and should drop any reference to it.**
       */
      async close() {
        return invoke("plugin:resources|close", {
          rid: this.rid
        });
      }
    };
    _Resource_rid = /* @__PURE__ */ new WeakMap();
  }
});

// ../../node_modules/@tauri-apps/plugin-dialog/dist-js/index.js
var dist_js_exports = {};
__export(dist_js_exports, {
  ask: () => ask,
  confirm: () => confirm,
  message: () => message,
  open: () => open,
  save: () => save
});
function buttonsToRust(buttons) {
  if (buttons === void 0) {
    return void 0;
  }
  if (typeof buttons === "string") {
    return buttons;
  } else if ("ok" in buttons && "cancel" in buttons) {
    return { OkCancelCustom: [buttons.ok, buttons.cancel] };
  } else if ("yes" in buttons && "no" in buttons && "cancel" in buttons) {
    return {
      YesNoCancelCustom: [buttons.yes, buttons.no, buttons.cancel]
    };
  } else if ("ok" in buttons) {
    return { OkCustom: buttons.ok };
  }
  return void 0;
}
async function open(options = {}) {
  if (typeof options === "object") {
    Object.freeze(options);
  }
  return await invoke("plugin:dialog|open", { options });
}
async function save(options = {}) {
  if (typeof options === "object") {
    Object.freeze(options);
  }
  return await invoke("plugin:dialog|save", { options });
}
async function messageCommand(message2, options) {
  return await invoke("plugin:dialog|message", {
    message: message2,
    title: options?.title,
    kind: options?.kind,
    buttons: buttonsToRust(options?.buttons)
  });
}
async function message(message2, options) {
  const opts = typeof options === "string" ? { title: options } : options;
  if (opts && !opts.buttons && opts.okLabel) {
    opts.buttons = { ok: opts.okLabel };
  }
  return messageCommand(message2, opts);
}
async function ask(message2, options) {
  const opts = typeof options === "string" ? { title: options } : options;
  const customButtons = opts?.okLabel || opts?.cancelLabel;
  const okLabel = opts?.okLabel ?? "Yes";
  return await messageCommand(message2, {
    title: opts?.title,
    kind: opts?.kind,
    buttons: customButtons ? { ok: okLabel, cancel: opts.cancelLabel ?? "No" } : "YesNo"
  }) === okLabel;
}
async function confirm(message2, options) {
  const opts = typeof options === "string" ? { title: options } : options;
  const customButtons = opts?.okLabel || opts?.cancelLabel;
  const okLabel = opts?.okLabel ?? "Ok";
  return await messageCommand(message2, {
    title: opts?.title,
    kind: opts?.kind,
    buttons: customButtons ? { ok: okLabel, cancel: opts.cancelLabel ?? "Cancel" } : "OkCancel"
  }) === okLabel;
}
var init_dist_js = __esm({
  "../../node_modules/@tauri-apps/plugin-dialog/dist-js/index.js"() {
    init_core();
  }
});

// ../../node_modules/@tauri-apps/api/path.js
var BaseDirectory;
var init_path = __esm({
  "../../node_modules/@tauri-apps/api/path.js"() {
    init_core();
    (function(BaseDirectory2) {
      BaseDirectory2[BaseDirectory2["Audio"] = 1] = "Audio";
      BaseDirectory2[BaseDirectory2["Cache"] = 2] = "Cache";
      BaseDirectory2[BaseDirectory2["Config"] = 3] = "Config";
      BaseDirectory2[BaseDirectory2["Data"] = 4] = "Data";
      BaseDirectory2[BaseDirectory2["LocalData"] = 5] = "LocalData";
      BaseDirectory2[BaseDirectory2["Document"] = 6] = "Document";
      BaseDirectory2[BaseDirectory2["Download"] = 7] = "Download";
      BaseDirectory2[BaseDirectory2["Picture"] = 8] = "Picture";
      BaseDirectory2[BaseDirectory2["Public"] = 9] = "Public";
      BaseDirectory2[BaseDirectory2["Video"] = 10] = "Video";
      BaseDirectory2[BaseDirectory2["Resource"] = 11] = "Resource";
      BaseDirectory2[BaseDirectory2["Temp"] = 12] = "Temp";
      BaseDirectory2[BaseDirectory2["AppConfig"] = 13] = "AppConfig";
      BaseDirectory2[BaseDirectory2["AppData"] = 14] = "AppData";
      BaseDirectory2[BaseDirectory2["AppLocalData"] = 15] = "AppLocalData";
      BaseDirectory2[BaseDirectory2["AppCache"] = 16] = "AppCache";
      BaseDirectory2[BaseDirectory2["AppLog"] = 17] = "AppLog";
      BaseDirectory2[BaseDirectory2["Desktop"] = 18] = "Desktop";
      BaseDirectory2[BaseDirectory2["Executable"] = 19] = "Executable";
      BaseDirectory2[BaseDirectory2["Font"] = 20] = "Font";
      BaseDirectory2[BaseDirectory2["Home"] = 21] = "Home";
      BaseDirectory2[BaseDirectory2["Runtime"] = 22] = "Runtime";
      BaseDirectory2[BaseDirectory2["Template"] = 23] = "Template";
    })(BaseDirectory || (BaseDirectory = {}));
  }
});

// ../../node_modules/@tauri-apps/plugin-fs/dist-js/index.js
var dist_js_exports2 = {};
__export(dist_js_exports2, {
  BaseDirectory: () => BaseDirectory,
  FileHandle: () => FileHandle,
  SeekMode: () => SeekMode,
  copyFile: () => copyFile,
  create: () => create,
  exists: () => exists,
  lstat: () => lstat,
  mkdir: () => mkdir,
  open: () => open2,
  readDir: () => readDir,
  readFile: () => readFile,
  readTextFile: () => readTextFile,
  readTextFileLines: () => readTextFileLines,
  remove: () => remove,
  rename: () => rename,
  size: () => size,
  startAccessingSecurityScopedResource: () => startAccessingSecurityScopedResource,
  stat: () => stat,
  stopAccessingSecurityScopedResource: () => stopAccessingSecurityScopedResource,
  truncate: () => truncate,
  watch: () => watch,
  watchImmediate: () => watchImmediate,
  writeFile: () => writeFile,
  writeTextFile: () => writeTextFile
});
function parseFileInfo(r) {
  return {
    isFile: r.isFile,
    isDirectory: r.isDirectory,
    isSymlink: r.isSymlink,
    size: r.size,
    mtime: r.mtime !== null ? new Date(r.mtime) : null,
    atime: r.atime !== null ? new Date(r.atime) : null,
    birthtime: r.birthtime !== null ? new Date(r.birthtime) : null,
    readonly: r.readonly,
    fileAttributes: r.fileAttributes,
    dev: r.dev,
    ino: r.ino,
    mode: r.mode,
    nlink: r.nlink,
    uid: r.uid,
    gid: r.gid,
    rdev: r.rdev,
    blksize: r.blksize,
    blocks: r.blocks
  };
}
function fromBytes(buffer) {
  const bytes = new Uint8ClampedArray(buffer);
  const size2 = bytes.byteLength;
  let x = 0;
  for (let i = 0; i < size2; i++) {
    const byte = bytes[i];
    x *= 256;
    x += byte;
  }
  return x;
}
async function create(path, options) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  const rid = await invoke("plugin:fs|create", {
    path: path instanceof URL ? path.toString() : path,
    options
  });
  return new FileHandle(rid);
}
async function open2(path, options) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  const rid = await invoke("plugin:fs|open", {
    path: path instanceof URL ? path.toString() : path,
    options
  });
  return new FileHandle(rid);
}
async function copyFile(fromPath, toPath, options) {
  if (fromPath instanceof URL && fromPath.protocol !== "file:" || toPath instanceof URL && toPath.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  await invoke("plugin:fs|copy_file", {
    fromPath: fromPath instanceof URL ? fromPath.toString() : fromPath,
    toPath: toPath instanceof URL ? toPath.toString() : toPath,
    options
  });
}
async function mkdir(path, options) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  await invoke("plugin:fs|mkdir", {
    path: path instanceof URL ? path.toString() : path,
    options
  });
}
async function readDir(path, options) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  return await invoke("plugin:fs|read_dir", {
    path: path instanceof URL ? path.toString() : path,
    options
  });
}
async function readFile(path, options) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  const arr = await invoke("plugin:fs|read_file", {
    path: path instanceof URL ? path.toString() : path,
    options
  });
  return arr instanceof ArrayBuffer ? new Uint8Array(arr) : Uint8Array.from(arr);
}
async function readTextFile(path, options) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  const arr = await invoke("plugin:fs|read_text_file", {
    path: path instanceof URL ? path.toString() : path,
    options
  });
  const bytes = arr instanceof ArrayBuffer ? arr : Uint8Array.from(arr);
  return new TextDecoder(options?.encoding ?? "utf-8").decode(bytes);
}
async function readTextFileLines(path, options) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  const pathStr = path instanceof URL ? path.toString() : path;
  return await Promise.resolve({
    path: pathStr,
    rid: null,
    async next() {
      const decoder = new TextDecoder(options?.encoding ?? "utf-8");
      if (this.rid === null) {
        const encoding = decoder.encoding;
        this.rid = await invoke("plugin:fs|read_text_file_lines", {
          path: pathStr,
          options: options != null ? { ...options, encoding } : void 0
        });
      }
      const arr = await invoke("plugin:fs|read_text_file_lines_next", { rid: this.rid });
      const bytes = arr instanceof ArrayBuffer ? new Uint8Array(arr) : Uint8Array.from(arr);
      const done = bytes[bytes.byteLength - 1] === 1;
      if (done) {
        this.rid = null;
        return { value: null, done };
      }
      const line = decoder.decode(bytes.slice(0, bytes.byteLength - 1));
      return {
        value: line,
        done
      };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  });
}
async function remove(path, options) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  await invoke("plugin:fs|remove", {
    path: path instanceof URL ? path.toString() : path,
    options
  });
}
async function rename(oldPath, newPath, options) {
  if (oldPath instanceof URL && oldPath.protocol !== "file:" || newPath instanceof URL && newPath.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  await invoke("plugin:fs|rename", {
    oldPath: oldPath instanceof URL ? oldPath.toString() : oldPath,
    newPath: newPath instanceof URL ? newPath.toString() : newPath,
    options
  });
}
async function stat(path, options) {
  const res = await invoke("plugin:fs|stat", {
    path: path instanceof URL ? path.toString() : path,
    options
  });
  return parseFileInfo(res);
}
async function lstat(path, options) {
  const res = await invoke("plugin:fs|lstat", {
    path: path instanceof URL ? path.toString() : path,
    options
  });
  return parseFileInfo(res);
}
async function truncate(path, len, options) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  await invoke("plugin:fs|truncate", {
    path: path instanceof URL ? path.toString() : path,
    len,
    options
  });
}
async function writeFile(path, data, options) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  if (data instanceof ReadableStream) {
    const file = await open2(path, {
      read: false,
      create: true,
      write: true,
      ...options
    });
    const reader = data.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        await file.write(value);
      }
    } finally {
      reader.releaseLock();
      await file.close();
    }
  } else {
    await invoke("plugin:fs|write_file", data, {
      headers: {
        path: encodeURIComponent(path instanceof URL ? path.toString() : path),
        options: JSON.stringify(options)
      }
    });
  }
}
async function writeTextFile(path, data, options) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  const encoder = new TextEncoder();
  await invoke("plugin:fs|write_text_file", encoder.encode(data), {
    headers: {
      path: encodeURIComponent(path instanceof URL ? path.toString() : path),
      options: JSON.stringify(options)
    }
  });
}
async function exists(path, options) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  return await invoke("plugin:fs|exists", {
    path: path instanceof URL ? path.toString() : path,
    options
  });
}
async function watchInternal(paths, cb, options) {
  const watchPaths = Array.isArray(paths) ? paths : [paths];
  for (const path of watchPaths) {
    if (path instanceof URL && path.protocol !== "file:") {
      throw new TypeError("Must be a file URL.");
    }
  }
  const onEvent = new Channel();
  onEvent.onmessage = cb;
  const rid = await invoke("plugin:fs|watch", {
    paths: watchPaths.map((p) => p instanceof URL ? p.toString() : p),
    options,
    onEvent
  });
  const watcher = new Watcher(rid);
  return () => {
    void watcher.close();
  };
}
async function watch(paths, cb, options) {
  return await watchInternal(paths, cb, {
    delayMs: 2e3,
    ...options
  });
}
async function watchImmediate(paths, cb, options) {
  return await watchInternal(paths, cb, {
    ...options,
    delayMs: void 0
  });
}
async function size(path) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  return await invoke("plugin:fs|size", {
    path: path instanceof URL ? path.toString() : path
  });
}
async function startAccessingSecurityScopedResource(path) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  await invoke("plugin:fs|start_accessing_security_scoped_resource", {
    path: path instanceof URL ? path.toString() : path
  });
}
async function stopAccessingSecurityScopedResource(path) {
  if (path instanceof URL && path.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  await invoke("plugin:fs|stop_accessing_security_scoped_resource", {
    path: path instanceof URL ? path.toString() : path
  });
}
var SeekMode, FileHandle, Watcher;
var init_dist_js2 = __esm({
  "../../node_modules/@tauri-apps/plugin-fs/dist-js/index.js"() {
    init_path();
    init_core();
    (function(SeekMode2) {
      SeekMode2[SeekMode2["Start"] = 0] = "Start";
      SeekMode2[SeekMode2["Current"] = 1] = "Current";
      SeekMode2[SeekMode2["End"] = 2] = "End";
    })(SeekMode || (SeekMode = {}));
    FileHandle = class extends Resource {
      /**
       * Reads up to `p.byteLength` bytes into `p`. It resolves to the number of
       * bytes read (`0` < `n` <= `p.byteLength`) and rejects if any error
       * encountered. Even if `read()` resolves to `n` < `p.byteLength`, it may
       * use all of `p` as scratch space during the call. If some data is
       * available but not `p.byteLength` bytes, `read()` conventionally resolves
       * to what is available instead of waiting for more.
       *
       * When `read()` encounters end-of-file condition, it resolves to EOF
       * (`null`).
       *
       * When `read()` encounters an error, it rejects with an error.
       *
       * Callers should always process the `n` > `0` bytes returned before
       * considering the EOF (`null`). Doing so correctly handles I/O errors that
       * happen after reading some bytes and also both of the allowed EOF
       * behaviors.
       *
       * @example
       * ```typescript
       * import { open, BaseDirectory } from "@tauri-apps/plugin-fs"
       * // if "$APPCONFIG/foo/bar.txt" contains the text "hello world":
       * const file = await open("foo/bar.txt", { baseDir: BaseDirectory.AppConfig });
       * const buf = new Uint8Array(100);
       * const numberOfBytesRead = await file.read(buf); // 11 bytes
       * const text = new TextDecoder().decode(buf);  // "hello world"
       * await file.close();
       * ```
       *
       * @since 2.0.0
       */
      async read(buffer) {
        if (buffer.byteLength === 0) {
          return 0;
        }
        const data = await invoke("plugin:fs|read", {
          rid: this.rid,
          len: buffer.byteLength
        });
        const nread = fromBytes(data.slice(-8));
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
        buffer.set(bytes.slice(0, bytes.length - 8));
        return nread === 0 ? null : nread;
      }
      /**
       * Seek sets the offset for the next `read()` or `write()` to offset,
       * interpreted according to `whence`: `Start` means relative to the
       * start of the file, `Current` means relative to the current offset,
       * and `End` means relative to the end. Seek resolves to the new offset
       * relative to the start of the file.
       *
       * Seeking to an offset before the start of the file is an error. Seeking to
       * any positive offset is legal, but the behavior of subsequent I/O
       * operations on the underlying object is implementation-dependent.
       * It returns the number of cursor position.
       *
       * @example
       * ```typescript
       * import { open, SeekMode, BaseDirectory } from '@tauri-apps/plugin-fs';
       *
       * // Given hello.txt pointing to file with "Hello world", which is 11 bytes long:
       * const file = await open('hello.txt', { read: true, write: true, truncate: true, create: true, baseDir: BaseDirectory.AppLocalData });
       * await file.write(new TextEncoder().encode("Hello world"));
       *
       * // Seek 6 bytes from the start of the file
       * console.log(await file.seek(6, SeekMode.Start)); // "6"
       * // Seek 2 more bytes from the current position
       * console.log(await file.seek(2, SeekMode.Current)); // "8"
       * // Seek backwards 2 bytes from the end of the file
       * console.log(await file.seek(-2, SeekMode.End)); // "9" (e.g. 11-2)
       *
       * await file.close();
       * ```
       *
       * @since 2.0.0
       */
      async seek(offset, whence) {
        return await invoke("plugin:fs|seek", {
          rid: this.rid,
          offset,
          whence
        });
      }
      /**
       * Returns a {@linkcode FileInfo } for this file.
       *
       * @example
       * ```typescript
       * import { open, BaseDirectory } from '@tauri-apps/plugin-fs';
       * const file = await open("file.txt", { read: true, baseDir: BaseDirectory.AppLocalData });
       * const fileInfo = await file.stat();
       * console.log(fileInfo.isFile); // true
       * await file.close();
       * ```
       *
       * @since 2.0.0
       */
      async stat() {
        const res = await invoke("plugin:fs|fstat", {
          rid: this.rid
        });
        return parseFileInfo(res);
      }
      /**
       * Truncates or extends this file, to reach the specified `len`.
       * If `len` is not specified then the entire file contents are truncated.
       *
       * @example
       * ```typescript
       * import { open, BaseDirectory } from '@tauri-apps/plugin-fs';
       *
       * // truncate the entire file
       * const file = await open("my_file.txt", { read: true, write: true, create: true, baseDir: BaseDirectory.AppLocalData });
       * await file.truncate();
       *
       * // truncate part of the file
       * const file = await open("my_file.txt", { read: true, write: true, create: true, baseDir: BaseDirectory.AppLocalData });
       * await file.write(new TextEncoder().encode("Hello World"));
       * await file.truncate(7);
       * const data = new Uint8Array(32);
       * await file.read(data);
       * console.log(new TextDecoder().decode(data)); // Hello W
       * await file.close();
       * ```
       *
       * @since 2.0.0
       */
      async truncate(len) {
        await invoke("plugin:fs|ftruncate", {
          rid: this.rid,
          len
        });
      }
      /**
       * Writes `data.byteLength` bytes from `data` to the underlying data stream. It
       * resolves to the number of bytes written from `data` (`0` <= `n` <=
       * `data.byteLength`) or reject with the error encountered that caused the
       * write to stop early. `write()` must reject with a non-null error if
       * would resolve to `n` < `data.byteLength`. `write()` must not modify the
       * slice data, even temporarily.
       *
       * @example
       * ```typescript
       * import { open, write, BaseDirectory } from '@tauri-apps/plugin-fs';
       * const encoder = new TextEncoder();
       * const data = encoder.encode("Hello world");
       * const file = await open("bar.txt", { write: true, baseDir: BaseDirectory.AppLocalData });
       * const bytesWritten = await file.write(data); // 11
       * await file.close();
       * ```
       *
       * @since 2.0.0
       */
      async write(data) {
        return await invoke("plugin:fs|write", {
          rid: this.rid,
          data
        });
      }
    };
    Watcher = class extends Resource {
    };
  }
});

// components.tsx
import { useState as useState2, useMemo, useCallback, useEffect } from "react";
import { useAppStore, AppEvents } from "plugin-sdk";
import { Button as Button3, Input as Input2, Checkbox as Checkbox3, useKCDialog, toast, Select as Select2, SelectContent as SelectContent2, SelectItem as SelectItem2, SelectTrigger as SelectTrigger2, SelectValue as SelectValue2 } from "plugin-sdk";
import { suggestMinusWords } from "plugin-sdk";

// minus-words-matcher.ts
function buildBroadMatcher(words) {
  return (text) => words.some((w) => text.toLowerCase().includes(w));
}
function checkPhrase(text, exact, broadMatcher, word) {
  const lower = text.toLowerCase();
  if (exact.size > 0 && exact.has(lower)) return true;
  if (broadMatcher && broadMatcher(text)) return true;
  if (word.size > 0 && word.has(lower)) return true;
  return false;
}
function matchPhrases(phrases, minusWords, scopeGroupIds = null) {
  const globalExact = /* @__PURE__ */ new Set();
  const globalBroad = /* @__PURE__ */ new Set();
  const globalWord = /* @__PURE__ */ new Set();
  const groupExact = /* @__PURE__ */ new Map();
  const groupBroad = /* @__PURE__ */ new Map();
  const groupWord = /* @__PURE__ */ new Map();
  for (const mw of minusWords) {
    const lower = mw.text.toLowerCase();
    if (mw.groupId === null) {
      if (mw.isExact) {
        globalExact.add(lower);
      } else if (mw.searchType === "broad") {
        globalBroad.add(lower);
      } else {
        globalWord.add(lower);
      }
    } else {
      const eMap = mw.isExact ? groupExact : mw.searchType === "broad" ? groupBroad : groupWord;
      if (!eMap.has(mw.groupId)) eMap.set(mw.groupId, /* @__PURE__ */ new Set());
      eMap.get(mw.groupId).add(lower);
    }
  }
  const globalBroadMatcher = buildBroadMatcher(Array.from(globalBroad));
  const groupBroadMatchers = /* @__PURE__ */ new Map();
  for (const [gid, set] of groupBroad) groupBroadMatchers.set(gid, buildBroadMatcher(Array.from(set)));
  return phrases.filter((phrase) => {
    if (scopeGroupIds && !scopeGroupIds.has(phrase.groupId)) return false;
    if (checkPhrase(phrase.text, globalExact, globalBroadMatcher, globalWord)) return true;
    const gExact = groupExact.get(phrase.groupId);
    const gBroadMatcher = groupBroadMatchers.get(phrase.groupId) ?? null;
    const gWord = groupWord.get(phrase.groupId);
    if ((gExact?.size ?? 0) + (gBroadMatcher !== null ? 1 : 0) + (gWord?.size ?? 0) > 0) {
      return checkPhrase(phrase.text, gExact ?? /* @__PURE__ */ new Set(), gBroadMatcher, gWord ?? /* @__PURE__ */ new Set());
    }
    return false;
  });
}

// minus-words-scope.ts
function scopedMinusWords(minusWords, groupId) {
  if (groupId == null) return minusWords;
  return minusWords.filter((mw) => mw.groupId === groupId || mw.groupId == null);
}

// minus-word-row.tsx
import { Checkbox, Badge } from "plugin-sdk";
import { jsx, jsxs } from "react/jsx-runtime";
function MIcon({ name, className = "" }) {
  return /* @__PURE__ */ jsx("span", { className: `material-symbols-outlined ${className}`, children: name });
}
function MinusWordRow({ mw, isSelected, groupName, onToggle, onDelete }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 py-1 px-2 rounded-[2px] hover:bg-[var(--kc-surface-hover)] text-[12px]", children: [
    /* @__PURE__ */ jsx(
      Checkbox,
      {
        checked: isSelected,
        onCheckedChange: () => onToggle(mw.id),
        className: "shrink-0",
        style: { width: 14, height: 14 }
      }
    ),
    /* @__PURE__ */ jsx(
      Badge,
      {
        variant: mw.isExact ? "default" : "secondary",
        className: "text-[10px] px-1.5 py-0",
        style: mw.isExact ? { backgroundColor: "var(--kc-red)", color: "white" } : {},
        children: mw.isExact ? "\u0442\u043E\u0447\u043D." : mw.searchType === "broad" ? "\u0448\u0438\u0440\u043A." : "\u0441\u043B\u043E\u0432."
      }
    ),
    /* @__PURE__ */ jsx("span", { className: "flex-1 truncate", children: mw.text }),
    /* @__PURE__ */ jsx("span", { className: "text-[10px] text-[var(--kc-text-secondary)]", children: groupName }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "tool-btn !w-5 !h-5",
        style: { color: "var(--kc-red)" },
        onClick: () => onDelete(mw.id),
        children: /* @__PURE__ */ jsx(MIcon, { name: "close", className: "!text-[12px]" })
      }
    )
  ] });
}

// minus-words-list.tsx
import { useState } from "react";
import { Input, Button, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "plugin-sdk";
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function MIcon2({ name, className = "" }) {
  return /* @__PURE__ */ jsx2("span", { className: `material-symbols-outlined ${className}`, children: name });
}
function MinusWordsList({
  searchQuery,
  onSearchChange,
  minusWords,
  filteredCount,
  totalCount,
  selectedMwIds,
  allSelected,
  onToggleSelectAll,
  moveSelectedToGroup,
  minusWordGroups,
  handleBulkDelete,
  showMatched,
  onToggleMatched,
  matchedPhrases,
  groupedMinusWords,
  minusWordGroupsList,
  expandedGroups,
  onToggleGroup,
  editingGroupId,
  editingGroupName,
  onEditingGroupChange,
  onRenameGroup,
  onCopyGroup,
  onDeleteGroup,
  onToggleMw,
  onDeleteMw,
  groups
}) {
  const [folderValue, setFolderValue] = useState("__none__");
  return /* @__PURE__ */ jsxs2("div", { className: "flex-1 overflow-y-auto compact-scroll p-3 pt-1 space-y-2", children: [
    /* @__PURE__ */ jsxs2("div", { className: "relative", children: [
      /* @__PURE__ */ jsx2(MIcon2, { name: "search", className: "!text-[14px] absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" }),
      /* @__PURE__ */ jsx2(
        "input",
        {
          className: "w-full h-6 pl-7 pr-7 text-[11px] rounded-[3px] border border-[var(--border)] bg-[var(--bg-surface)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] focus:border-[var(--accent-blue)]",
          placeholder: "\u041D\u0430\u0439\u0442\u0438 \u043C\u0438\u043D\u0443\u0441-\u0444\u0440\u0430\u0437\u0443",
          value: searchQuery,
          onChange: (e) => onSearchChange(e.target.value)
        }
      ),
      searchQuery && /* @__PURE__ */ jsx2("button", { className: "absolute right-1 top-1/2 -translate-y-1/2 tool-btn !w-4 !h-4", onClick: () => onSearchChange(""), children: /* @__PURE__ */ jsx2(MIcon2, { name: "close", className: "!text-[12px]" }) })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "flex items-center justify-between min-h-[24px]", children: [
      /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-1", children: [
        selectedMwIds.size > 0 && /* @__PURE__ */ jsxs2(Fragment, { children: [
          /* @__PURE__ */ jsx2("span", { className: "text-[11px] text-[var(--kc-blue)] font-medium tabular-nums", children: selectedMwIds.size }),
          /* @__PURE__ */ jsxs2(
            Select,
            {
              value: folderValue,
              onValueChange: (v) => {
                if (v !== "__none__") moveSelectedToGroup(v === "__none2__" ? null : v);
                setFolderValue("__none__");
              },
              children: [
                /* @__PURE__ */ jsx2(SelectTrigger, { className: "h-5 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] text-[10px] w-auto max-w-[90px]", "aria-label": "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0432 \u043F\u0430\u043F\u043A\u0443", children: /* @__PURE__ */ jsx2(SelectValue, {}) }),
                /* @__PURE__ */ jsxs2(SelectContent, { children: [
                  /* @__PURE__ */ jsx2(SelectItem, { value: "__none__", disabled: true, children: "\u0432 \u043F\u0430\u043F\u043A\u0443..." }),
                  /* @__PURE__ */ jsx2(SelectItem, { value: "__none2__", children: "\u0411\u0435\u0437 \u043F\u0430\u043F\u043A\u0438" }),
                  minusWordGroups.map((g) => /* @__PURE__ */ jsx2(SelectItem, { value: g.id, children: g.name }, g.id))
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsx2("button", { className: "tool-btn !w-5 !h-5", style: { color: "var(--kc-red)" }, onClick: handleBulkDelete, title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0435", "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0435", children: /* @__PURE__ */ jsx2(MIcon2, { name: "delete", className: "!text-[14px]" }) })
        ] }),
        /* @__PURE__ */ jsx2("button", { className: "tool-btn !w-5 !h-5", onClick: onToggleSelectAll, title: allSelected ? "\u0421\u043D\u044F\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435" : "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0432\u0441\u0435", "aria-label": allSelected ? "\u0421\u043D\u044F\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435" : "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0432\u0441\u0435", disabled: minusWords.length === 0, children: /* @__PURE__ */ jsx2(MIcon2, { name: allSelected ? "deselect" : "select_all", className: "!text-[14px]" }) }),
        /* @__PURE__ */ jsx2("span", { className: "text-[12px] font-semibold ml-1", children: filteredCount }),
        searchQuery && /* @__PURE__ */ jsxs2("span", { className: "text-[10px] text-[var(--text-disabled)] ml-1", children: [
          "\u0438\u0437 ",
          totalCount
        ] })
      ] }),
      /* @__PURE__ */ jsx2(Button, { variant: "ghost", size: "sm", className: "h-5 text-[10px] gap-1 px-1", onClick: onToggleMatched, title: showMatched ? "\u0421\u043A\u0440\u044B\u0442\u044C \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u044F" : "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u044F", children: /* @__PURE__ */ jsx2(MIcon2, { name: showMatched ? "visibility_off" : "visibility", className: "!text-[14px]" }) })
    ] }),
    minusWords.length === 0 ? /* @__PURE__ */ jsx2("p", { className: "text-[12px] text-[var(--kc-text-secondary)] py-2", children: "\u041D\u0435\u0442 \u043C\u0438\u043D\u0443\u0441-\u0444\u0440\u0430\u0437" }) : /* @__PURE__ */ jsx2("div", { className: "space-y-1", children: (() => {
      const ungrouped = groupedMinusWords.get("__nogroup__") ?? [];
      return /* @__PURE__ */ jsxs2(Fragment, { children: [
        minusWordGroupsList.map((g) => {
          const items = groupedMinusWords.get(g.id) ?? [];
          const isExpanded = expandedGroups.has(g.id);
          return /* @__PURE__ */ jsxs2("div", { className: "border border-[var(--kc-border-light)] rounded-[3px] overflow-hidden", children: [
            /* @__PURE__ */ jsxs2(ContextMenu, { children: [
              /* @__PURE__ */ jsx2(ContextMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxs2(
                "div",
                {
                  className: "flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-[var(--kc-surface-hover)] cursor-pointer select-none",
                  onClick: () => onToggleGroup(g.id),
                  children: [
                    /* @__PURE__ */ jsx2(MIcon2, { name: isExpanded ? "expand_more" : "chevron_right", className: "!text-[14px]" }),
                    /* @__PURE__ */ jsx2("span", { className: "flex-1 truncate", children: g.name }),
                    /* @__PURE__ */ jsx2("span", { className: "text-[10px] text-[var(--kc-text-secondary)]", children: items.length }),
                    editingGroupId === g.id ? /* @__PURE__ */ jsxs2("div", { className: "flex gap-1 items-center", onClick: (e) => e.stopPropagation(), children: [
                      /* @__PURE__ */ jsx2(
                        Input,
                        {
                          className: "h-5 text-[11px] w-[100px] border-[var(--kc-border)]",
                          value: editingGroupName,
                          onChange: (e) => onEditingGroupChange(g.id, e.target.value),
                          onKeyDown: (e) => {
                            if (e.key === "Enter") onRenameGroup(g.id);
                            if (e.key === "Escape") onEditingGroupChange(null, "");
                          },
                          autoFocus: true
                        }
                      ),
                      /* @__PURE__ */ jsx2("button", { className: "tool-btn !w-4 !h-4", onClick: () => onRenameGroup(g.id), children: /* @__PURE__ */ jsx2(MIcon2, { name: "check", className: "!text-[11px]" }) })
                    ] }) : null
                  ]
                }
              ) }),
              /* @__PURE__ */ jsxs2(ContextMenuContent, { className: "text-[12px]", children: [
                /* @__PURE__ */ jsxs2(ContextMenuItem, { onClick: () => onEditingGroupChange(g.id, g.name), children: [
                  /* @__PURE__ */ jsx2(MIcon2, { name: "edit", className: "!text-[14px] mr-2" }),
                  " \u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C"
                ] }),
                /* @__PURE__ */ jsxs2(ContextMenuItem, { onClick: () => onToggleGroup(g.id), children: [
                  /* @__PURE__ */ jsx2(MIcon2, { name: isExpanded ? "expand_more" : "chevron_right", className: "!text-[14px] mr-2" }),
                  " ",
                  isExpanded ? "\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C" : "\u0420\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C"
                ] }),
                /* @__PURE__ */ jsxs2(ContextMenuItem, { onClick: () => onCopyGroup(g.id), children: [
                  /* @__PURE__ */ jsx2(MIcon2, { name: "content_copy", className: "!text-[14px] mr-2" }),
                  " \u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432 \u0431\u0443\u0444\u0435\u0440"
                ] }),
                /* @__PURE__ */ jsx2(ContextMenuSeparator, {}),
                /* @__PURE__ */ jsxs2(ContextMenuItem, { className: "text-[var(--kc-red)]", onClick: () => onDeleteGroup(g.id), children: [
                  /* @__PURE__ */ jsx2(MIcon2, { name: "delete", className: "!text-[14px] mr-2" }),
                  " \u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0430\u043F\u043A\u0443"
                ] })
              ] })
            ] }),
            isExpanded && /* @__PURE__ */ jsx2("div", { className: "space-y-0.5 p-1", children: items.map((mw) => /* @__PURE__ */ jsx2(
              MinusWordRow,
              {
                mw,
                isSelected: selectedMwIds.has(mw.id),
                groupName: groups.find((g2) => g2.id === mw.groupId)?.name ?? "\u0432\u0441\u0435",
                onToggle: onToggleMw,
                onDelete: onDeleteMw
              },
              mw.id
            )) })
          ] }, g.id);
        }),
        ungrouped.length > 0 && /* @__PURE__ */ jsxs2(Fragment, { children: [
          minusWordGroupsList.length > 0 && /* @__PURE__ */ jsx2("div", { className: "h-px bg-[var(--kc-border-light)] my-1" }),
          /* @__PURE__ */ jsx2("div", { className: "space-y-0.5", children: ungrouped.map((mw) => /* @__PURE__ */ jsx2(
            MinusWordRow,
            {
              mw,
              isSelected: selectedMwIds.has(mw.id),
              groupName: groups.find((g) => g.id === mw.groupId)?.name ?? "\u0432\u0441\u0435",
              onToggle: onToggleMw,
              onDelete: onDeleteMw
            },
            mw.id
          )) })
        ] })
      ] });
    })() }),
    showMatched && matchedPhrases.length > 0 && /* @__PURE__ */ jsxs2("div", { className: "border border-[var(--kc-red)] rounded-[3px] p-2", style: { backgroundColor: "var(--kc-red-light)" }, children: [
      /* @__PURE__ */ jsxs2("span", { className: "text-[12px] font-semibold", style: { color: "var(--kc-red)" }, children: [
        "\u0411\u0443\u0434\u0435\u0442 \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u043E \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443: ",
        matchedPhrases.length,
        " \u0444\u0440\u0430\u0437"
      ] }),
      /* @__PURE__ */ jsx2("div", { className: "mt-1 max-h-[150px] overflow-y-auto compact-scroll", children: matchedPhrases.map((p) => /* @__PURE__ */ jsx2("div", { className: "text-[11px] text-[var(--kc-text-secondary)] truncate", children: p.text }, p.id)) })
    ] })
  ] });
}

// minus-words-preview.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function MIcon3({ name, className = "" }) {
  return /* @__PURE__ */ jsx3("span", { className: `material-symbols-outlined ${className}`, children: name });
}
function MinusWordsPreview({ phrases, pendingRemoveIds, onToggleExclude, onCancel, onConfirm }) {
  const removeCount = phrases.length - pendingRemoveIds.size;
  return /* @__PURE__ */ jsxs3("div", { className: "border-t border-[var(--kc-border)] flex flex-col shrink-0", style: { maxHeight: "45%" }, children: [
    /* @__PURE__ */ jsxs3("div", { className: "flex items-center gap-2 px-3 py-2 shrink-0 bg-[var(--kc-surface)]", children: [
      /* @__PURE__ */ jsx3(MIcon3, { name: "preview", className: "!text-[13px] text-[var(--kc-blue)]" }),
      /* @__PURE__ */ jsxs3("span", { className: "text-[11px] font-semibold flex-1", children: [
        "\u0411\u0443\u0434\u0435\u0442 \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u043E \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443:",
        /* @__PURE__ */ jsxs3("strong", { className: "text-[var(--kc-red)] ml-1", children: [
          removeCount,
          " \u0444\u0440\u0430\u0437"
        ] }),
        pendingRemoveIds.size > 0 && /* @__PURE__ */ jsxs3("span", { className: "text-[var(--kc-text-secondary)] ml-1", children: [
          "(\u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u043E: ",
          pendingRemoveIds.size,
          ")"
        ] })
      ] }),
      /* @__PURE__ */ jsx3("button", { className: "tool-btn !w-5 !h-5", onClick: onCancel, title: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440", "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440", children: /* @__PURE__ */ jsx3(MIcon3, { name: "close", className: "!text-[12px]" }) })
    ] }),
    /* @__PURE__ */ jsx3("div", { className: "flex-1 overflow-y-auto min-h-0 px-2 py-1 space-y-0.5 compact-scroll", children: phrases.length === 0 ? /* @__PURE__ */ jsxs3("div", { className: "text-[12px] text-[var(--kc-text-secondary)] text-center py-4", children: [
      /* @__PURE__ */ jsx3(MIcon3, { name: "check_circle", className: "!text-[20px] text-[var(--kc-green)] block mx-auto mb-1" }),
      "\u041D\u0435\u0442 \u0444\u0440\u0430\u0437, \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0445 \u043F\u043E\u0434 \u043C\u0438\u043D\u0443\u0441-\u0441\u043B\u043E\u0432\u0430"
    ] }) : phrases.map((p) => {
      const isExcluded = pendingRemoveIds.has(p.id);
      return /* @__PURE__ */ jsxs3("div", { className: `text-[11px] py-0.5 px-1.5 rounded flex items-center gap-1.5 ${isExcluded ? "opacity-40 line-through" : "hover:bg-[var(--kc-surface-hover)]"}`, children: [
        /* @__PURE__ */ jsx3(
          "button",
          {
            className: "shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--kc-border)]",
            title: isExcluded ? "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u0432 \u0441\u043F\u0438\u0441\u043E\u043A" : "\u0418\u0441\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0438\u0437 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F",
            onClick: () => onToggleExclude(p.id),
            children: /* @__PURE__ */ jsx3(MIcon3, { name: isExcluded ? "undo" : "close", className: `!text-[11px] ${isExcluded ? "text-[var(--kc-text-secondary)]" : "text-[var(--kc-red)]"}` })
          }
        ),
        /* @__PURE__ */ jsx3("span", { className: "truncate", children: p.text })
      ] }, p.id);
    }) }),
    /* @__PURE__ */ jsxs3("div", { className: "flex gap-2 px-3 py-2 shrink-0 border-t border-[var(--kc-border)]", children: [
      /* @__PURE__ */ jsx3(
        "button",
        {
          className: "flex-1 h-7 text-[12px] rounded border border-[var(--kc-border)] bg-[var(--kc-surface)] hover:bg-[var(--kc-surface-hover)] text-[var(--kc-text)]",
          onClick: onCancel,
          children: "\u041E\u0442\u043C\u0435\u043D\u0430"
        }
      ),
      /* @__PURE__ */ jsxs3(
        "button",
        {
          className: "flex-1 h-7 text-[12px] rounded bg-[var(--kc-red)] text-white hover:opacity-90 disabled:opacity-40",
          disabled: removeCount === 0,
          onClick: onConfirm,
          children: [
            "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C ",
            removeCount,
            " \u0444\u0440\u0430\u0437"
          ]
        }
      )
    ] })
  ] });
}

// minus-words-suggest-modal.tsx
import { Checkbox as Checkbox2 } from "plugin-sdk";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function MIcon4({ name, className = "" }) {
  return /* @__PURE__ */ jsx4("span", { className: `material-symbols-outlined ${className}`, children: name });
}
function MinusWordsSuggestModal({ results, isWordAdded, onAddWord, onAddAll, onClose }) {
  return /* @__PURE__ */ jsx4("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/30", onClick: onClose, children: /* @__PURE__ */ jsxs4("div", { className: "w-[450px] max-h-[70vh] flex flex-col rounded-[6px] shadow-lg border", style: { backgroundColor: "var(--kc-surface)", borderColor: "var(--kc-border)" }, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxs4("div", { className: "flex items-center justify-between px-3 py-2 border-b shrink-0", style: { borderColor: "var(--kc-border-light)" }, children: [
      /* @__PURE__ */ jsx4("span", { className: "text-[12px] font-semibold", children: "\u041F\u043E\u0434\u043E\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u043C\u0438\u043D\u0443\u0441-\u0441\u043B\u043E\u0432\u0430" }),
      /* @__PURE__ */ jsx4("button", { className: "tool-btn !w-5 !h-5", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: /* @__PURE__ */ jsx4(MIcon4, { name: "close", className: "!text-[12px]" }) })
    ] }),
    /* @__PURE__ */ jsx4("div", { className: "flex-1 overflow-y-auto compact-scroll p-2 space-y-0.5", children: results.map((r, i) => {
      const exists2 = isWordAdded(r.word);
      return /* @__PURE__ */ jsxs4("div", { className: "flex items-center gap-2 py-1 px-2 rounded-[2px] hover:bg-[var(--kc-surface-hover)] text-[12px]", children: [
        /* @__PURE__ */ jsx4(
          Checkbox2,
          {
            checked: !exists2,
            disabled: exists2,
            onCheckedChange: () => onAddWord(r.word)
          }
        ),
        /* @__PURE__ */ jsx4("span", { className: `flex-1 truncate ${exists2 ? "text-[var(--kc-text-disabled)] line-through" : ""}`, children: r.word }),
        /* @__PURE__ */ jsx4("span", { className: "text-[10px] px-1 rounded", style: { backgroundColor: r.source === "dictionary" ? "var(--kc-blue-light)" : "var(--kc-surface-hover)" }, children: r.source }),
        /* @__PURE__ */ jsxs4("span", { className: "text-[10px] text-[var(--kc-text-secondary)]", children: [
          (r.confidence * 100).toFixed(0),
          "%"
        ] }),
        /* @__PURE__ */ jsx4(
          "button",
          {
            className: "tool-btn !w-5 !h-5",
            disabled: exists2,
            onClick: () => onAddWord(r.word),
            title: exists2 ? "\u0423\u0436\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E" : "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C",
            children: /* @__PURE__ */ jsx4(MIcon4, { name: "add_circle", className: "!text-[13px]" })
          }
        )
      ] }, `${r.word}-${i}`);
    }) }),
    /* @__PURE__ */ jsxs4("div", { className: "flex gap-2 px-3 py-2 border-t shrink-0", style: { borderColor: "var(--kc-border-light)" }, children: [
      /* @__PURE__ */ jsx4("button", { className: "flex-1 h-7 text-[11px] rounded border border-[var(--kc-border)] bg-transparent hover:bg-[var(--kc-surface-hover)]", onClick: onClose, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" }),
      /* @__PURE__ */ jsxs4("button", { className: "flex-1 h-7 text-[11px] rounded text-white", style: { backgroundColor: "var(--kc-blue)" }, onClick: onAddAll, children: [
        "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u0441\u0435 (",
        results.length,
        ")"
      ] })
    ] })
  ] }) });
}

// minus-words-import-dialog.tsx
import { Button as Button2, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "plugin-sdk";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function MIcon5({ name, className = "" }) {
  return /* @__PURE__ */ jsx5("span", { className: `material-symbols-outlined ${className}`, children: name });
}
function MinusWordsImportDialog({ open: open3, text, preview, onOpenChange, onTextChange, onParse, onImportTxt, onConfirm }) {
  return /* @__PURE__ */ jsx5(Dialog, { open: open3, onOpenChange: (v) => {
    onOpenChange(v);
  }, children: /* @__PURE__ */ jsxs5(DialogContent, { className: "max-w-lg max-h-[70vh] flex flex-col", children: [
    /* @__PURE__ */ jsx5(DialogHeader, { children: /* @__PURE__ */ jsx5(DialogTitle, { children: "\u0418\u043C\u043F\u043E\u0440\u0442 \u043C\u0438\u043D\u0443\u0441-\u0444\u0440\u0430\u0437" }) }),
    /* @__PURE__ */ jsxs5("div", { className: "space-y-3 flex-1 flex flex-col min-h-0", children: [
      /* @__PURE__ */ jsxs5("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxs5(Button2, { variant: "outline", size: "sm", className: "h-6 text-[10px] gap-1", onClick: onImportTxt, children: [
          /* @__PURE__ */ jsx5(MIcon5, { name: "file_upload", className: "!text-[12px]" }),
          " \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C .txt"
        ] }),
        /* @__PURE__ */ jsx5("span", { className: "text-[10px] text-[var(--kc-text-secondary)]", children: "\u0438\u043B\u0438 \u0432\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0442\u0435\u043A\u0441\u0442 \u043D\u0438\u0436\u0435" })
      ] }),
      /* @__PURE__ */ jsx5(
        "textarea",
        {
          className: "w-full min-h-[120px] flex-1 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 py-1.5 text-[12px] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--kc-blue)] focus:border-[var(--kc-blue)]",
          value: text,
          onChange: (e) => {
            onTextChange(e.target.value);
          },
          placeholder: "\u043C\u0438\u043D\u0443\u0441-\u0441\u043B\u043E\u0432\u043E1\n\u043C\u0438\u043D\u0443\u0441-\u0441\u043B\u043E\u0432\u043E2, \u043C\u0438\u043D\u0443\u0441-\u0441\u043B\u043E\u0432\u043E3\n\u0441\u043B\u043E\u0432\u043E4;	\u0441\u043B\u043E\u0432\u043E5"
        }
      ),
      /* @__PURE__ */ jsxs5("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxs5(Button2, { size: "sm", className: "h-7 text-[11px] px-3", onClick: onParse, disabled: !text.trim(), children: [
          /* @__PURE__ */ jsx5(MIcon5, { name: "preview", className: "!text-[14px] mr-1" }),
          " \u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440"
        ] }),
        preview && /* @__PURE__ */ jsxs5("div", { className: "flex items-center gap-3 text-[10px] text-[var(--kc-text-secondary)]", children: [
          /* @__PURE__ */ jsxs5("span", { className: "text-[var(--kc-blue)] font-semibold", children: [
            preview.words.length,
            " \u043D\u043E\u0432\u044B\u0445"
          ] }),
          preview.duplicates > 0 && /* @__PURE__ */ jsxs5("span", { className: "text-[var(--kc-yellow)]", children: [
            preview.duplicates,
            " \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u043E\u0432"
          ] }),
          preview.empty > 0 && /* @__PURE__ */ jsxs5("span", { className: "text-[var(--kc-text-dimmed)]", children: [
            preview.empty,
            " \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E"
          ] })
        ] })
      ] }),
      preview && preview.words.length > 0 && /* @__PURE__ */ jsxs5("div", { className: "border border-[var(--kc-border)] rounded-[3px] overflow-y-auto max-h-[150px] compact-scroll p-1", children: [
        preview.words.slice(0, 100).map((w, i) => /* @__PURE__ */ jsx5("div", { className: "text-[11px] py-0.5 px-1 truncate", children: w }, `${w}-${i}`)),
        preview.words.length > 100 && /* @__PURE__ */ jsxs5("div", { className: "text-[10px] text-[var(--kc-text-disabled)] px-1 py-0.5", children: [
          "... \u0438 \u0435\u0449\u0451 ",
          preview.words.length - 100
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs5(DialogFooter, { className: "gap-2 mt-2", children: [
      /* @__PURE__ */ jsx5(Button2, { variant: "outline", onClick: () => onOpenChange(false), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }),
      /* @__PURE__ */ jsxs5(Button2, { onClick: onConfirm, disabled: !preview || preview.words.length === 0, children: [
        "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C ",
        preview?.words.length ?? 0
      ] })
    ] })
  ] }) });
}

// components.tsx
import { Fragment as Fragment2, jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
function collectGroupIds(gid, groups) {
  const ids = /* @__PURE__ */ new Set();
  const walk = (id) => {
    ids.add(id);
    groups.filter((g) => g.parentId === id).forEach((g) => walk(g.id));
  };
  walk(gid);
  return ids;
}
function MinusWordsPanel({ ctx }) {
  const minusWords = useAppStore((s) => s.minusWords);
  const minusWordGroups = useAppStore((s) => s.minusWordGroups);
  const addMinusWord = useAppStore((s) => s.addMinusWord);
  const removeMinusWord = useAppStore((s) => s.removeMinusWord);
  const setMinusWordMwGroup = useAppStore((s) => s.setMinusWordMwGroup);
  const applyMinusWords = useAppStore((s) => s.applyMinusWords);
  const previewMinusWords = useAppStore((s) => s.previewMinusWords);
  const createMinusWordGroup = useAppStore((s) => s.createMinusWordGroup);
  const renameMinusWordGroup = useAppStore((s) => s.renameMinusWordGroup);
  const deleteMinusWordGroup = useAppStore((s) => s.deleteMinusWordGroup);
  const groups = useAppStore((s) => s.groups);
  const phrases = useAppStore((s) => s.phrases);
  const activeGroupId = useAppStore((s) => s.activeGroupId);
  const kcDialog = useKCDialog();
  const [newWord, setNewWord] = useState2("");
  const [isExact, setIsExact] = useState2(false);
  const [searchType, setSearchType] = useState2(minusWordsSettings.broadMatch ? "broad" : "broad_modified");
  const [targetGroupId, setTargetGroupId] = useState2(activeGroupId);
  const [mwGroupId, setMwGroupId] = useState2(null);
  const [showMatched, setShowMatched] = useState2(false);
  const [applyResult, setApplyResult] = useState2(null);
  const [previewData, setPreviewData] = useState2(null);
  const [pendingRemoveIds, setPendingRemoveIds] = useState2(/* @__PURE__ */ new Set());
  const [showImportDialog, setShowImportDialog] = useState2(false);
  const [importText, setImportText] = useState2("");
  const [importPreview, setImportPreview] = useState2(null);
  const [newGroupName, setNewGroupName] = useState2("");
  const [showNewGroupInput, setShowNewGroupInput] = useState2(false);
  const [editingGroupId, setEditingGroupId] = useState2(null);
  const [showSuggest, setShowSuggest] = useState2(false);
  const [suggestions, setSuggestions] = useState2({ results: [], loading: false });
  const [editingGroupName, setEditingGroupName] = useState2("");
  const [expandedGroups, setExpandedGroups] = useState2(() => new Set(minusWordGroups.map((g) => g.id)));
  const [searchQuery, setSearchQuery] = useState2("");
  const [selectedMwIds, setSelectedMwIds] = useState2(/* @__PURE__ */ new Set());
  useEffect(() => {
    setTargetGroupId(activeGroupId);
  }, [activeGroupId]);
  const scopeGroupIds = useMemo(
    () => targetGroupId ? collectGroupIds(targetGroupId, groups) : null,
    [targetGroupId, groups]
  );
  const scopeGroupName = useMemo(
    () => targetGroupId ? groups.find((g) => g.id === targetGroupId)?.name ?? null : null,
    [targetGroupId, groups]
  );
  const visibleMinusWords = useMemo(
    () => scopedMinusWords(minusWords, targetGroupId),
    [minusWords, targetGroupId]
  );
  const filteredMinusWords = useMemo(() => {
    if (!searchQuery.trim()) return visibleMinusWords;
    const q = searchQuery.trim().toLowerCase();
    return visibleMinusWords.filter((mw) => mw.text.toLowerCase().includes(q));
  }, [visibleMinusWords, searchQuery]);
  const toggleMwSelection = (id) => {
    setSelectedMwIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const handleDeleteWord = (id) => {
    setSelectedMwIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    removeMinusWord(id);
  };
  const handleBulkDelete = async () => {
    if (selectedMwIds.size === 0) return;
    const ok = await kcDialog.confirm(`\u0423\u0434\u0430\u043B\u0438\u0442\u044C ${selectedMwIds.size} \u043C\u0438\u043D\u0443\u0441-\u0444\u0440\u0430\u0437?`, { title: "\u0423\u0434\u0430\u043B\u0435\u043D\u0438\u0435", confirmLabel: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", variant: "destructive" });
    if (!ok) return;
    for (const id of selectedMwIds) removeMinusWord(id);
    setSelectedMwIds(/* @__PURE__ */ new Set());
  };
  const moveSelectedToGroup = (targetMwGroupId) => {
    for (const id of selectedMwIds) setMinusWordMwGroup(id, targetMwGroupId);
    setSelectedMwIds(/* @__PURE__ */ new Set());
  };
  const allMwSelected = visibleMinusWords.length > 0 && selectedMwIds.size === visibleMinusWords.length;
  const toggleSelectAllMw = () => {
    if (allMwSelected) setSelectedMwIds(/* @__PURE__ */ new Set());
    else setSelectedMwIds(new Set(visibleMinusWords.map((mw) => mw.id)));
  };
  const copyMwGroupToClipboard = async (groupId) => {
    const items = visibleMinusWords.filter((mw) => (mw.mwGroupId ?? null) === groupId);
    const text = items.map((mw) => mw.text).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E: ${items.length} \u043C\u0438\u043D\u0443\u0441-\u0444\u0440\u0430\u0437`, duration: 2e3 });
    } catch {
    }
  };
  const handleAdd = () => {
    if (!newWord.trim()) return;
    addMinusWord(newWord.trim(), isExact, targetGroupId, searchType, mwGroupId);
    setNewWord("");
  };
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    createMinusWordGroup(newGroupName.trim());
    setNewGroupName("");
    setShowNewGroupInput(false);
  };
  const handleRenameGroup = (id) => {
    if (!editingGroupName.trim()) return;
    renameMinusWordGroup(id, editingGroupName.trim());
    setEditingGroupId(null);
    setEditingGroupName("");
  };
  const handleDeleteGroup = async (id) => {
    if (!await kcDialog.confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443 \u043C\u0438\u043D\u0443\u0441-\u0444\u0440\u0430\u0437?", { title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443", confirmLabel: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", variant: "destructive" })) return;
    deleteMinusWordGroup(id);
  };
  const groupedMinusWords = useMemo(() => {
    const groupsMap = /* @__PURE__ */ new Map();
    for (const mw of filteredMinusWords) {
      const key = mw.mwGroupId ?? "__nogroup__";
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key).push(mw);
    }
    return groupsMap;
  }, [filteredMinusWords]);
  const [exportCopied, setExportCopied] = useState2(false);
  const handleApply = () => {
    const preview = previewMinusWords(scopeGroupIds);
    setPreviewData(preview);
    setPendingRemoveIds(/* @__PURE__ */ new Set());
  };
  const handleConfirmApply = () => {
    if (!previewData) return;
    setPreviewData(null);
    setPendingRemoveIds(/* @__PURE__ */ new Set());
    const toRemove = previewData.phrases.filter((p) => !pendingRemoveIds.has(p.id)).map((p) => p.id);
    if (toRemove.length > 0) {
      ctx.store.dispatch("moveToTrash", toRemove);
      setApplyResult({ removed: toRemove.length, groups: [] });
      ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
      ctx.eventBus.emit(AppEvents.MINUS_WORDS_CHANGED);
      setTimeout(() => setApplyResult(null), 5e3);
    }
  };
  const handleImportParse = useCallback((raw) => {
    const lines = raw.split("\n");
    const words = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/[,;\t]+/);
      for (const part of parts) {
        const w = part.trim().replace(/\s+/g, " ");
        if (w) words.push(w);
      }
    }
    const existing = new Set(minusWords.map((mw) => mw.text.toLowerCase()));
    const unique = [];
    let duplicates = 0;
    for (const w of words) {
      if (existing.has(w.toLowerCase())) duplicates++;
      else if (!unique.some((u) => u.toLowerCase() === w.toLowerCase())) unique.push(w);
    }
    setImportPreview({ words: unique, duplicates, empty: words.length - unique.length - duplicates });
  }, [minusWords]);
  const handleImportConfirm = useCallback(() => {
    if (!importPreview || importPreview.words.length === 0) return;
    for (const w of importPreview.words) addMinusWord(w, isExact, targetGroupId, searchType, mwGroupId);
    setShowImportDialog(false);
    setImportText("");
    setImportPreview(null);
    toast({ title: `\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043E: ${importPreview.words.length} \u043C\u0438\u043D\u0443\u0441-\u0444\u0440\u0430\u0437`, duration: 2e3 });
    ctx.eventBus.emit(AppEvents.MINUS_WORDS_CHANGED);
  }, [importPreview, addMinusWord, isExact, targetGroupId, searchType, mwGroupId, ctx.eventBus]);
  const handleImportTxt = useCallback(async () => {
    try {
      const { open: open3 } = await Promise.resolve().then(() => (init_dist_js(), dist_js_exports));
      const { readTextFile: readTextFile2 } = await Promise.resolve().then(() => (init_dist_js2(), dist_js_exports2));
      const path = await open3({ filters: [{ name: "Text Files", extensions: ["txt"] }], multiple: false });
      if (!path) return;
      const content = await readTextFile2(path);
      setImportText(content);
      handleImportParse(content);
    } catch {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".txt";
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const content = await file.text();
        setImportText(content);
        handleImportParse(content);
      };
      input.click();
    }
  }, [handleImportParse]);
  const handleCopyClipboard = async () => {
    const text = visibleMinusWords.map((mw) => mw.text).join(", ");
    try {
      await navigator.clipboard.writeText(text);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2e3);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2e3);
    }
  };
  const handleExportTxt = async () => {
    try {
      const { save: save2 } = await Promise.resolve().then(() => (init_dist_js(), dist_js_exports));
      const { writeTextFile: writeTextFile2 } = await Promise.resolve().then(() => (init_dist_js2(), dist_js_exports2));
      const path = await save2({ filters: [{ name: "Text Files", extensions: ["txt"] }], defaultPath: "minus-words.txt" });
      if (!path) return;
      await writeTextFile2(path, visibleMinusWords.map((mw) => mw.text).join("\n"));
    } catch {
      const blob = new Blob([visibleMinusWords.map((mw) => mw.text).join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "minus-words.txt";
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  const matchedPhrases = useMemo(() => {
    if (!showMatched) return [];
    return matchPhrases(phrases, minusWords, scopeGroupIds);
  }, [showMatched, phrases, minusWords, scopeGroupIds]);
  const handleSuggest = useCallback(async () => {
    setSuggestions((prev) => ({ ...prev, loading: true }));
    try {
      const results = suggestMinusWords(phrases, groups, { maxResults: 50 });
      setSuggestions({ results, loading: false });
      setShowSuggest(true);
    } catch {
      setSuggestions({ results: [], loading: false });
    }
  }, [phrases, groups]);
  const handleAddSuggestedWord = useCallback((word) => {
    addMinusWord(word, false, targetGroupId, "broad_modified", null);
    toast({ title: `\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E: ${word}`, duration: 1500 });
  }, [addMinusWord, targetGroupId]);
  const handleAddAllSuggested = useCallback(() => {
    for (const r of suggestions.results) {
      const exists2 = minusWords.some((mw) => mw.text.toLowerCase() === r.word.toLowerCase());
      if (!exists2) addMinusWord(r.word, false, targetGroupId, "broad_modified", null);
    }
    setShowSuggest(false);
    toast({ title: `\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E: ${suggestions.results.length} \u043C\u0438\u043D\u0443\u0441-\u0441\u043B\u043E\u0432`, duration: 2e3 });
  }, [suggestions.results, addMinusWord, minusWords, targetGroupId]);
  return /* @__PURE__ */ jsxs6("div", { className: "h-full flex flex-col", style: { maxWidth: "100%", width: "100%" }, children: [
    /* @__PURE__ */ jsxs6("div", { className: "shrink-0 p-3 pb-2 space-y-2", children: [
      /* @__PURE__ */ jsxs6("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx6(
          Input2,
          {
            className: "h-7 text-[12px] border-[var(--kc-border)]",
            placeholder: "\u041C\u0438\u043D\u0443\u0441-\u0444\u0440\u0430\u0437\u0430 \u0438\u043B\u0438 \u0441\u043B\u043E\u0432\u043E...",
            value: newWord,
            onChange: (e) => setNewWord(e.target.value),
            onKeyDown: (e) => e.key === "Enter" && handleAdd()
          }
        ),
        /* @__PURE__ */ jsx6(
          Button3,
          {
            size: "sm",
            className: "h-7 px-3",
            onClick: handleAdd,
            disabled: !newWord.trim(),
            style: { backgroundColor: "var(--kc-blue)", color: "white" },
            children: /* @__PURE__ */ jsx6(MIcon, { name: "add", className: "!text-[16px]" })
          }
        )
      ] }),
      /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxs6("label", { className: "flex items-center gap-1.5 text-[11px]", children: [
          /* @__PURE__ */ jsx6(Checkbox3, { checked: isExact, onCheckedChange: (v) => setIsExact(!!v) }),
          "\u0422\u043E\u0447\u043D\u0430\u044F \u0444\u0440\u0430\u0437\u0430"
        ] }),
        /* @__PURE__ */ jsxs6(Select2, { value: searchType, onValueChange: (v) => setSearchType(v), children: [
          /* @__PURE__ */ jsx6(SelectTrigger2, { className: "h-6 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 text-[11px]", "aria-label": "\u0422\u0438\u043F \u043F\u043E\u0438\u0441\u043A\u0430", children: /* @__PURE__ */ jsx6(SelectValue2, {}) }),
          /* @__PURE__ */ jsxs6(SelectContent2, { children: [
            /* @__PURE__ */ jsx6(SelectItem2, { value: "broad", children: "\u0428\u0438\u0440\u043E\u043A\u0438\u0439 \u043F\u043E\u0438\u0441\u043A" }),
            /* @__PURE__ */ jsx6(SelectItem2, { value: "broad_modified", children: "\u041F\u043E \u0441\u043B\u043E\u0432\u0430\u043C" }),
            /* @__PURE__ */ jsx6(SelectItem2, { value: "exact", children: "\u0422\u043E\u0447\u043D\u043E\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs6(Select2, { value: targetGroupId ?? "global", onValueChange: (v) => setTargetGroupId(v === "global" ? null : v), children: [
        /* @__PURE__ */ jsx6(SelectTrigger2, { className: "w-full h-6 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 text-[11px]", "aria-label": "\u0413\u0440\u0443\u043F\u043F\u0430 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u044F", children: /* @__PURE__ */ jsx6(SelectValue2, {}) }),
        /* @__PURE__ */ jsxs6(SelectContent2, { children: [
          /* @__PURE__ */ jsx6(SelectItem2, { value: "global", children: "\u0413\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u043E (\u0432\u0441\u0435 \u0433\u0440\u0443\u043F\u043F\u044B)" }),
          groups.filter((g) => !g.isTrash).map((g) => /* @__PURE__ */ jsx6(SelectItem2, { value: g.id, children: g.name }, g.id))
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx6("div", { className: "h-px bg-[var(--kc-border-light)] mx-3" }),
    /* @__PURE__ */ jsx6("div", { className: "flex items-center gap-1 px-3 pt-2", children: !showNewGroupInput ? /* @__PURE__ */ jsxs6(Button3, { variant: "ghost", size: "sm", className: "h-5 text-[10px] gap-1 px-1", onClick: () => setShowNewGroupInput(true), children: [
      /* @__PURE__ */ jsx6(MIcon, { name: "create_new_folder", className: "!text-[12px]" }),
      " \u041D\u043E\u0432\u0430\u044F \u043F\u0430\u043F\u043A\u0430"
    ] }) : /* @__PURE__ */ jsxs6("div", { className: "flex gap-1 items-center flex-1", children: [
      /* @__PURE__ */ jsx6(
        Input2,
        {
          className: "h-6 text-[11px] border-[var(--kc-border)] flex-1",
          placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u0430\u043F\u043A\u0438...",
          value: newGroupName,
          onChange: (e) => setNewGroupName(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") handleCreateGroup();
            if (e.key === "Escape") setShowNewGroupInput(false);
          },
          autoFocus: true
        }
      ),
      /* @__PURE__ */ jsx6(
        Button3,
        {
          size: "sm",
          className: "h-6 px-2 text-[10px]",
          onClick: handleCreateGroup,
          disabled: !newGroupName.trim(),
          style: { backgroundColor: "var(--kc-blue)", color: "white" },
          children: /* @__PURE__ */ jsx6(MIcon, { name: "check", className: "!text-[12px]" })
        }
      ),
      /* @__PURE__ */ jsx6(
        Button3,
        {
          variant: "ghost",
          size: "sm",
          className: "h-6 px-1 text-[10px]",
          onClick: () => {
            setShowNewGroupInput(false);
            setNewGroupName("");
          },
          children: /* @__PURE__ */ jsx6(MIcon, { name: "close", className: "!text-[12px]" })
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-1.5 px-3 pt-2 pb-1", children: [
      /* @__PURE__ */ jsx6(MIcon, { name: scopeGroupName ? "filter_alt" : "all_inbox", className: "!text-[13px] text-[var(--text-secondary)]" }),
      /* @__PURE__ */ jsx6("span", { className: "text-[11px] text-[var(--text-secondary)] truncate", children: scopeGroupName ? `\u0421\u043F\u0438\u0441\u043E\u043A: \u0433\u0440\u0443\u043F\u043F\u0430 \xAB${scopeGroupName}\xBB + \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0435` : "\u0421\u043F\u0438\u0441\u043E\u043A: \u0432\u0441\u0435 \u043C\u0438\u043D\u0443\u0441-\u0444\u0440\u0430\u0437\u044B" })
    ] }),
    /* @__PURE__ */ jsx6(
      MinusWordsList,
      {
        searchQuery,
        onSearchChange: setSearchQuery,
        minusWords: visibleMinusWords,
        filteredCount: filteredMinusWords.length,
        totalCount: visibleMinusWords.length,
        selectedMwIds,
        allSelected: allMwSelected,
        onToggleSelectAll: toggleSelectAllMw,
        moveSelectedToGroup,
        minusWordGroups,
        handleBulkDelete,
        showMatched,
        onToggleMatched: () => setShowMatched(!showMatched),
        matchedPhrases,
        groupedMinusWords,
        minusWordGroupsList: minusWordGroups,
        expandedGroups,
        onToggleGroup: (id) => setExpandedGroups((prev) => {
          const n = new Set(prev);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        }),
        editingGroupId,
        editingGroupName,
        onEditingGroupChange: (id, name) => {
          setEditingGroupId(id);
          setEditingGroupName(name);
        },
        onRenameGroup: handleRenameGroup,
        onCopyGroup: copyMwGroupToClipboard,
        onDeleteGroup: handleDeleteGroup,
        onToggleMw: toggleMwSelection,
        onDeleteMw: handleDeleteWord,
        groups
      }
    ),
    previewData ? /* @__PURE__ */ jsx6(
      MinusWordsPreview,
      {
        phrases: previewData.phrases,
        pendingRemoveIds,
        onToggleExclude: (id) => setPendingRemoveIds((prev) => {
          const n = new Set(prev);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        }),
        onCancel: () => {
          setPreviewData(null);
          setPendingRemoveIds(/* @__PURE__ */ new Set());
        },
        onConfirm: handleConfirmApply
      }
    ) : /* @__PURE__ */ jsxs6("div", { className: "shrink-0 border-t border-[var(--kc-border-light)] p-3 pt-2 space-y-2", style: { background: "var(--kc-bg, var(--kc-surface))" }, children: [
      /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxs6(Button3, { variant: "outline", size: "sm", className: "h-6 text-[10px] flex-1 gap-1", onClick: () => setShowImportDialog(true), children: [
          /* @__PURE__ */ jsx6(MIcon, { name: "file_upload", className: "!text-[12px]" }),
          " \u0418\u043C\u043F\u043E\u0440\u0442 \u0441\u043F\u0438\u0441\u043A\u0430"
        ] }),
        minusWords.length > 0 && /* @__PURE__ */ jsxs6(Fragment2, { children: [
          /* @__PURE__ */ jsxs6(Button3, { variant: "outline", size: "sm", className: "h-6 text-[10px] flex-1 gap-1", onClick: handleCopyClipboard, children: [
            /* @__PURE__ */ jsx6(MIcon, { name: exportCopied ? "check" : "content_copy", className: "!text-[12px]" }),
            exportCopied ? "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E" : "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C"
          ] }),
          /* @__PURE__ */ jsxs6(Button3, { variant: "outline", size: "sm", className: "h-6 text-[10px] flex-1 gap-1", onClick: handleExportTxt, children: [
            /* @__PURE__ */ jsx6(MIcon, { name: "save_alt", className: "!text-[12px]" }),
            " \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C TXT"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs6("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxs6(
          "button",
          {
            className: "flex-1 h-7 text-[11px] rounded border border-[var(--kc-blue)] bg-transparent text-[var(--kc-blue)] hover:bg-[var(--kc-blue)] hover:text-white transition-colors flex items-center justify-center gap-1",
            onClick: handleSuggest,
            disabled: suggestions.loading,
            children: [
              /* @__PURE__ */ jsx6(MIcon, { name: "lightbulb", className: "!text-[13px]" }),
              suggestions.loading ? "\u0410\u043D\u0430\u043B\u0438\u0437..." : "\u041F\u043E\u0434\u043E\u0431\u0440\u0430\u0442\u044C \u043C\u0438\u043D\u0443\u0441-\u0441\u043B\u043E\u0432\u0430"
            ]
          }
        ),
        /* @__PURE__ */ jsxs6(
          "button",
          {
            className: "w-[90px] h-7 bg-[var(--kc-red)] text-white text-[12px] rounded hover:opacity-90 flex items-center justify-center gap-1 disabled:opacity-40",
            onClick: handleApply,
            disabled: minusWords.length === 0,
            children: [
              /* @__PURE__ */ jsx6(MIcon, { name: "block", className: "!text-[13px]" }),
              " \u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C"
            ]
          }
        )
      ] }),
      applyResult && /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-2 p-2 rounded-[3px] text-[12px]", style: { backgroundColor: "var(--kc-green-light)", color: "var(--kc-green)" }, children: [
        /* @__PURE__ */ jsx6(MIcon, { name: "check_circle", className: "!text-[16px]" }),
        "\u041F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u043E \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443: ",
        applyResult.removed,
        " \u0444\u0440\u0430\u0437 \u0438\u0437 ",
        applyResult.groups.length,
        " \u0433\u0440\u0443\u043F\u043F"
      ] })
    ] }),
    showSuggest && suggestions.results.length > 0 && /* @__PURE__ */ jsx6(
      MinusWordsSuggestModal,
      {
        results: suggestions.results,
        isWordAdded: (word) => minusWords.some((mw) => mw.text.toLowerCase() === word.toLowerCase()),
        onAddWord: handleAddSuggestedWord,
        onAddAll: handleAddAllSuggested,
        onClose: () => setShowSuggest(false)
      }
    ),
    /* @__PURE__ */ jsx6(
      MinusWordsImportDialog,
      {
        open: showImportDialog,
        text: importText,
        preview: importPreview,
        onOpenChange: (v) => {
          setShowImportDialog(v);
          if (!v) {
            setImportText("");
            setImportPreview(null);
          }
        },
        onTextChange: (t) => {
          setImportText(t);
          setImportPreview(null);
        },
        onParse: () => handleImportParse(importText),
        onImportTxt: handleImportTxt,
        onConfirm: handleImportConfirm
      }
    )
  ] });
}

// index.ts
var minusWordsSettings = {
  broadMatch: false
};
var minusWordsModule = {
  manifest: {
    id: "minus-words",
    name: "\u041C\u0438\u043D\u0443\u0441-\u0444\u0440\u0430\u0437\u044B",
    version: "1.0.0",
    description: "\u0413\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0435 \u0438 \u0433\u0440\u0443\u043F\u043F\u043E\u0432\u044B\u0435 \u043C\u0438\u043D\u0443\u0441-\u0444\u0440\u0430\u0437\u044B, \u0442\u0438\u043F\u044B \u043F\u043E\u0438\u0441\u043A\u0430, \u043E\u0442\u0447\u0451\u0442 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u044F",
    category: "data",
    dependencies: ["groups", "phrases"],
    slot: ["ribbon:tools", "left-panel"],
    settingsSchema: [
      { key: "broadMatch", type: "boolean", label: "\u0428\u0438\u0440\u043E\u043A\u043E\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E", default: false }
    ]
  },
  init(ctx) {
    const readSettings = () => {
      minusWordsSettings = {
        broadMatch: ctx.getSetting("broadMatch") ?? false
      };
    };
    readSettings();
    ctx.registerLifecycleHook?.("onSettingsChange", (payload) => {
      if (payload?.moduleId === "minus-words") {
        readSettings();
      }
    });
    ctx.registerUI({
      slot: "ribbon:tools",
      label: "\u041C\u0438\u043D\u0443\u0441-\u0444\u0440\u0430\u0437\u044B",
      component: () => MinusWordsPanel({ ctx }),
      order: 20
    });
  },
  destroy() {
  }
};
var index_default = minusWordsModule;
export {
  index_default as default,
  minusWordsSettings
};
