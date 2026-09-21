import { clientLabel } from './client-label';
import { LIMITS, clamp, collapse } from './limits';
import type { ConsoleEntry, FeedbackMeta, Point, Rect, TargetInfo, Viewport } from './types';

export interface MetaInput {
  author: string;
  comment: string;
  page: string;
  title?: string | null;
  selector?: string | null;
  element?: TargetInfo | null;
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
    client: clamp(clientLabel(input.userAgent ?? ''), LIMITS.client),
    console: clampConsole(input.console ?? []),
  };

  const title = collapse(input.title ?? '');
  if (title) meta.title = clamp(title, LIMITS.title);

  const selector = (input.selector ?? '').trim();
  if (selector) meta.selector = clamp(selector, LIMITS.selector);

  if (input.element) {
    const el = input.element;
    const target: TargetInfo = {
      tag: el.tag.toLowerCase(),
      text: clamp(collapse(el.text), LIMITS.elementText),
    };
    if (el.xpath) target.xpath = clamp(el.xpath, LIMITS.selector);
    if (el.attrs && Object.keys(el.attrs).length) target.attrs = el.attrs;
    if (el.classes?.length) target.classes = el.classes;
    if (el.ancestors?.length) target.ancestors = el.ancestors;
    if (el.heading) target.heading = clamp(collapse(el.heading), LIMITS.elementText);
    meta.element = target;
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
