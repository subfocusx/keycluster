const STORAGE_KEY = 'kc_cluster_history';
const MAX_HISTORY = 20;

export interface ClusterHistoryEntry {
  id: string;
  timestamp: number;
  algorithm: 'words' | 'jaccard';
  strength: number;
  minGroupSize: number;
  groupCount: number;
  totalPhrases: number;
  durationMs: number;
  groups: Array<{ name: string; count: number }>;
  phrases: Array<{ text: string; group: string }>;
}

export function loadHistory(): ClusterHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveHistory(entry: ClusterHistoryEntry): void {
  const history = loadHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { }
}

export function clearHistory(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { }
}
