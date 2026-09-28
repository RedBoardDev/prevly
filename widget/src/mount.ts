import { createApp } from './app';
import { startConsoleRecorder } from './console-recorder';
import type { ConsoleRecorder } from './console-recorder';
import { startNetworkRecorder } from './network-recorder';
import type { NetworkRecorder } from './network-recorder';
import { resolveOptions } from './options';
import type { MountOptions } from './options';
import { createStorage, safeStorage } from './storage';

/** Handle returned by {@link mountFeedback}. */
export interface FeedbackWidget {
  /** Opens the report panel, revealing the badge first when it was closed. */
  open(): void;
  /** Removes the widget from the page. Safe to call more than once. */
  unmount(): void;
}

interface Recorders {
  console: ConsoleRecorder;
  network: NetworkRecorder;
}

let recorders: Recorders | null = null;

/**
 * Starts the console and network capture without mounting any UI. The wrappers
 * only see what happens after this call, so an embedder that wants the failing
 * request that preceded the report calls it as early as it can.
 */
export function startRecorders(): void {
  if (recorders) return;
  recorders = {
    console: startConsoleRecorder(),
    network: startNetworkRecorder(),
  };
}

/**
 * Mounts the feedback widget on the current page. It never throws and never
 * returns null: a browser that cannot support it gets an inert handle.
 */
export function mountFeedback(options: MountOptions): FeedbackWidget {
  const inert: FeedbackWidget = { open: () => undefined, unmount: () => undefined };
  try {
    if (typeof document === 'undefined' || typeof window === 'undefined') return inert;

    const resolved = resolveOptions(options);
    if (!resolved.endpoint) return inert;

    startRecorders();
    const started = recorders as Recorders;
    started.network.setOrigins(resolved.origins);
    started.network.setRequestIdHeader(resolved.requestIdHeader);

    const app = createApp({
      options: resolved,
      recorder: started.console,
      network: started.network,
      storage: createStorage(safeStorage(), location.host),
    });

    whenReady(() => {
      try {
        app.mount();
      } catch (error) {
        console.debug('[prevly] feedback mount failed', error);
      }
    });

    return {
      open() {
        try {
          app.open();
        } catch (error) {
          console.debug('[prevly] feedback open failed', error);
        }
      },
      unmount() {
        try {
          app.unmount();
        } catch (error) {
          console.debug('[prevly] feedback unmount failed', error);
        }
      },
    };
  } catch (error) {
    console.debug('[prevly] feedback widget failed to start', error);
    return inert;
  }
}

function whenReady(action: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', action, { once: true });
    return;
  }
  action();
}
