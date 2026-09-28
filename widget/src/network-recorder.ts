import { LIMITS, clamp } from './limits';
import type { NetworkEntry } from './types';

export interface NetworkRecorder {
  entries(): NetworkEntry[];
  origins(): string[];
  setOrigins(origins: string[]): void;
  stop(): void;
}

export interface NetworkTarget {
  fetch?: typeof fetch;
  XMLHttpRequest?: typeof XMLHttpRequest;
}

export interface NetworkOptions {
  origins?: string[];
  limit?: number;
  target?: NetworkTarget;
  base?: string;
  now?: () => Date;
}

interface Pending {
  method: string;
  path: string;
  watched: boolean;
}

export function startNetworkRecorder(options: NetworkOptions = {}): NetworkRecorder {
  const limit = options.limit ?? LIMITS.networkEntries;
  const scope = options.target ?? (typeof window !== 'undefined' ? window : ({} as NetworkTarget));
  const base = options.base ?? (typeof location !== 'undefined' ? location.href : 'http://localhost/');
  const now = options.now ?? (() => new Date());

  let watched = options.origins?.slice() ?? [];
  const buffer: NetworkEntry[] = [];
  const restores: Array<() => void> = [];

  const describe = (method: string, url: unknown): Pending => {
    let path = '';
    let inScope = false;
    try {
      const parsed = new URL(String(url ?? ''), base);
      path = parsed.pathname;
      inScope = watched.includes(parsed.origin);
    } catch {
      /* an unparseable url belongs to no configured origin */
    }
    return {
      method: (method || 'GET').toUpperCase().slice(0, 10),
      path: clamp(path, LIMITS.networkPath),
      watched: inScope,
    };
  };

  const push = (pending: Pending, status: number, requestId: string | null): void => {
    if (!pending.watched) return;
    if (status !== 0 && status < 500) return;
    const entry: NetworkEntry = { method: pending.method, path: pending.path, status, at: now().toISOString() };
    if (requestId) entry.requestId = clamp(requestId, LIMITS.requestId);
    buffer.push(entry);
    while (buffer.length > limit) buffer.shift();
  };

  const originalFetch = scope.fetch;
  if (typeof originalFetch === 'function') {
    const patched = async function patchedFetch(
      this: unknown,
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      let pending: Pending | null = null;
      try {
        const url = typeof input === 'string' || input instanceof URL ? input : (input as Request).url;
        const method =
          init?.method ?? (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET');
        pending = describe(String(method), url);
      } catch {
        pending = null;
      }

      try {
        const response = await originalFetch.call(this ?? scope, input as RequestInfo, init);
        if (pending) {
          let requestId: string | null = null;
          try {
            requestId = response.headers?.get('x-request-id') ?? null;
          } catch {
            /* an opaque response exposes no header */
          }
          push(pending, response.status, requestId);
        }
        return response;
      } catch (error) {
        if (pending) push(pending, 0, null);
        throw error;
      }
    };
    scope.fetch = patched as typeof fetch;
    restores.push(() => {
      scope.fetch = originalFetch;
    });
  }

  const OriginalXHR = scope.XMLHttpRequest;
  if (typeof OriginalXHR === 'function') {
    const proto = OriginalXHR.prototype;
    const originalOpen = proto.open;
    const originalSend = proto.send;
    const slot = Symbol('prevly.network');
    type Tracked = XMLHttpRequest & { [slot]?: Pending | null };

    proto.open = function patchedOpen(this: Tracked, method: string, url: string | URL, ...rest: unknown[]) {
      try {
        this[slot] = describe(method, url);
      } catch {
        this[slot] = null;
      }
      return (originalOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
    } as typeof proto.open;

    proto.send = function patchedSend(this: Tracked, ...args: unknown[]) {
      try {
        const pending = this[slot];
        if (pending) {
          const settle = (status: number): void => {
            let requestId: string | null = null;
            try {
              requestId = this.getResponseHeader('x-request-id');
            } catch {
              /* headers unavailable cross-origin */
            }
            push(pending, status, requestId);
          };
          this.addEventListener('load', () => settle(this.status));
          this.addEventListener('error', () => settle(0));
          this.addEventListener('timeout', () => settle(0));
          this.addEventListener('abort', () => settle(0));
        }
      } catch {
        /* the recorder never breaks the host page */
      }
      return (originalSend as (...args: unknown[]) => void).call(this, ...args);
    } as typeof proto.send;

    restores.push(() => {
      proto.open = originalOpen;
      proto.send = originalSend;
    });
  }

  return {
    entries: () => buffer.slice(),
    origins: () => watched.slice(),
    setOrigins(origins) {
      watched = origins.slice();
    },
    stop() {
      while (restores.length) {
        const restore = restores.pop();
        try {
          restore?.();
        } catch {
          /* best effort */
        }
      }
    },
  };
}
