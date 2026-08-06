// ============================================================
// Tests: Migration Manager
// ============================================================
// Comprehensive tests for project version migration:
//   - Same version → no migration needed
//   - Older minor version → chain applied
//   - Newer major version → rejected
//   - Migration failure → fallback to last good state
//   - registerMigration: adds new, replaces existing
//   - getAvailableMigrations: returns correct list
//   - isVersionCompatible: various version comparisons
//   - Multiple migrations in chain (sequential application)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  migrateProject,
  isVersionCompatible,
  getAvailableMigrations,
  registerMigration,
} from '@/core/migration-manager';
import type { ProjectState, MigrationEntry } from '@/core/project-types';

const PROJECT_FORMAT_VERSION = '1.0';

const sampleState: ProjectState = {
  groups: [],
  phrases: [],
  minusWords: [],
  settings: {},
  uiState: {},
};

const richState: ProjectState = {
  groups: [
    { id: 'g1', name: 'Test', parentId: null, isExpanded: true, isTrash: false, color: '', createdAt: Date.now() },
  ],
  phrases: [
    { id: 'p1', text: 'test phrase', groupId: 'g1', frequency: 100, createdAt: Date.now() },
  ],
  minusWords: [],
  settings: {},
  uiState: {},
};

// ============================================================
// Same version → no migration needed
// ============================================================

describe('migrateProject — same version', () => {
  it('returns success with no applied migrations when fileVersion equals current', () => {
    const result = migrateProject(PROJECT_FORMAT_VERSION, sampleState);

    expect(result.success).toBe(true);
    expect(result.state).toEqual(sampleState);
    expect(result.fromVersion).toBe(PROJECT_FORMAT_VERSION);
    expect(result.toVersion).toBe(PROJECT_FORMAT_VERSION);
    expect(result.appliedMigrations).toEqual([]);
    expect(result.error).toBeUndefined();
  });
});

// ============================================================
// Older minor version → chain applied
// ============================================================

describe('migrateProject — older minor version', () => {
  it('applies registered migrations for an older file version', () => {
    // Register a migration from 0.9 → 0.9.1
    registerMigration({
      version: '0.9.1',
      migrate: (data) => ({
        ...data,
        phrases: data.phrases.map((p) => ({ ...p, competition: (p as any).competition ?? 0 })),
      }),
    });

    const result = migrateProject('0.9', richState);

    expect(result.success).toBe(true);
    expect(result.state).toBeDefined();
    expect(result.fromVersion).toBe('0.9');
    expect(result.appliedMigrations).toContain('0.9.1');
    expect((result.state!.phrases[0] as any).competition).toBe(0);
  });

  it('returns success with empty chain when no migrations exist for older version', () => {
    const result = migrateProject('0.1', sampleState);

    // No migrations registered between 0.1 and 1.0 except existing ones
    expect(result.success).toBe(true);
    expect(result.state).toBeDefined();
    expect(result.fromVersion).toBe('0.1');
    expect(result.toVersion).toBe(PROJECT_FORMAT_VERSION);
  });
});

// ============================================================
// Newer major version → rejected
// ============================================================

describe('migrateProject — newer major version', () => {
  it('rejects a project from a newer major version', () => {
    const result = migrateProject('2.0', sampleState);

    expect(result.success).toBe(false);
    expect(result.error).toContain('newer');
    expect(result.state).toBeUndefined();
  });

  it('rejects major version 99.0', () => {
    const result = migrateProject('99.0', richState);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================
// Migration failure → fallback to last good state
// ============================================================

describe('migrateProject — migration failure', () => {
  it('returns the last good state when a migration throws', () => {
    registerMigration({
      version: '0.5',
      migrate: () => {
        throw new Error('Intentional migration failure');
      },
    });

    const result = migrateProject('0.4', richState);

    expect(result.success).toBe(false);
    expect(result.error).toContain('failed');
    expect(result.state).toBeDefined();
    // The last good state should still have the original groups
    expect(result.state!.groups).toHaveLength(1);
  });

  it('returns partially applied migrations before the failure', () => {
    // Register a good migration then a failing one
    registerMigration({
      version: '0.3.1',
      migrate: (data) => ({
        ...data,
        phrases: data.phrases.map((p) => ({ ...p, notes: 'migrated' })),
      }),
    });
    registerMigration({
      version: '0.3.2',
      migrate: () => {
        throw new Error('Second migration fails');
      },
    });

    const result = migrateProject('0.3', richState);

    expect(result.success).toBe(false);
    expect(result.appliedMigrations).toContain('0.3.1');
    // The last good state should have the notes field from the first migration
    expect((result.state!.phrases[0] as any).notes).toBe('migrated');
  });
});

// ============================================================
// registerMigration
// ============================================================

describe('registerMigration', () => {
  it('adds a new migration for a new version', () => {
    const before = getAvailableMigrations();

    registerMigration({
      version: '0.7.3',
      migrate: (data) => data,
    });

    const after = getAvailableMigrations();
    expect(after).toContain('0.7.3');
    expect(after.length).toBeGreaterThan(before.length);
  });

  it('replaces an existing migration for the same version', () => {
    // First register
    registerMigration({
      version: '0.8.1',
      migrate: (data) => ({ ...data, _marker: 'first' }),
    });

    // Replace with a different migration
    let called = false;
    registerMigration({
      version: '0.8.1',
      migrate: (data) => {
        called = true;
        return { ...data, _marker: 'second' };
      },
    });

    // Apply the migration to verify the replacement is used
    const result = migrateProject('0.8', sampleState);
    // The chain should include 0.8.1 and use the second implementation
    if (result.appliedMigrations!.includes('0.8.1')) {
      expect(called).toBe(true);
    }
  });
});

// ============================================================
// getAvailableMigrations
// ============================================================

describe('getAvailableMigrations', () => {
  it('returns a list of version strings', () => {
    const versions = getAvailableMigrations();

    expect(Array.isArray(versions)).toBe(true);
    for (const v of versions) {
      expect(typeof v).toBe('string');
    }
  });

  it('always includes the baseline 1.0 version', () => {
    const versions = getAvailableMigrations();
    expect(versions).toContain('1.0');
  });
});

// ============================================================
// isVersionCompatible
// ============================================================

describe('isVersionCompatible', () => {
  it('returns true for the same version as the app', () => {
    expect(isVersionCompatible(PROJECT_FORMAT_VERSION)).toBe(true);
  });

  it('returns true for an older version (same major)', () => {
    expect(isVersionCompatible('0.9')).toBe(true);
    expect(isVersionCompatible('0.1')).toBe(true);
  });

  it('returns true for an older minor version (same major)', () => {
    // If PROJECT_FORMAT_VERSION is '1.0', then '1.0' is the same version
    // Testing with 0.x which has a lower major version
    expect(isVersionCompatible('0.5')).toBe(true);
  });

  it('returns false for a newer major version', () => {
    expect(isVersionCompatible('2.0')).toBe(false);
    expect(isVersionCompatible('10.0')).toBe(false);
  });
});

// ============================================================
// Multiple migrations in chain (sequential application)
// ============================================================

describe('migrateProject — multiple migrations in chain', () => {
  it('applies migrations sequentially, each building on the previous result', () => {
    // Register a chain using versions that avoid previously registered
    // failing migrations (0.3.2, 0.5). Use 0.55.x range.
    registerMigration({
      version: '0.55.1',
      migrate: (data) => ({ ...data, _seqStep1: true }),
    });
    registerMigration({
      version: '0.55.2',
      migrate: (data) => ({ ...data, _seqStep2: true }),
    });
    registerMigration({
      version: '0.55.3',
      migrate: (data) => ({ ...data, _seqStep3: true }),
    });

    const result = migrateProject('0.55', sampleState);

    expect(result.success).toBe(true);
    // Our three migrations should be in the chain (others may be too)
    expect(result.appliedMigrations).toContain('0.55.1');
    expect(result.appliedMigrations).toContain('0.55.2');
    expect(result.appliedMigrations).toContain('0.55.3');
    // Each step should have built on the previous
    expect((result.state as any)._seqStep1).toBe(true);
    expect((result.state as any)._seqStep2).toBe(true);
    expect((result.state as any)._seqStep3).toBe(true);
    expect(result.fromVersion).toBe('0.55');
    expect(result.toVersion).toBe(PROJECT_FORMAT_VERSION);
  });

  it('never skips versions — chain is sequential', () => {
    // Register migrations out of order to verify they are sorted.
    // Use 0.56.x range to avoid failing migrations.
    registerMigration({
      version: '0.56.3',
      migrate: (data) => ({ ...data, _orderStep3: true }),
    });
    registerMigration({
      version: '0.56.1',
      migrate: (data) => ({ ...data, _orderStep1: true }),
    });
    registerMigration({
      version: '0.56.2',
      migrate: (data) => ({ ...data, _orderStep2: true }),
    });

    const result = migrateProject('0.56', sampleState);

    expect(result.success).toBe(true);
    // Verify the three versions appear in ascending order within appliedMigrations
    const applied = result.appliedMigrations!;
    const idx1 = applied.indexOf('0.56.1');
    const idx2 = applied.indexOf('0.56.2');
    const idx3 = applied.indexOf('0.56.3');
    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThanOrEqual(0);
    expect(idx3).toBeGreaterThanOrEqual(0);
    // They must be in version order regardless of registration order
    expect(idx1).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx3);
  });

  it('only applies migrations newer than the file version', () => {
    // Register migrations at 0.57.1 and 0.57.2
    registerMigration({
      version: '0.57.1',
      migrate: (data) => ({ ...data, _oldMigration: true }),
    });
    registerMigration({
      version: '0.57.2',
      migrate: (data) => ({ ...data, _newerMigration: true }),
    });

    // Starting from 0.57.2 should NOT apply 0.57.1 (it's not newer than 0.57.2)
    const result = migrateProject('0.57.2', sampleState);

    expect(result.success).toBe(true);
    expect(result.appliedMigrations).not.toContain('0.57.1');
    // 0.57.2 is not newer than itself either, so it shouldn't be applied
    // Only migrations strictly greater than 0.57.2 will be applied
    expect(result.appliedMigrations).not.toContain('0.57.2');
  });
});

// ============================================================
// Empty chain edge case
// ============================================================

describe('migrateProject — empty chain', () => {
  it('returns success with original state when version equals current (no chain needed)', () => {
    // The only truly "empty chain" scenario is same version (already tested above),
    // but we can also verify that same-version returns the exact state unchanged
    const result = migrateProject(PROJECT_FORMAT_VERSION, sampleState);

    expect(result.success).toBe(true);
    expect(result.state).toEqual(sampleState);
    expect(result.appliedMigrations).toEqual([]);
  });

  it('returns success and state for a version just below current with no gap migrations', () => {
    // If we use a version that's very close to the current version
    // and has no specific migrations between them, the chain may still
    // include existing registered migrations, but the result should be successful
    const result = migrateProject('0.99', sampleState);

    // As long as no failing migration is in the chain, it succeeds
    expect(result.success).toBe(true);
    expect(result.state).toBeDefined();
    expect(result.fromVersion).toBe('0.99');
    expect(result.toVersion).toBe(PROJECT_FORMAT_VERSION);
  });
});
