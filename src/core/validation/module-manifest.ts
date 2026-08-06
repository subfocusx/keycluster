import { ModuleLoadError } from '../errors/module-load-error';
import type { ModuleManifest, InternalModuleManifest } from '../types';

export function validateModuleManifest(raw: unknown, moduleId: string): asserts raw is ModuleManifest {
  if (!raw || typeof raw !== 'object') {
    throw new ModuleLoadError(
      moduleId,
      `Invalid manifest: expected an object, got ${typeof raw}`,
    );
  }

  const m = raw as Record<string, unknown>;

  if (typeof m.id !== 'string' || !m.id) {
    throw new ModuleLoadError(
      moduleId,
      `Invalid manifest: "id" must be a non-empty string`,
    );
  }

  if (typeof m.name !== 'string' || !m.name) {
    throw new ModuleLoadError(
      moduleId,
      `Invalid manifest: "name" must be a non-empty string`,
    );
  }

  if (typeof m.version !== 'string' || !m.version) {
    throw new ModuleLoadError(
      moduleId,
      `Invalid manifest: "version" must be a non-empty string`,
    );
  }

  if (typeof m.description !== 'string') {
    throw new ModuleLoadError(
      moduleId,
      `Invalid manifest: "description" must be a string`,
    );
  }

  if (!Array.isArray(m.slot)) {
    throw new ModuleLoadError(
      moduleId,
      `Invalid manifest: "slot" must be an array`,
    );
  }
}

export function buildInternalModuleManifest(raw: ModuleManifest): InternalModuleManifest {
  return {
    ...raw,
    slot: raw.slot,
    dependencies: raw.dependencies ?? [],
    settingsSchema: raw.settingsSchema ?? [],
  };
}
