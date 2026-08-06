export const PLUGIN_INIT_TIMEOUT = 30_000;
export const PLUGIN_DESTROY_TIMEOUT = 10_000;

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`[Timeout] ${label} exceeded ${ms}ms`)), ms);
    }),
  ]);
}
