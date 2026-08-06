import type { FilterContribution } from './types';

const _filters = new Map<string, FilterContribution>();
const _moduleOwners = new Map<string, string>();

export function registerFilter(moduleId: string, filter: FilterContribution): void {
  _filters.set(filter.id, filter);
  _moduleOwners.set(filter.id, moduleId);
}

export function unregisterFilter(id: string): void {
  _filters.delete(id);
  _moduleOwners.delete(id);
}

export function getFilter(id: string): FilterContribution | undefined {
  return _filters.get(id);
}

export function getAllFilters(): FilterContribution[] {
  return Array.from(_filters.values());
}

export function unregisterFiltersByModule(moduleId: string): void {
  for (const [id, owner] of [..._moduleOwners]) {
    if (owner === moduleId) {
      _filters.delete(id);
      _moduleOwners.delete(id);
    }
  }
}

export function clearFilters(): void {
  _filters.clear();
  _moduleOwners.clear();
}
