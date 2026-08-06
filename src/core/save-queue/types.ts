import type { ProjectState, ProjectTransport } from '../project-types';

export interface QueueEntry {
  id: number;
  projectId: string;
  state: ProjectState;
  version: number;
  timestamp: number;
  resolve: (success: boolean) => void;
}

export type SaveQueueStatus = 'idle' | 'saving' | 'flushing';

export type { ProjectTransport, ProjectState };
