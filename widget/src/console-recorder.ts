import { LIMITS } from './limits';
import type { ConsoleEntry, ConsoleLevel } from './types';

export interface ConsoleRecorder {
  entries(): ConsoleEntry[];
  record(level: ConsoleLevel, args: unknown[]): void;
  stop(): void;
}

export interface RecorderOptions {
  limit?: number;
  maxMessage?: number;
  console?: Pick<Console, 'error' | 'warn'>;
  target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null;
  now?: () => Date;
}

export function formatArgs(args: unknown[]): string {
  const parts: string[] = [];
  for (const arg of args) {
    parts.push(formatArg(arg));
  }
  return parts.join(' ');
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg) ?? String(arg);
    } catch {
      return objectLabel(arg);
    }
  }
  try {
    return String(arg);
  } catch {
    return '[unprintable]';
  }
}

function objectLabel(value: object): string {
  const name = value.constructor?.name;
  return name ? `[object ${name}]` : '[object]';
}

export function startConsoleRecorder(options: RecorderOptions = {}): ConsoleRecorder {
  const limit = options.limit ?? LIMITS.consoleEntries;
  const maxMessage = options.maxMessage ?? LIMITS.consoleMessage;
  const sink = options.console ?? (typeof console !== 'undefined' ? console : undefined);
  const target =
    options.target === undefined ? (typeof window !== 'undefined' ? window : null) : options.target;
  const now = options.now ?? (() => new Date());

  const buffer: ConsoleEntry[] = [];

  const record = (level: ConsoleLevel, args: unknown[]): void => {
    try {
      const message = formatArgs(args);
      if (!message) return;
      buffer.push({
        level,
        message: message.length <= maxMessage ? message : message.slice(0, maxMessage),
        at: now().toISOString(),
      });
      while (buffer.length > limit) buffer.shift();
    } catch {
      /* the recorder never breaks the host page */
    }
  };

  const restores: Array<() => void> = [];

  if (sink) {
    for (const level of ['error', 'warn'] as const) {
      const original = sink[level];
      if (typeof original !== 'function') continue;
      const patched = function patchedConsole(this: unknown, ...args: unknown[]): void {
        try {
          original.apply(this ?? sink, args);
        } finally {
          record(level, args);
        }
      };
      sink[level] = patched as Console[typeof level];
      restores.push(() => {
        sink[level] = original;
      });
    }
  }

  if (target) {
    const onError = (event: Event): void => {
      const e = event as ErrorEvent;
      const error = e.error;
      if (!error && !e.message) return;
      record('error', [error instanceof Error ? error : e.message]);
    };
    const onRejection = (event: Event): void => {
      const reason = (event as PromiseRejectionEvent).reason;
      record('error', ['Unhandled rejection:', reason]);
    };
    try {
      target.addEventListener('error', onError);
      target.addEventListener('unhandledrejection', onRejection);
      restores.push(() => {
        target.removeEventListener('error', onError);
        target.removeEventListener('unhandledrejection', onRejection);
      });
    } catch {
      /* listeners unavailable */
    }
  }

  return {
    entries: () => buffer.slice(),
    record,
    stop: () => {
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
