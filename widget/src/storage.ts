import type { Corner } from './options';
import { CORNERS } from './options';

const AUTHOR_KEY = 'prevly.feedback.author';

interface BadgeState {
  corner: Corner | null;
  closed: boolean;
}

export interface WidgetStorage {
  readAuthor(): string;
  writeAuthor(value: string): void;
  readBadge(): BadgeState;
  writeBadge(state: BadgeState): void;
}

export function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createStorage(store: Storage | null, host: string): WidgetStorage {
  const badgeKey = `prevly.feedback.badge:${host}`;

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
    readBadge() {
      try {
        const raw = store?.getItem(badgeKey);
        if (!raw) return { corner: null, closed: false };
        const parsed = JSON.parse(raw) as { corner?: unknown; closed?: unknown };
        return {
          corner: CORNERS.includes(parsed.corner as Corner) ? (parsed.corner as Corner) : null,
          closed: parsed.closed === true,
        };
      } catch {
        return { corner: null, closed: false };
      }
    },
    writeBadge(state) {
      try {
        store?.setItem(badgeKey, JSON.stringify({ corner: state.corner, closed: state.closed }));
      } catch {
        /* storage unavailable */
      }
    },
  };
}
