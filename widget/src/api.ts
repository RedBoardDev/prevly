import type { FeedbackItem, FeedbackMeta } from './types';

export const API_PATH = '/_prevly/api/feedback';

export type SubmitResult =
  | { ok: true; item: FeedbackItem }
  | { ok: false; kind: 'rate-limit'; retryAfter: number | null; message: string }
  | { ok: false; kind: 'error'; message: string };

export interface FeedbackApi {
  list(): Promise<FeedbackItem[]>;
  submit(meta: FeedbackMeta, screenshot: Blob | null): Promise<SubmitResult>;
}

export interface ApiOptions {
  path?: string;
  fetchImpl?: typeof fetch;
}

export function createApi(options: ApiOptions = {}): FeedbackApi {
  const path = options.path ?? API_PATH;
  const doFetch: typeof fetch = options.fetchImpl ?? ((...args) => fetch(...args));

  return {
    async list(): Promise<FeedbackItem[]> {
      try {
        const response = await doFetch(path, {
          method: 'GET',
          headers: { accept: 'application/json' },
          credentials: 'same-origin',
        });
        if (!response.ok) return [];
        const body = (await response.json()) as { items?: unknown };
        return Array.isArray(body?.items) ? (body.items as FeedbackItem[]) : [];
      } catch {
        return [];
      }
    },

    async submit(meta: FeedbackMeta, screenshot: Blob | null): Promise<SubmitResult> {
      const form = new FormData();
      form.append(
        'meta',
        new Blob([JSON.stringify(meta)], { type: 'application/json' }),
        'meta.json',
      );
      if (screenshot) form.append('screenshot', screenshot, 'screenshot.png');

      let response: Response;
      try {
        response = await doFetch(path, {
          method: 'POST',
          body: form,
          credentials: 'same-origin',
        });
      } catch (error) {
        return { ok: false, kind: 'error', message: errorText(error) };
      }

      if (response.status === 429) {
        return {
          ok: false,
          kind: 'rate-limit',
          retryAfter: parseRetryAfter(response.headers?.get('retry-after') ?? null),
          message: 'Too many reports from this preview. Try again in a moment.',
        };
      }

      if (response.status === 201 || response.status === 200) {
        try {
          const body = (await response.json()) as { item?: FeedbackItem };
          if (body?.item) return { ok: true, item: body.item };
        } catch {
          /* fall through to the generic error below */
        }
        return { ok: false, kind: 'error', message: 'The server returned an unexpected answer.' };
      }

      return { ok: false, kind: 'error', message: await failureText(response) };
    },
  };
}

export function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, Math.round((date - Date.now()) / 1000));
  return null;
}

async function failureText(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown };
    const detail = typeof body?.error === 'string' ? body.error : body?.message;
    if (typeof detail === 'string' && detail) return `${response.status} · ${detail}`;
  } catch {
    /* body is not JSON */
  }
  return `Sending failed (HTTP ${response.status}).`;
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Network error.';
}
