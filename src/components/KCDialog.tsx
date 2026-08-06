// ============================================================
// KeyCluster — Reusable Dialog Components
// ============================================================
//
// Replaces browser-native prompt(), confirm(), alert() with
// styled in-app dialogs that match KeyCluster's UI theme.
//
// Usage in React components:
//   import { useKCDialog } from '@/components/KCDialog';
//   const { prompt, confirm, alert } = useKCDialog();
//   const name = await prompt('Название группы:');
//   const ok = await confirm('Удалить группу?');
//   await alert('Ошибка при загрузке файла');
//
// Usage in non-React code (imperative):
//   import { kcPrompt, kcConfirm, kcAlert } from '@/components/KCDialog';
//   const name = await kcPrompt('Название группы:');
//   const ok = await kcConfirm('Удалить группу?');
//   await kcAlert('Ошибка!');
// ============================================================

'use client';

import React, { useState, useCallback, useRef, createContext, useContext } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MIcon } from '@/shell/shared-icon';

// ---- Icon helper ----


// ---- Types ----

export interface PromptOptions {
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

export interface AlertOptions {
  title?: string;
  okLabel?: string;
}

// ---- Dialog State ----

interface DialogState {
  type: 'prompt' | 'confirm' | 'alert';
  message: string;
  options: PromptOptions | ConfirmOptions | AlertOptions;
  resolve: (value: any) => void;
}

// ---- Imperative API (for non-React code) ----
// The provider sets these when it mounts.

let _imperativePrompt: ((message: string, options?: PromptOptions) => Promise<string | null>) | null = null;
let _imperativeConfirm: ((message: string, options?: ConfirmOptions) => Promise<boolean>) | null = null;
let _imperativeAlert: ((message: string, options?: AlertOptions) => Promise<void>) | null = null;

export function kcPrompt(message: string, options?: PromptOptions): Promise<string | null> {
  if (!_imperativePrompt) {
    console.warn('[KCDialog] kcPrompt called before KCDialogProvider mounted — returning null');
    return Promise.resolve(null);
  }
  return _imperativePrompt(message, options);
}

export function kcConfirm(message: string, options?: ConfirmOptions): Promise<boolean> {
  if (!_imperativeConfirm) {
    console.warn('[KCDialog] kcConfirm called before KCDialogProvider mounted — returning false');
    return Promise.resolve(false);
  }
  return _imperativeConfirm(message, options);
}

export function kcAlert(message: string, options?: AlertOptions): Promise<void> {
  if (!_imperativeAlert) {
    console.warn('[KCDialog] kcAlert called before KCDialogProvider mounted — message:', message);
    return Promise.resolve();
  }
  return _imperativeAlert(message, options);
}

// ---- Provider ----

const DialogContext = createContext<{
  prompt: (message: string, options?: PromptOptions) => Promise<string | null>;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  alert: (message: string, options?: AlertOptions) => Promise<void>;
} | null>(null);

export function useKCDialog() {
  const ctx = useContext(DialogContext);
  // If no provider, return imperative API (works in tests without wrapping)
  if (!ctx) {
    return {
      prompt: (message: string, options?: PromptOptions) => kcPrompt(message, options),
      confirm: (message: string, options?: ConfirmOptions) => kcConfirm(message, options),
      alert: (message: string, options?: AlertOptions) => kcAlert(message, options),
    };
  }
  return ctx;
}

export function KCDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const resolveRef = useRef<((value: any) => void) | null>(null);

  const prompt = useCallback((message: string, options?: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      const defaultVal = options?.defaultValue ?? '';
      setInputValue(defaultVal);
      resolveRef.current = resolve;
      setState({ type: 'prompt', message, options: options ?? {}, resolve });
    });
  }, []);

  const confirm = useCallback((message: string, options?: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ type: 'confirm', message, options: options ?? {}, resolve });
    });
  }, []);

  const alert = useCallback((message: string, options?: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ type: 'alert', message, options: options ?? {}, resolve });
    });
  }, []);

  // Register imperative API on mount
  React.useEffect(() => {
    _imperativePrompt = prompt;
    _imperativeConfirm = confirm;
    _imperativeAlert = alert;
    return () => {
      _imperativePrompt = null;
      _imperativeConfirm = null;
      _imperativeAlert = null;
    };
  }, [prompt, confirm, alert]);

  const handleClose = useCallback(() => {
    if (resolveRef.current) {
      if (state?.type === 'prompt') {
        resolveRef.current(null);
      } else if (state?.type === 'confirm') {
        resolveRef.current(false);
      } else {
        resolveRef.current(undefined);
      }
      resolveRef.current = null;
    }
    setState(null);
  }, [state?.type]);

  const handlePromptOk = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(inputValue || null);
      resolveRef.current = null;
    }
    setState(null);
  }, [inputValue]);

  const handleConfirmOk = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
    setState(null);
  }, []);

  const handleAlertOk = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(undefined);
      resolveRef.current = null;
    }
    setState(null);
  }, []);

  const handlePromptKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePromptOk();
    }
  }, [handlePromptOk]);

  const contextValue = React.useMemo(() => ({ prompt, confirm, alert }), [prompt, confirm, alert]);

  return (
    <DialogContext.Provider value={contextValue}>
      {children}

      {/* ---- Prompt Dialog ---- */}
      {state?.type === 'prompt' && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) handleClose(); }}>
          <DialogContent className="max-w-sm" onKeyDown={handlePromptKeyDown}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MIcon name="edit" className="!text-[18px] text-[var(--kc-blue)]" />
                {(state.options as PromptOptions).title || 'Ввод'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-[13px] text-[var(--kc-text-secondary)]">{state.message}</p>
              <Input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={(state.options as PromptOptions).placeholder || ''}
                className="h-8 text-[13px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} className="text-[12px]">
                {(state.options as PromptOptions).cancelLabel || 'Отмена'}
              </Button>
              <Button onClick={handlePromptOk} className="text-[12px]">
                {(state.options as PromptOptions).confirmLabel || 'ОК'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ---- Confirm Dialog ---- */}
      {state?.type === 'confirm' && (
        <AlertDialog open={true} onOpenChange={(open) => { if (!open) handleClose(); }}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <MIcon
                  name={(state.options as ConfirmOptions).variant === 'destructive' ? 'warning' : 'help'}
                  className={`!text-[20px] ${(state.options as ConfirmOptions).variant === 'destructive' ? 'text-[var(--kc-red)]' : 'text-[var(--kc-blue)]'}`}
                />
                {(state.options as ConfirmOptions).title || 'Подтверждение'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[13px]">
                {state.message}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleClose} className="text-[12px]">
                {(state.options as ConfirmOptions).cancelLabel || 'Отмена'}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmOk}
                className={`text-[12px] ${(state.options as ConfirmOptions).variant === 'destructive' ? 'bg-[var(--kc-red)] hover:bg-[var(--kc-red)]/90 text-white' : ''}`}
              >
                {(state.options as ConfirmOptions).confirmLabel || 'ОК'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* ---- Alert Dialog ---- */}
      {state?.type === 'alert' && (
        <AlertDialog open={true} onOpenChange={(open) => { if (!open) handleClose(); }}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <MIcon name="info" className="!text-[20px] text-[var(--kc-blue)]" />
                {(state.options as AlertOptions).title || 'Сообщение'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[13px]">
                {state.message}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleAlertOk} className="text-[12px]">
                {(state.options as AlertOptions).okLabel || 'ОК'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </DialogContext.Provider>
  );
}
