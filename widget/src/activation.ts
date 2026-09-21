export const FLAG_KEY = 'prevly.feedback';
export const AUTHOR_KEY = 'prevly.feedback.author';
export const QUERY_FLAG = 'prevly_feedback';
export const HASH_FLAG = '#prevly-feedback';

export interface UrlActivation {
  requested: boolean;
  cleanedUrl: string | null;
}

export function parseActivationUrl(href: string): UrlActivation {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { requested: false, cleanedUrl: null };
  }

  const byQuery = url.searchParams.get(QUERY_FLAG) === '1';
  const byHash = url.hash === HASH_FLAG;
  if (!byQuery && !byHash) return { requested: false, cleanedUrl: null };

  if (byQuery) url.searchParams.delete(QUERY_FLAG);
  if (byHash) url.hash = '';

  return { requested: true, cleanedUrl: url.pathname + url.search + url.hash };
}

export function readFlag(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    return storage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(storage: Pick<Storage, 'setItem' | 'removeItem'>, on: boolean): void {
  try {
    if (on) storage.setItem(FLAG_KEY, '1');
    else storage.removeItem(FLAG_KEY);
  } catch {
    /* storage unavailable: the widget still works for this page load */
  }
}
