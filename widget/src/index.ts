import { activationCookie, parseActivationUrl, readCookieFlag } from './activation';
import { createApp } from './app';
import { startConsoleRecorder } from './console-recorder';

declare global {
  interface Window {
    __prevlyFeedback?: { open(): void; hide(): void };
  }
}

function boot(): void {
  const recorder = startConsoleRecorder();
  const storage = safeStorage();

  const activation = parseActivationUrl(location.href);
  if (activation.requested) {
    setActivated(true);
    if (activation.cleanedUrl) {
      try {
        history.replaceState(history.state, '', activation.cleanedUrl);
      } catch {
        /* replaceState can be blocked in sandboxed frames */
      }
    }
  }

  const app = createApp({ recorder, storage });

  window.__prevlyFeedback = {
    open() {
      try {
        setActivated(true);
        app.open();
      } catch (error) {
        console.debug('[prevly] feedback open failed', error);
      }
    },
    hide() {
      try {
        setActivated(false);
        app.unmount();
      } catch (error) {
        console.debug('[prevly] feedback hide failed', error);
      }
    },
  };

  if (!readCookieFlag(document.cookie)) return;

  whenReady(() => {
    try {
      app.mount();
    } catch (error) {
      console.debug('[prevly] feedback mount failed', error);
    }
  });
}

function setActivated(on: boolean): void {
  try {
    document.cookie = activationCookie(on);
  } catch {
    /* cookies blocked: the widget still works for this page load */
  }
}

function whenReady(action: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', action, { once: true });
    return;
  }
  action();
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

try {
  boot();
} catch (error) {
  console.debug('[prevly] feedback widget failed to start', error);
}
