// ============================================================
// Tests: KCDialog — imperative API (no native browser dialogs)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kcPrompt, kcConfirm, kcAlert } from '@/components/KCDialog';

describe('KCDialog imperative API — no native fallbacks', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('kcPrompt should return null (not call window.prompt) when provider not mounted', async () => {
    const promptSpy = vi.spyOn(window, 'prompt');
    const result = await kcPrompt('Test prompt');
    expect(result).toBeNull();
    expect(promptSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('kcConfirm should return false (not call window.confirm) when provider not mounted', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const result = await kcConfirm('Test confirm');
    expect(result).toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('kcAlert should not call window.alert when provider not mounted', async () => {
    const alertSpy = vi.spyOn(window, 'alert');
    await kcAlert('Test alert');
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
