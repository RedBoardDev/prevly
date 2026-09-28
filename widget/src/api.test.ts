import { describe, expect, it, vi } from 'vitest';
import { API_PATH, createApi, parseRetryAfter } from './api';
import { buildMeta } from './meta';
import type { FeedbackItem } from './types';

const meta = buildMeta({
  type: 'bug',
  author: 'Thomas',
  comment: 'The total is wrong',
  page: '/reports?tab=costs',
  viewport: { w: 1440, h: 900, dpr: 2 },
});

function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('list', () => {
  it('returns the items array, not locked', async () => {
    const items: FeedbackItem[] = [
      { id: '1', page: '/a', author: 'T', comment: 'c', created_at: '2026-09-21T10:00:00Z' },
    ];
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { items }));
    const api = createApi({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(api.list()).resolves.toEqual({ items, locked: false });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(API_PATH);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
  });

  it('is locked on a 401: the server has a list route but nobody activated it', async () => {
    const api = createApi({
      fetchImpl: vi.fn().mockResolvedValue(new Response('nope', { status: 401 })) as unknown as typeof fetch,
    });
    await expect(api.list()).resolves.toEqual({ items: [], locked: true });
  });

  it('is not locked on a 404: the server simply has no list route', async () => {
    const api = createApi({
      fetchImpl: vi.fn().mockResolvedValue(new Response('nope', { status: 404 })) as unknown as typeof fetch,
    });
    await expect(api.list()).resolves.toEqual({ items: [], locked: false });
  });

  it('returns an empty, unlocked list on a server error', async () => {
    const api = createApi({
      fetchImpl: vi.fn().mockResolvedValue(new Response('nope', { status: 500 })) as unknown as typeof fetch,
    });
    await expect(api.list()).resolves.toEqual({ items: [], locked: false });
  });

  it('returns an empty, unlocked list when the network throws', async () => {
    const api = createApi({
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch,
    });
    await expect(api.list()).resolves.toEqual({ items: [], locked: false });
  });
});

describe('submit', () => {
  it('posts a multipart body with a meta json part and a png part', async () => {
    let body: FormData | null = null;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      body = init.body as FormData;
      return jsonResponse(201, { item: { id: '01J8', page: '/a' } });
    });
    const api = createApi({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    const result = await api.submit(meta, png);

    expect(result).toEqual({ ok: true, item: { id: '01J8', page: '/a' } });
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });

    const form = body as unknown as FormData;
    expect(Array.from(form.keys()).sort()).toEqual(['meta', 'screenshot']);

    const metaPart = form.get('meta') as Blob;
    expect(metaPart.type).toBe('application/json');
    expect(JSON.parse(await readText(metaPart))).toEqual(meta);

    const shotPart = form.get('screenshot') as Blob;
    expect(shotPart.type).toBe('image/png');
    expect(shotPart.size).toBe(4);
  });

  it('omits the screenshot part when there is no image', async () => {
    let body: FormData | null = null;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      body = init.body as FormData;
      return jsonResponse(201, { item: { id: '1', page: '/a' } });
    });
    const api = createApi({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await api.submit(meta, null);
    expect(Array.from((body as unknown as FormData).keys())).toEqual(['meta']);
  });

  it('reports a rate limit with its retry delay', async () => {
    const api = createApi({
      fetchImpl: vi
        .fn()
        .mockResolvedValue(
          jsonResponse(429, { error: 'too many' }, { 'retry-after': '42' }),
        ) as unknown as typeof fetch,
    });

    const result = await api.submit(meta, null);
    expect(result).toMatchObject({ ok: false, kind: 'rate-limit', retryAfter: 42 });
  });

  it('reports a rate limit without a Retry-After header', async () => {
    const api = createApi({
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(429, {})) as unknown as typeof fetch,
    });
    expect(await api.submit(meta, null)).toMatchObject({ kind: 'rate-limit', retryAfter: null });
  });

  it('surfaces the server error on a 400', async () => {
    const api = createApi({
      fetchImpl: vi
        .fn()
        .mockResolvedValue(jsonResponse(400, { error: 'meta too large' })) as unknown as typeof fetch,
    });
    expect(await api.submit(meta, null)).toEqual({
      ok: false,
      kind: 'error',
      message: '400 · meta too large',
    });
  });

  it('is locked on a 401', async () => {
    const api = createApi({
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(401, { error: 'locked' })) as unknown as typeof fetch,
    });
    expect(await api.submit(meta, null)).toEqual({ ok: false, kind: 'locked' });
  });

  it('surfaces a network failure', async () => {
    const api = createApi({
      fetchImpl: vi.fn().mockRejectedValue(new Error('connection reset')) as unknown as typeof fetch,
    });
    expect(await api.submit(meta, null)).toEqual({
      ok: false,
      kind: 'error',
      message: 'connection reset',
    });
  });
});

describe('parseRetryAfter', () => {
  it('reads seconds and dates', () => {
    expect(parseRetryAfter('30')).toBe(30);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('nonsense')).toBeNull();
    expect(parseRetryAfter(new Date(Date.now() + 10_000).toUTCString())).toBeGreaterThanOrEqual(9);
  });
});
