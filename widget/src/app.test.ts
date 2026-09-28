import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApi } from './api';
import { createApp } from './app';
import type { App } from './app';
import { startConsoleRecorder } from './console-recorder';
import { startNetworkRecorder } from './network-recorder';
import { resolveOptions } from './options';
import { createStorage } from './storage';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

async function readMeta(body: BodyInit | null | undefined): Promise<Record<string, unknown>> {
  const form = body as FormData;
  const part = form.get('meta') as Blob;
  return JSON.parse(await readBlobText(part));
}

let app: App | null = null;

// jsdom has no canvas backend; the panel already treats a null 2D context as
// "nothing to draw", so this is enough for a page-level report (no screenshot).
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  app?.unmount();
  app = null;
  document.body.innerHTML = '';
});

describe('a host-configured report type, end to end', () => {
  it('flows from resolveOptions through the panel into the posted payload', async () => {
    const posted: Array<Record<string, unknown>> = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit = {}) => {
      if ((init.method ?? 'GET') === 'GET') return jsonResponse(200, { items: [] });
      posted.push(await readMeta(init.body));
      return jsonResponse(201, {
        item: { id: '1', page: '/', author: 'Jordan', comment: 'x', created_at: new Date().toISOString() },
      });
    });

    const options = resolveOptions({
      endpoint: '/_prevly/api/feedback',
      reporter: { name: 'Jordan' },
      types: [
        { id: 'praise', label: 'Praise' },
        { id: 'idea', label: 'Idea' },
      ],
    });
    expect(options.types.map((t) => t.id)).toEqual(['praise', 'idea']);

    app = createApp({
      options,
      recorder: startConsoleRecorder(),
      network: startNetworkRecorder({ target: {} }),
      storage: createStorage(null, 'test-host'),
      api: createApi({ path: options.endpoint, fetchImpl: fetchImpl as unknown as typeof fetch }),
    });
    app.open();

    const host = document.querySelector('prevly-feedback');
    const root = host?.shadowRoot;
    expect(root).toBeTruthy();

    const ideaButton = root!.querySelector('[data-prevly-type="idea"]') as HTMLButtonElement;
    expect(ideaButton).toBeTruthy();
    ideaButton.click();

    const comment = root!.querySelector('[data-prevly="comment"]') as HTMLTextAreaElement;
    comment.value = 'This report carries a host-defined type.';
    comment.dispatchEvent(new Event('input'));

    const send = root!.querySelector('[data-prevly="send"]') as HTMLButtonElement;
    send.click();

    await vi.waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.type).toBe('idea');
    expect(posted[0]?.comment).toBe('This report carries a host-defined type.');
  });
});
