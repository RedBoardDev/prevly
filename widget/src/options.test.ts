import { describe, expect, it } from 'vitest';
import { DEFAULT_LABELS, resolveOptions } from './options';

describe('resolveOptions', () => {
  it('fills every default', () => {
    const resolved = resolveOptions({ endpoint: '/api/feedback' });

    expect(resolved).toMatchObject({
      endpoint: '/api/feedback',
      reporter: null,
      context: {},
      position: 'bottom-right',
      shortcut: 'f',
      theme: 'auto',
    });
    expect(resolved.labels).toEqual(DEFAULT_LABELS);
    expect(resolved.origins).toEqual([location.origin]);
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

  it('falls back to f for a shortcut that is not a single key', () => {
    expect(resolveOptions({ endpoint: '/x', shortcut: 'K' }).shortcut).toBe('k');
    expect(resolveOptions({ endpoint: '/x', shortcut: 'ctrl+k' }).shortcut).toBe('f');
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
    expect(resolved.theme).toBe('auto');
  });
});
