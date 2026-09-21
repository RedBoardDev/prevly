import { describe, expect, it, vi } from 'vitest';
import { formatArgs, startConsoleRecorder } from './console-recorder';

function fakeConsole() {
  return { error: vi.fn(), warn: vi.fn() };
}

describe('startConsoleRecorder', () => {
  it('calls the original console through', () => {
    const sink = fakeConsole();
    const recorder = startConsoleRecorder({ console: sink, target: null });
    sink.error('boom', 42);
    sink.warn('careful');
    expect(sink.error).not.toBe(undefined);
    recorder.stop();
    expect(recorder.entries().map((e) => [e.level, e.message])).toEqual([
      ['error', 'boom 42'],
      ['warn', 'careful'],
    ]);
  });

  it('keeps the original callable and restores it on stop', () => {
    const calls: string[] = [];
    const sink = { error: (m: string) => calls.push(m), warn: () => undefined };
    const original = sink.error;
    const recorder = startConsoleRecorder({ console: sink, target: null });
    expect(sink.error).not.toBe(original);
    sink.error('through');
    expect(calls).toEqual(['through']);
    recorder.stop();
    expect(sink.error).toBe(original);
  });

  it('keeps only the last N entries', () => {
    const sink = fakeConsole();
    const recorder = startConsoleRecorder({ console: sink, target: null, limit: 3 });
    for (let i = 0; i < 10; i += 1) sink.error(`m${i}`);
    recorder.stop();
    expect(recorder.entries().map((e) => e.message)).toEqual(['m7', 'm8', 'm9']);
  });

  it('truncates a long message', () => {
    const sink = fakeConsole();
    const recorder = startConsoleRecorder({ console: sink, target: null, maxMessage: 10 });
    sink.error('x'.repeat(300));
    recorder.stop();
    expect(recorder.entries()[0]?.message).toBe('xxxxxxxxxx');
  });

  it('stamps an ISO date', () => {
    const sink = fakeConsole();
    const recorder = startConsoleRecorder({
      console: sink,
      target: null,
      now: () => new Date('2026-09-21T10:12:33.000Z'),
    });
    sink.warn('hi');
    recorder.stop();
    expect(recorder.entries()[0]?.at).toBe('2026-09-21T10:12:33.000Z');
  });

  it('records window errors and rejections', () => {
    const recorder = startConsoleRecorder({ console: { error: () => undefined, warn: () => undefined } });
    window.dispatchEvent(new ErrorEvent('error', { message: 'kaboom' }));
    const rejection = new Event('unhandledrejection') as Event & { reason?: unknown };
    rejection.reason = new Error('nope');
    window.dispatchEvent(rejection);
    recorder.stop();
    expect(recorder.entries().map((e) => e.message)).toEqual([
      'kaboom',
      'Unhandled rejection: Error: nope',
    ]);
  });

  it('never throws on an unserialisable argument', () => {
    const sink = fakeConsole();
    const recorder = startConsoleRecorder({ console: sink, target: null });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => sink.error(cyclic)).not.toThrow();
    recorder.stop();
    expect(recorder.entries()[0]?.message).toBe('[object Object]');
  });
});

describe('formatArgs', () => {
  it('renders errors, primitives and objects', () => {
    expect(formatArgs(['a', 1, null, undefined, { b: 2 }, new TypeError('bad')])).toBe(
      'a 1 null undefined {"b":2} TypeError: bad',
    );
  });
});
