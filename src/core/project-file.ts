// ============================================================
// KeyCluster Project System — File Import/Export (.kcproj)
// ============================================================
//
// Handles serialization/deserialization of project data to/from
// the .kcproj JSON format. Works entirely with data — no DB, no Zustand.
// ============================================================

import type { ProjectFile, ProjectState } from './project-types';
import { PROJECT_FORMAT_VERSION } from './project-types';

// ---- Export ----

/** Serialize project state into a .kcproj JSON string */
export function exportToKcproj(
  name: string,
  state: ProjectState,
  existingUpdatedAt?: string
): string {
  const now = new Date().toISOString();
  const projectFile: ProjectFile = {
    version: PROJECT_FORMAT_VERSION,
    createdAt: now, // New file gets new timestamp
    updatedAt: existingUpdatedAt ?? now,
    name,
    state,
  };
  return JSON.stringify(projectFile, null, 2);
}

/** Trigger a browser download of a .kcproj file */
export function downloadKcprojFile(name: string, state: ProjectState): void {
  const json = exportToKcproj(name, state);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeFilename(name) + '.kcproj';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---- Import ----

/** Parse a .kcproj JSON string into a ProjectFile object */
export function parseKcproj(jsonString: string): ProjectFile {
  const parsed = JSON.parse(jsonString);
  validateKcproj(parsed);
  return parsed as ProjectFile;
}

/** Read a .kcproj file from a File object (browser) */
export function readKcprojFile(file: File): Promise<ProjectFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const projectFile = parseKcproj(reader.result as string);
        resolve(projectFile);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ---- Validation ----

function validateKcproj(data: any): void {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid .kcproj file: not a JSON object');
  }
  if (typeof data.version !== 'string') {
    throw new Error('Invalid .kcproj file: missing "version" field');
  }
  if (typeof data.name !== 'string') {
    throw new Error('Invalid .kcproj file: missing "name" field');
  }
  if (!data.state || typeof data.state !== 'object') {
    throw new Error('Invalid .kcproj file: missing "state" field');
  }
  // Validate state sub-fields
  const state = data.state;
  if (!Array.isArray(state.groups)) {
    throw new Error('Invalid .kcproj file: state.groups must be an array');
  }
  if (!Array.isArray(state.phrases)) {
    throw new Error('Invalid .kcproj file: state.phrases must be an array');
  }
  if (!Array.isArray(state.minusWords)) {
    throw new Error('Invalid .kcproj file: state.minusWords must be an array');
  }
  // Version compatibility check
  const majorVersion = data.version.split('.')[0];
  const currentMajor = PROJECT_FORMAT_VERSION.split('.')[0];
  if (majorVersion !== currentMajor) {
    throw new Error(
      `Incompatible .kcproj version: file is v${data.version}, expected v${PROJECT_FORMAT_VERSION}.x`
    );
  }
}

// ---- Helpers ----

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}
