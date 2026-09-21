export const COOKIE_NAME = 'prevly_feedback';
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

// The flag lives in a cookie, not in storage: the daemon sets it from
// /_prevly/activate because an app that redirects the entry URL to a login page
// drops the query string before any script of ours runs.
export function readCookieFlag(cookie: string): boolean {
  return cookie
    .split(';')
    .some((part) => part.trim() === `${COOKIE_NAME}=1`);
}

export function activationCookie(on: boolean): string {
  const age = on ? 60 * 60 * 24 * 90 : 0;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${on ? '1' : ''}; Path=/; Max-Age=${age}; SameSite=Lax${secure}`;
}
