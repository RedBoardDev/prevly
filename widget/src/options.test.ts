import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_LABELS, LOCALES, resolveOptions } from './options';

describe('resolveOptions', () => {
  afterEach(() => {
    document.documentElement.lang = '';
  });


  it('fills every default', () => {
    const resolved = resolveOptions({ endpoint: '/api/feedback' });

    expect(resolved).toMatchObject({
      endpoint: '/api/feedback',
      reporter: null,
      context: {},
      position: 'bottom-right',
      theme: 'light',
    });
    expect(resolved.labels).toEqual(DEFAULT_LABELS);
    expect(resolved.origins).toEqual([location.origin]);
  });

  it('picks the French label set when the page is tagged fr', () => {
    document.documentElement.lang = 'fr';
    const { labels } = resolveOptions({ endpoint: '/x' });
    expect(labels).toEqual(LOCALES.fr!);
  });

  it('picks French for a regional variant like fr-CA', () => {
    document.documentElement.lang = 'fr-CA';
    expect(resolveOptions({ endpoint: '/x' }).labels).toEqual(LOCALES.fr!);
  });

  it('falls back to English for any other language', () => {
    document.documentElement.lang = 'de';
    expect(resolveOptions({ endpoint: '/x' }).labels).toEqual(DEFAULT_LABELS);
  });

  it('lets an explicit label override the locale pick', () => {
    document.documentElement.lang = 'fr';
    const { labels } = resolveOptions({ endpoint: '/x', labels: { send: 'Go' } });
    expect(labels.send).toBe('Go');
    expect(labels.cancel).toBe(LOCALES.fr!.cancel);
  });

  it('overrides only the labels the host supplies', () => {
    const { labels } = resolveOptions({ endpoint: '/x', labels: { send: 'Envoyer' } });

    expect(labels.send).toBe('Envoyer');
    expect(labels.cancel).toBe(DEFAULT_LABELS.cancel);
  });

  it('ignores an empty or non-string label instead of blanking the button', () => {
    const { labels } = resolveOptions({
      endpoint: '/x',
      labels: { send: '', cancel: 42 as unknown as string },
    });

    expect(labels.send).toBe(DEFAULT_LABELS.send);
    expect(labels.cancel).toBe(DEFAULT_LABELS.cancel);
  });

  it('caps the context at ten keys and clamps keys and values', () => {
    const context: Record<string, string> = { long: 'v'.repeat(400) };
    for (let i = 0; i < 20; i += 1) context[`k${i}`] = `v${i}`;

    const resolved = resolveOptions({ endpoint: '/x', context });

    expect(Object.keys(resolved.context)).toHaveLength(10);
    expect(resolved.context.long).toHaveLength(200);
  });

  it('keeps a supplied reporter and trims it', () => {
    expect(resolveOptions({ endpoint: '/x', reporter: { name: '  Thomas ' } }).reporter).toEqual({
      name: 'Thomas',
    });
    expect(resolveOptions({ endpoint: '/x', reporter: { name: '   ' } }).reporter).toBeNull();
  });

  it('normalises configured origins and drops the unparseable ones', () => {
    const { origins } = resolveOptions({
      endpoint: '/x',
      network: { origins: ['https://api.example.com/v1', 'http://['] },
    });

    expect(origins).toEqual(['https://api.example.com']);
  });

  it('rejects a position and a theme it does not know', () => {
    const resolved = resolveOptions({
      endpoint: '/x',
      position: 'middle' as never,
      theme: 'sepia' as never,
    });

    expect(resolved.position).toBe('bottom-right');
    expect(resolved.theme).toBe('light');
  });

  it('accepts auto and dark, keeping light as the only default', () => {
    expect(resolveOptions({ endpoint: '/x', theme: 'auto' }).theme).toBe('auto');
    expect(resolveOptions({ endpoint: '/x', theme: 'dark' }).theme).toBe('dark');
  });

  it('defaults the correlation header to x-request-id', () => {
    expect(resolveOptions({ endpoint: '/x' }).requestIdHeader).toBe('x-request-id');
  });

  it('accepts a custom correlation header', () => {
    const resolved = resolveOptions({ endpoint: '/x', network: { requestIdHeader: 'x-correlation-id' } });
    expect(resolved.requestIdHeader).toBe('x-correlation-id');
  });

  it('falls back to x-request-id for an empty header name', () => {
    expect(resolveOptions({ endpoint: '/x', network: { requestIdHeader: '' } }).requestIdHeader).toBe(
      'x-request-id',
    );
  });

  it('defaults to the three built-in types with English labels', () => {
    const { types } = resolveOptions({ endpoint: '/x' });
    expect(types).toEqual([
      { id: 'bug', label: 'Bug' },
      { id: 'improvement', label: 'Improvement' },
      { id: 'question', label: 'Question' },
    ]);
  });

  it('accepts a custom type list', () => {
    const { types } = resolveOptions({
      endpoint: '/x',
      types: [
        { id: 'praise', label: 'Praise' },
        { id: 'idea', label: 'Idea' },
      ],
    });
    expect(types).toEqual([
      { id: 'praise', label: 'Praise' },
      { id: 'idea', label: 'Idea' },
    ]);
  });

  it('falls back to the defaults instead of throwing on an invalid type list', () => {
    const cases: Array<unknown> = [
      [],
      [{ id: 'Bad Id', label: 'x' }],
      [{ id: 'ok', label: '' }],
      [{ id: 'dup' }, { id: 'dup', label: 'y' }],
      Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, label: `T${i}` })),
      'not-an-array',
      [{ id: 'a'.repeat(33), label: 'too long' }],
    ];
    for (const types of cases) {
      const resolved = resolveOptions({ endpoint: '/x', types: types as never });
      expect(resolved.types).toEqual([
        { id: 'bug', label: 'Bug' },
        { id: 'improvement', label: 'Improvement' },
        { id: 'question', label: 'Question' },
      ]);
    }
  });
});
