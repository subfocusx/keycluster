import type { DevtoolsState } from '../types';

export interface DevtoolsSlice {
  devtools: DevtoolsState;
  toggleDevtools: () => void;
  setDevtoolsTab: (tab: DevtoolsState['devtoolsTab']) => void;
  setDevtoolsOpen: (open: boolean) => void;
}

const defaultDevtools: DevtoolsState = {
  devtoolsOpen: false,
  devtoolsTab: 'modules',
};

export function createDevtoolsSlice(set: any, get: any): DevtoolsSlice {
  return {
    devtools: { ...defaultDevtools },
    toggleDevtools: () => set((s: any) => {
      s.devtools.devtoolsOpen = !s.devtools.devtoolsOpen;
    }),
    setDevtoolsTab: (tab: any) => set((s: any) => {
      s.devtools.devtoolsTab = tab;
    }),
    setDevtoolsOpen: (open: boolean) => set((s: any) => {
      s.devtools.devtoolsOpen = open;
    }),
  };
}
