import type { FeedbackItem } from './types';

export interface NumberedItem {
  item: FeedbackItem;
  n: number;
}

export interface PinTarget extends NumberedItem {
  el: Element;
}

export interface PinResolution {
  matched: PinTarget[];
  orphans: NumberedItem[];
}

export function currentPage(location: Pick<Location, 'pathname' | 'search'>): string {
  return `${location.pathname}${location.search}`;
}

export function forPage(items: FeedbackItem[], page: string): FeedbackItem[] {
  return items
    .filter((item) => item && item.page === page)
    .slice()
    .sort(byCreatedAt);
}

export function resolvePins(
  items: FeedbackItem[],
  page: string,
  root: ParentNode,
  exclude?: Node | null,
): PinResolution {
  const matched: PinTarget[] = [];
  const orphans: NumberedItem[] = [];

  forPage(items, page).forEach((item, index) => {
    const n = index + 1;
    const el = item.selector ? query(root, item.selector) : null;
    if (el && (!exclude || !exclude.contains(el))) matched.push({ item, n, el });
    else orphans.push({ item, n });
  });

  return { matched, orphans };
}

function query(root: ParentNode, selector: string): Element | null {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function byCreatedAt(a: FeedbackItem, b: FeedbackItem): number {
  const ta = Date.parse(a.created_at ?? '');
  const tb = Date.parse(b.created_at ?? '');
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}
