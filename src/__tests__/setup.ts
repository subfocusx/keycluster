import '@testing-library/jest-dom/vitest';

// Node.js 26 requires --localstorage-file flag for native localStorage.
// Polyfill for zustand persist middleware which uses localStorage.
// Install unconditionally so that even when jsdom provides a quota-limited
// localStorage (e.g. ZodiacStore/perf runs), persist never hits a 5MB cap.
{
  const _store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => _store[key] ?? null,
    setItem: (key: string, value: string) => { _store[key] = value; },
    removeItem: (key: string) => { delete _store[key]; },
    clear: () => { Object.keys(_store).forEach(k => delete _store[k]); },
    get length() { return Object.keys(_store).length; },
    key: (index: number) => Object.keys(_store)[index] ?? null,
  } as Storage;
}

// Polyfill ResizeObserver for jsdom (used by Radix UI ScrollArea, Slider, etc.)
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock as any;

// Polyfill Element.prototype.hasPointerCapture for Radix UI Slider
// Only apply when Element exists (not in Node-only test environments)
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = function () { return false; };
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function () {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = function () {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () {};
  }
}
