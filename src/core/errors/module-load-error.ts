export class ModuleLoadError extends Error {
  public readonly moduleId: string;
  public readonly cause: unknown;

  constructor(moduleId: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`Failed to load module "${moduleId}": ${reason}`);
    this.name = 'ModuleLoadError';
    this.moduleId = moduleId;
    this.cause = cause;
  }
}
