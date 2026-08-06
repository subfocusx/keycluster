export interface LabelDef {
  name: string;
  value: string;
  displayName: string;
  moduleId: string;
}

class LabelRegistry {
  private labels: Map<string, LabelDef> = new Map();
  private listeners: Array<() => void> = [];

  register(moduleId: string, labels: Array<{ name: string; value: string; displayName: string }>) {
    for (const l of labels) {
      this.labels.set(l.name, { ...l, moduleId });
    }
    this.listeners.forEach(fn => fn());
  }

  unregister(moduleId: string) {
    for (const [key, val] of this.labels.entries()) {
      if (val.moduleId === moduleId) this.labels.delete(key);
    }
    this.listeners.forEach(fn => fn());
  }

  getAll(): LabelDef[] {
    return Array.from(this.labels.values());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }
}

export const labelRegistry = new LabelRegistry();

const BUILTIN_LABELS = [
  { name: 'red', value: '#E53E3E', displayName: 'Красная' },
  { name: 'orange', value: '#ED8936', displayName: 'Оранжевая' },
  { name: 'yellow', value: '#ECC94B', displayName: 'Жёлтая' },
  { name: 'green', value: '#48BB78', displayName: 'Зелёная' },
  { name: 'blue', value: '#4299E1', displayName: 'Синяя' },
  { name: 'purple', value: '#9F7AEA', displayName: 'Фиолетовая' },
];

labelRegistry.register('builtin', BUILTIN_LABELS);
