export interface ErrorRecord {
  id: string;
  moduleId: string;
  timestamp: number;
  phase: 'init' | 'render' | 'runtime' | 'ipc' | 'unknown';
  message: string;
  stack?: string;
  count: number;
  lastOccurrence: number;
  resolved: boolean;
}

export interface ErrorFilter {
  moduleId?: string;
  phase?: ErrorRecord['phase'];
  resolved?: boolean;
}
