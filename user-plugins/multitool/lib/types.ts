export interface Phrase {
  id: string;
  text: string;
  groupId: string;
  frequency?: number;
  intent?: 'transactional' | 'commercial' | 'informational' | 'navigational';
  [key: string]: any;
}

export interface PhraseFilter {
  id: string;
  name: string;
  check: (text: string, phrase?: any) => boolean;
}

export interface PanelState {
  filterMode: 'copy' | 'move';
  selectedGroupId: string;
  openSections: Record<string, boolean>;
  sectionOrder: string[];
}
