export type KCID = string;

export type IntentType = 'transactional' | 'commercial' | 'informational' | 'navigational';

export interface Phrase {
  id: KCID;
  text: string;
  groupId: KCID;
  frequency?: number;
  kei?: number;
  cpc?: number;
  competition?: number;
  notes?: string;
  tags?: string[];
  intent?: IntentType;
  createdAt: number;
  starredAt?: number;
}

export interface Group {
  id: KCID;
  name: string;
  parentId: KCID | null;
  color?: string;
  notes?: string;
  isExpanded: boolean;
  isTrash: boolean;
  createdAt: number;
  clusterQuality?: { score: number; reason: string; updatedAt: number };
}

export interface MinusWord {
  id: KCID;
  text: string;
  isExact: boolean;
  groupId: KCID | null;
  searchType: 'exact' | 'broad' | 'broad_modified';
  createdAt: number;
  mwGroupId?: KCID | null;
}

export interface MinusWordGroup {
  id: KCID;
  name: string;
  createdAt: number;
}
