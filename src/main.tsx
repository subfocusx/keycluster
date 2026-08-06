import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/material-symbols-outlined';
import './globals.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { jsx, jsxs, Fragment as JsxFragment } from 'react/jsx-runtime';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/toaster';
import { KCDialogProvider } from '@/components/KCDialog';
import KeyClusterShell from '@/shell/KeyClusterShell';
import { RootErrorBoundary } from '@/components/RootErrorBoundary';
import { bootstrap } from '@/core/bootstrap';
import { LogStore } from '@/plugin-sdk';

// Экспортируем React глобально для плагинов (обязательно при --external:react)
(window as any).React = React;
(window as any).ReactDOM = ReactDOM;
// JSX runtime для плагинов, использующих автоматический JSX-трансформатор
(window as any).__react_jsx_runtime = { jsx, jsxs, Fragment: JsxFragment };

// Start bootstrap ONCE at module level — outside React StrictMode double-mount
bootstrap();

// Global error handlers for debugging
window.onerror = (_msg, _url, _line, _col, error) => {
  console.error('[window.onerror]', _msg, error);
  LogStore._log('error', 'system', `Unhandled error: ${String(error?.message ?? _msg)}`, {
    error: String(error?.message ?? _msg),
    stack: error instanceof Error ? error.stack : undefined,
  });
};
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
  console.error('[unhandledrejection]', msg, e.reason);
  LogStore._log('error', 'system', `Unhandled rejection: ${msg}`, {
    error: msg,
    stack: e.reason instanceof Error ? e.reason.stack : undefined,
  });
  e.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="light"
        themes={['light', 'dark', 'dark-pro']}
        enableSystem={false}
      >
        <KCDialogProvider>
          <KeyClusterShell />
        </KCDialogProvider>
        <Toaster />
      </ThemeProvider>
    </RootErrorBoundary>
  </React.StrictMode>,
);
