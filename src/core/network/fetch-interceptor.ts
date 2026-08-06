import { NetworkStore } from './NetworkStore';

let installed = false;

export function installFetchInterceptor(): void {
  if (installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function interceptedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

    const pluginIdHeader = (init?.headers instanceof Headers
      ? init.headers.get('x-plugin-id')
      : (init?.headers as Record<string, string> | undefined)?.['x-plugin-id']) ?? '';

    const startedAt = Date.now();

    const recordId = NetworkStore.add({
      moduleId: pluginIdHeader,
      method,
      url,
      status: 'pending',
      startedAt,
    });

    try {
      const response = await originalFetch(input, init);
      const durationMs = Date.now() - startedAt;

      NetworkStore.update(recordId, {
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        durationMs,
        responseSize: Number(response.headers.get('content-length')) || undefined,
        error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`,
      });

      return response;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const isAbort = err instanceof DOMException && err.name === 'AbortError';

      NetworkStore.update(recordId, {
        status: isAbort ? 'aborted' : 'error',
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      });

      throw err;
    }
  };
}

export function installPluginFetch(): void {
  (window as any).__pluginFetch = async function pluginFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const { invoke } = await import('@tauri-apps/api/core');

    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    const method = (
      init?.method ??
      (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();

    const reqHeaders: Record<string, string> = {};
    const src = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    if (src instanceof Headers) {
      src.forEach((v, k) => { reqHeaders[k] = v; });
    } else if (Array.isArray(src)) {
      for (const [k, v] of src) reqHeaders[k] = v;
    } else if (src) {
      Object.assign(reqHeaders, src);
    }

    const pluginIdHeader = reqHeaders['x-plugin-id'] ?? '';
    const startedAt = Date.now();

    const recordId = NetworkStore.add({
      moduleId: pluginIdHeader,
      method,
      url,
      status: 'pending',
      startedAt,
    });

    let body: string | undefined;
    if (init?.body != null) {
      if (typeof init.body === 'string') {
        body = init.body;
      } else if (init.body instanceof URLSearchParams) {
        body = init.body.toString();
      } else if (init.body instanceof Blob) {
        body = await init.body.text();
      } else if (init.body instanceof ArrayBuffer) {
        body = new TextDecoder().decode(init.body);
      } else if (ArrayBuffer.isView(init.body)) {
        body = new TextDecoder().decode(init.body.buffer);
      } else {
        throw new Error(`Unsupported request body type: ${init.body.constructor?.name ?? typeof init.body}`);
      }
    }

    try {
      const response = await invoke<{ status: number; body: string; headers: Record<string, string> }>(
        'http_request',
        {
          request: {
            url,
            method: method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
            headers: reqHeaders,
            body,
          },
        },
      );

      const durationMs = Date.now() - startedAt;
      NetworkStore.update(recordId, {
        status: response.status >= 200 && response.status < 300 ? 'success' : 'error',
        statusCode: response.status,
        durationMs,
        responseSize: response.body.length,
        error: response.status >= 200 && response.status < 300 ? undefined : `HTTP ${response.status}`,
      });

      return new Response(response.body, {
        status: response.status,
        headers: new Headers(response.headers),
      });
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      NetworkStore.update(recordId, {
        status: 'error',
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
}
