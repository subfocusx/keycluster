export class ModuleExecutionGate {
  private blocked = new Set<string>()

  isAllowed(id: string): boolean {
    return !this.blocked.has(id)
  }

  disable(id: string): void {
    this.blocked.add(id)
  }

  enable(id: string): void {
    this.blocked.delete(id)
  }

  isBlocked(id: string): boolean {
    return this.blocked.has(id)
  }

  clear(): void {
    this.blocked.clear()
  }
}

export const executionGate = new ModuleExecutionGate()
