export interface SearchProvider {
  id: string;
  name: string;
  urlTemplate: string;
}

const _providers = new Map<string, SearchProvider>();

export function registerSearchProvider(provider: SearchProvider): void {
  _providers.set(provider.id, provider);
}

export function getSearchProvider(id: string): SearchProvider | undefined {
  return _providers.get(id);
}

export function getAllSearchProviders(): SearchProvider[] {
  return Array.from(_providers.values());
}

export function unregisterSearchProvider(id: string): void {
  _providers.delete(id);
}

export function clearSearchProviders(): void {
  _providers.clear();
}
