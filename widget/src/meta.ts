import { clientLabel } from './client-label';
import { LIMITS, clamp, collapse } from './limits';
import { DEFAULT_LABELS } from './options';
import type { Labels, ReportType } from './options';
import type {
  ConsoleEntry,
  FeedbackMeta,
  NetworkEntry,
  Point,
  Rect,
  TargetInfo,
  Viewport,
} from './types';

export interface MetaInput {
  type: ReportType;
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
  context?: Record<string, string> | null;
  network?: NetworkEntry[] | null;
}

export function buildMeta(input: MetaInput): FeedbackMeta {
  const meta: FeedbackMeta = {
    type: input.type,
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

  const context = clampContext(input.context ?? {});
  if (Object.keys(context).length) meta.context = context;

  const network = clampNetwork(input.network ?? []);
  if (network.length) meta.network = network;

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

export function metaError(
  meta: Pick<FeedbackMeta, 'author' | 'comment' | 'page'>,
  labels: Pick<Labels, 'nameRequired' | 'commentRequired' | 'pageUnknown'> = DEFAULT_LABELS,
): string | null {
  if (!meta.author) return labels.nameRequired;
  if (!meta.comment) return labels.commentRequired;
  if (!meta.page) return labels.pageUnknown;
  return null;
}

function clampContext(context: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(context)) {
    if (Object.keys(out).length >= LIMITS.contextKeys) break;
    if (!key) continue;
    out[clamp(key, LIMITS.contextKey)] = clamp(String(value), LIMITS.contextValue);
  }
  return out;
}

function clampNetwork(entries: NetworkEntry[]): NetworkEntry[] {
  return entries.slice(-LIMITS.networkEntries).map((entry) => {
    const out: NetworkEntry = {
      method: entry.method,
      path: clamp(entry.path, LIMITS.networkPath),
      status: entry.status,
      at: entry.at,
    };
    if (entry.requestId) out.requestId = clamp(entry.requestId, LIMITS.requestId);
    return out;
  });
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
