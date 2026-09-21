import { LIMITS, clamp, collapse } from './limits';
import type { ConsoleEntry, ElementInfo, FeedbackMeta, Point, Rect, Viewport } from './types';

export interface MetaInput {
  author: string;
  comment: string;
  page: string;
  title?: string | null;
  selector?: string | null;
  element?: ElementInfo | null;
  click?: Point | null;
  rect?: Rect | null;
  viewport: Viewport;
  userAgent?: string | null;
  console?: ConsoleEntry[] | null;
}

export function buildMeta(input: MetaInput): FeedbackMeta {
  const meta: FeedbackMeta = {
    author: clamp(collapse(input.author), LIMITS.author),
    comment: clamp(input.comment.trim(), LIMITS.comment),
    page: clamp(input.page, LIMITS.page),
    viewport: {
      w: Math.round(input.viewport.w),
      h: Math.round(input.viewport.h),
      dpr: round2(input.viewport.dpr),
    },
    userAgent: clamp(input.userAgent ?? '', LIMITS.userAgent),
    console: clampConsole(input.console ?? []),
  };

  const title = collapse(input.title ?? '');
  if (title) meta.title = clamp(title, LIMITS.title);

  const selector = (input.selector ?? '').trim();
  if (selector) meta.selector = clamp(selector, LIMITS.selector);

  if (input.element) {
    meta.element = {
      tag: input.element.tag.toLowerCase(),
      text: clamp(collapse(input.element.text), LIMITS.elementText),
    };
  }

  if (input.click) meta.click = { x: Math.round(input.click.x), y: Math.round(input.click.y) };

  if (input.rect) {
    meta.rect = {
      x: Math.round(input.rect.x),
      y: Math.round(input.rect.y),
      w: Math.round(input.rect.w),
      h: Math.round(input.rect.h),
    };
  }

  return meta;
}

export function metaError(meta: Pick<FeedbackMeta, 'author' | 'comment' | 'page'>): string | null {
  if (!meta.author) return 'A name is required.';
  if (!meta.comment) return 'A comment is required.';
  if (!meta.page) return 'The page is unknown.';
  return null;
}

function clampConsole(entries: ConsoleEntry[]): ConsoleEntry[] {
  const kept = entries.slice(-LIMITS.consoleEntries);
  return kept.map((entry) => ({
    level: entry.level,
    message: clamp(entry.message, LIMITS.consoleMessage),
    at: entry.at,
  }));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
