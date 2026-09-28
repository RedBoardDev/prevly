import { describe, expect, it, vi } from 'vitest';
import { startNetworkRecorder } from './network-recorder';
import type { NetworkTarget } from './network-recorder';

const BASE = 'https://app.example.com/reports/1';

function response(status: number, requestId?: string): Response {
  return {
    status,
    headers: { get: (name: string) => (name === 'x-request-id' ? (requestId ?? null) : null) },
  } as unknown as Response;
}

function recorderOn(fetchImpl: typeof fetch, origins = ['https://app.example.com']) {
  const target: NetworkTarget = { fetch: fetchImpl };
  const recorder = startNetworkRecorder({
    target,
    origins,
    base: BASE,
    now: () => new Date('2026-09-28T09:12:33.000Z'),
  });
  return { recorder, target };
}

describe('network capture', () => {
  it('keeps a 500 on a watched origin, with the request id and no query string', async () => {
    const { recorder, target } = recorderOn(vi.fn(async () => response(500, 'req-9f2c')) as unknown as typeof fetch);
    await target.fetch?.('/rs/v1/reports/123?tab=costs&secret=abc');

    expect(recorder.entries()).toEqual([
      {
        method: 'GET',
        path: '/rs/v1/reports/123',
        status: 500,
        requestId: 'req-9f2c',
        at: '2026-09-28T09:12:33.000Z',
      },
    ]);
  });

  it('ignores a 404 and a 401', async () => {
    const statuses = [404, 401, 200, 302];
    let i = 0;
    const { recorder, target } = recorderOn(vi.fn(async () => response(statuses[i++] ?? 200)) as unknown as typeof fetch);
    for (const _ of statuses) await target.fetch?.('/api/thing');

    expect(recorder.entries()).toEqual([]);
  });

  it('ignores a third-party origin even when it fails', async () => {
    const { recorder, target } = recorderOn(vi.fn(async () => response(503)) as unknown as typeof fetch);
    await target.fetch?.('https://analytics.example.net/collect');

    expect(recorder.entries()).toEqual([]);
  });

  it('defaults to the page origin when no origin is configured', async () => {
    const { recorder, target } = recorderOn(
      vi.fn(async () => response(503)) as unknown as typeof fetch,
      ['https://app.example.com'],
    );
    await target.fetch?.('https://app.example.com/api/a');
    await target.fetch?.('https://other.example.com/api/b');

    expect(recorder.entries().map((entry) => entry.path)).toEqual(['/api/a']);
  });

  it('keeps a request that never completed, with status 0', async () => {
    const boom = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const { recorder, target } = recorderOn(boom as unknown as typeof fetch);

    await expect(target.fetch?.('/api/save')).rejects.toThrow('Failed to fetch');
    expect(recorder.entries()).toEqual([
      { method: 'GET', path: '/api/save', status: 0, at: '2026-09-28T09:12:33.000Z' },
    ]);
  });

  it('caps the buffer at five entries, keeping the newest', async () => {
    const { recorder, target } = recorderOn(vi.fn(async () => response(500)) as unknown as typeof fetch);
    for (let i = 1; i <= 8; i += 1) await target.fetch?.(`/api/${i}`);

    const paths = recorder.entries().map((entry) => entry.path);
    expect(paths).toEqual(['/api/4', '/api/5', '/api/6', '/api/7', '/api/8']);
  });

  it('clamps a very long path', async () => {
    const { recorder, target } = recorderOn(vi.fn(async () => response(500)) as unknown as typeof fetch);
    await target.fetch?.(`/${'a'.repeat(400)}`);

    expect(recorder.entries()[0]?.path).toHaveLength(200);
  });

  it('calls through and returns the original response', async () => {
    const original = response(200);
    const inner = vi.fn(async () => original);
    const { target } = recorderOn(inner as unknown as typeof fetch);

    await expect(target.fetch?.('/api/ok')).resolves.toBe(original);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('records nothing and still calls through when the url cannot be parsed', async () => {
    const inner = vi.fn(async () => response(500));
    const { recorder, target } = recorderOn(inner as unknown as typeof fetch);

    await target.fetch?.('http://[');
    expect(inner).toHaveBeenCalledTimes(1);
    expect(recorder.entries()).toEqual([]);
  });

  it('restores the original fetch on stop', () => {
    const inner = vi.fn(async () => response(200)) as unknown as typeof fetch;
    const { recorder, target } = recorderOn(inner);
    expect(target.fetch).not.toBe(inner);

    recorder.stop();
    expect(target.fetch).toBe(inner);
  });

  it('captures a failed XMLHttpRequest and ignores a 204', () => {
    const listeners = new Map<string, Array<() => void>>();
    class FakeXHR {
      status = 0;
      open(_method: string, _url: string): void {
        /* patched */
      }
      send(): void {
        /* patched */
      }
      addEventListener(type: string, listener: () => void): void {
        const bucket = listeners.get(type) ?? [];
        bucket.push(listener);
        listeners.set(type, bucket);
      }
      getResponseHeader(): string | null {
        return 'req-xhr';
      }
    }
    const target: NetworkTarget = { XMLHttpRequest: FakeXHR as unknown as typeof XMLHttpRequest };
    const recorder = startNetworkRecorder({
      target,
      origins: ['https://app.example.com'],
      base: BASE,
      now: () => new Date('2026-09-28T09:12:33.000Z'),
    });

    const xhr = new FakeXHR();
    xhr.open('post', '/api/save?x=1');
    xhr.send();
    for (const listener of listeners.get('error') ?? []) listener();

    expect(recorder.entries()).toEqual([
      {
        method: 'POST',
        path: '/api/save',
        status: 0,
        requestId: 'req-xhr',
        at: '2026-09-28T09:12:33.000Z',
      },
    ]);
    recorder.stop();
  });
});
