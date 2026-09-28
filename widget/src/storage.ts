import type { Corner } from './options';
import { CORNERS } from './options';

const AUTHOR_KEY = 'prevly.feedback.author';

export interface WidgetStorage {
  readAuthor(): string;
  writeAuthor(value: string): void;
  readCorner(): Corner | null;
  writeCorner(corner: Corner): void;
}

export function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createStorage(store: Storage | null, host: string): WidgetStorage {
  const cornerKey = `prevly.feedback.corner:${host}`;

  return {
    readAuthor() {
      try {
        return store?.getItem(AUTHOR_KEY) ?? '';
      } catch {
        return '';
      }
    },
    writeAuthor(value) {
      try {
        store?.setItem(AUTHOR_KEY, value);
      } catch {
        /* storage unavailable */
      }
    },
    readCorner() {
      try {
        const raw = store?.getItem(cornerKey);
        return CORNERS.includes(raw as Corner) ? (raw as Corner) : null;
      } catch {
        return null;
      }
    },
    writeCorner(corner) {
      try {
        store?.setItem(cornerKey, corner);
      } catch {
        /* storage unavailable */
      }
    },
  };
}
