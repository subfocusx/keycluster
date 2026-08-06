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

  // Дедупликация — не показывать одну и ту же ошибку дважды
  const msg = escapeHtml(String(error?.message ?? _msg));
  if (document.querySelector(`[data-error-msg="${msg}"]`)) return;

  const bar = document.createElement('div');
  bar.setAttribute('data-error-msg', msg);
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#fef2f2;border-top:2px solid #b91c1c;padding:6px 40px 6px 16px;font:12px monospace;color:#b91c1c;max-height:80px;overflow:auto';
  bar.innerHTML = `<b>Ошибка:</b> ${msg}`;

  // Кнопка закрыть
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:4px;right:8px;background:none;border:none;cursor:pointer;font-size:14px;color:#b91c1c;line-height:1;padding:2px 4px;';
  closeBtn.onclick = () => bar.remove();
  bar.appendChild(closeBtn);

  document.body.appendChild(bar);
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
function escapeHtml(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

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
