const INSTALL_TIMEOUT_MS = 60_000; // 60 секунд максимум на установку

class InstallationGate {
  private installing = new Map<string, ReturnType<typeof setTimeout>>();

  start(pluginId: string): void {
    if (this.installing.has(pluginId)) {
      throw new Error(`Plugin "${pluginId}" is already being installed`);
    }
    // Автоматически освобождаем через 60 сек если установка зависла
    const timer = setTimeout(() => {
      if (this.installing.has(pluginId)) {
        this.installing.delete(pluginId);
        console.warn(`[InstallationGate] Install timeout for "${pluginId}" — gate force-released`);
      }
    }, INSTALL_TIMEOUT_MS);
    this.installing.set(pluginId, timer);
  }

  end(pluginId: string): void {
    const timer = this.installing.get(pluginId);
    if (timer) clearTimeout(timer);
    this.installing.delete(pluginId);
  }

  isInstalling(pluginId: string): boolean {
    return this.installing.has(pluginId);
  }

  clear(): void {
    for (const timer of this.installing.values()) clearTimeout(timer);
    this.installing.clear();
  }
}

export const installationGate = new InstallationGate();
