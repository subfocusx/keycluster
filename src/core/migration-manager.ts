// ============================================================
// KeyCluster Project System — Migration Manager (Production)
// ============================================================
//
// Handles version-based migrations of project data.
// Migrations are applied sequentially in chain:
//   1.0 → 1.1 → 1.2 → 2.0
// NOT directly: 1.0 → 2.0 ❌
//
// If a project has a version that is newer than the app,
// it is rejected (forward-incompatible).
//
// Each migration is logged. If a migration fails, the chain
// stops and returns an error (fallback).
// ============================================================

import type { ProjectState, MigrationEntry } from './project-types';
import { PROJECT_FORMAT_VERSION } from './project-types';

// ---- Registered Migrations ----
// Each entry migrates FROM the previous version TO this version.
// Order matters: they are applied sequentially in chain.

const migrations: MigrationEntry[] = [
  // Version 1.0 → baseline (no migration needed)
  {
    version: '1.0',
    migrate: (data: ProjectState): ProjectState => {
      return data;
    },
  },
  // Add future migrations here:
  // {
  //   version: '1.1',
  //   migrate: (data: ProjectState): ProjectState => {
  //     return {
  //       ...data,
  //       phrases: data.phrases.map(p => ({
  //         ...p,
  //         competition: p.competition ?? 0,
  //       })),
  //     };
  //   },
  // },
];

// ---- Migration Result ----

export interface MigrationResult {
  success: boolean;
  state?: ProjectState;
  fromVersion?: string;
  toVersion?: string;
  appliedMigrations?: string[];
  error?: string;
}

// ---- Public API ----

/**
 * Migrate project state from its file version to the current version.
 * Migrations are applied sequentially in chain — never skip versions.
 * Each applied migration is logged.
 */
export function migrateProject(fileVersion: string, state: ProjectState): MigrationResult {
  const currentMajor = parseMajorVersion(PROJECT_FORMAT_VERSION);
  const fileMajor = parseMajorVersion(fileVersion);

  // Reject projects from a newer major version
  if (fileMajor > currentMajor) {
    log('REJECTED: project v%s is newer than app v%s', fileVersion, PROJECT_FORMAT_VERSION);
    return {
      success: false,
      error: `Project version ${fileVersion} is newer than app version ${PROJECT_FORMAT_VERSION}. Please update the application.`,
    };
  }

  // If same version, no migration needed
  if (fileVersion === PROJECT_FORMAT_VERSION) {
    return {
      success: true,
      state,
      fromVersion: fileVersion,
      toVersion: fileVersion,
      appliedMigrations: [],
    };
  }

  // Build the migration chain: only include versions after fileVersion
  const chain = migrations
    .filter(m => compareVersions(m.version, fileVersion) > 0)
    .sort((a, b) => compareVersions(a.version, b.version));

  if (chain.length === 0) {
    // No migrations needed but version is older — just return as-is
    log('no migrations in chain for v%s → v%s', fileVersion, PROJECT_FORMAT_VERSION);
    return {
      success: true,
      state,
      fromVersion: fileVersion,
      toVersion: PROJECT_FORMAT_VERSION,
      appliedMigrations: [],
    };
  }

  // Apply migrations sequentially
  let currentState = deepClone(state);
  let lastGoodState = deepClone(state); // Fallback: last known good state
  const applied: string[] = [];
  let currentVersion = fileVersion;

  for (const migration of chain) {
    log('applying migration: v%s → v%s', currentVersion, migration.version);
    try {
      lastGoodState = deepClone(currentState); // Snapshot before migration
      currentState = migration.migrate(currentState);
      applied.push(migration.version);
      currentVersion = migration.version;
      log('migration v%s applied OK', migration.version);
    } catch (err: any) {
      log('migration v%s FAILED: %s (falling back)', migration.version, err.message);
      // Fallback: return the state up to the last successful migration
      return {
        success: false,
        state: lastGoodState,
        fromVersion: fileVersion,
        toVersion: currentVersion,
        appliedMigrations: applied,
        error: `Migration to v${migration.version} failed: ${err.message}. Last successful migration: v${currentVersion}.`,
      };
    }
  }

  log('migration chain complete: v%s → v%s (%d steps)', fileVersion, PROJECT_FORMAT_VERSION, applied.length);
  return {
    success: true,
    state: currentState,
    fromVersion: fileVersion,
    toVersion: PROJECT_FORMAT_VERSION,
    appliedMigrations: applied,
  };
}

/**
 * Check if a project version is compatible with the current app.
 * Compatible = same or older major version.
 */
export function isVersionCompatible(fileVersion: string): boolean {
  const currentMajor = parseMajorVersion(PROJECT_FORMAT_VERSION);
  const fileMajor = parseMajorVersion(fileVersion);
  return fileMajor <= currentMajor;
}

/**
 * Get the list of available migration versions.
 */
export function getAvailableMigrations(): string[] {
  return migrations.map(m => m.version);
}

/**
 * Register a new migration (for plugins or future versions).
 */
export function registerMigration(entry: MigrationEntry): void {
  const idx = migrations.findIndex(m => compareVersions(m.version, entry.version) >= 0);
  if (idx >= 0 && migrations[idx].version === entry.version) {
    migrations[idx] = entry;
  } else {
    migrations.push(entry);
    migrations.sort((a, b) => compareVersions(a.version, b.version));
  }
  log('registered migration v%s', entry.version);
}

// ---- Helpers ----

function parseMajorVersion(version: string): number {
  return parseInt(version.split('.')[0], 10) || 0;
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(s => { const n = Number(s); return isNaN(n) ? 0 : n; });
  const partsB = b.split('.').map(s => { const n = Number(s); return isNaN(n) ? 0 : n; });
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const va = partsA[i] ?? 0;
    const vb = partsB[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

function log(msg: string, ...args: any[]): void {
  if (typeof console !== 'undefined') {
    console.log(`[Migration] ${msg}`, ...args);
  }
}
