// ============================================================
// Tests: modules/import-export/export-templates.ts
// ============================================================

import { describe, it, expect } from 'vitest';
import { EXPORT_TEMPLATES, COLUMN_LABELS } from '@user-plugins/import-export/export-templates';

describe('export-templates', () => {
  it('should include minus_words template', () => {
    const tmpl = EXPORT_TEMPLATES.find(t => t.id === 'minus_words');
    expect(tmpl).toBeDefined();
    expect(tmpl?.exportMinusWords).toBe(true);
  });

  it('should have stable column labels for all columns referenced by templates', () => {
    for (const t of EXPORT_TEMPLATES) {
      for (const c of t.columns) {
        expect(COLUMN_LABELS[c]).toBeTruthy();
      }
    }
  });

  it('should not be empty templates list', () => {
    expect(EXPORT_TEMPLATES.length).toBeGreaterThan(0);
  });
});

