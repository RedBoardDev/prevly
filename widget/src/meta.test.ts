import { describe, expect, it } from 'vitest';
import { LIMITS } from './limits';
import { buildMeta, metaError } from './meta';
import type { ConsoleEntry } from './types';

const base = {
  author: 'Thomas',
  comment: 'The total is wrong',
  page: '/reports/123?tab=costs',
  viewport: { w: 1440.4, h: 900.7, dpr: 2 },
};

describe('buildMeta', () => {
  it('keeps the contract shape', () => {
    const meta = buildMeta({
      ...base,
      title: 'Report – KARE',
      selector: 'main > table td.total',
      element: { tag: 'TD', text: '  1 234,00 €\n' },
      click: { x: 812.6, y: 403.2 },
      rect: { x: 780.4, y: 390.9, w: 96.2, h: 28.5 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/152.0.0.0 Safari/537.36',
      console: [],
    });

    expect(meta).toEqual({
      author: 'Thomas',
      comment: 'The total is wrong',
      page: '/reports/123?tab=costs',
      title: 'Report – KARE',
      selector: 'main > table td.total',
      element: { tag: 'td', text: '1 234,00 €' },
      click: { x: 813, y: 403 },
      rect: { x: 780, y: 391, w: 96, h: 29 },
      viewport: { w: 1440, h: 901, dpr: 2 },
      client: 'Chrome 152 on macOS',
      console: [],
    });
  });

  it('omits empty optional fields', () => {
    const meta = buildMeta({ ...base, title: '   ', selector: '', element: null });
    expect('title' in meta).toBe(false);
    expect('selector' in meta).toBe(false);
    expect('element' in meta).toBe(false);
    expect('click' in meta).toBe(false);
    expect('rect' in meta).toBe(false);
  });

  it('clamps every bounded field', () => {
    const entries: ConsoleEntry[] = Array.from({ length: 40 }, (_, i) => ({
      level: 'error',
      message: 'z'.repeat(900),
      at: `2026-09-21T10:00:${String(i).padStart(2, '0')}.000Z`,
    }));

    const meta = buildMeta({
      ...base,
      author: 'a'.repeat(200),
      comment: 'c'.repeat(9000),
      title: 't'.repeat(900),
      selector: 's'.repeat(900),
      element: { tag: 'div', text: 'e'.repeat(900) },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/152.0.7977.76 Safari/537.36',
      console: entries,
    });

    expect(meta.author).toHaveLength(LIMITS.author);
    expect(meta.comment).toHaveLength(LIMITS.comment);
    expect(meta.title).toHaveLength(LIMITS.title);
    expect(meta.selector).toHaveLength(LIMITS.selector);
    expect(meta.element?.text).toHaveLength(LIMITS.elementText);
    expect(meta.client).toBe('Chrome 152 on macOS');
    expect(meta.console).toHaveLength(LIMITS.consoleEntries);
    expect(meta.console[0]?.message).toHaveLength(LIMITS.consoleMessage);
    expect(meta.console[0]?.at).toBe('2026-09-21T10:00:20.000Z');
    expect(JSON.stringify(meta).length).toBeLessThan(64 * 1024);
  });
});

describe('metaError', () => {
  it('accepts a complete meta', () => {
    expect(metaError(buildMeta(base))).toBeNull();
  });

  it('rejects an empty author or comment', () => {
    expect(metaError(buildMeta({ ...base, author: '   ' }))).toMatch(/name/i);
    expect(metaError(buildMeta({ ...base, comment: '\n\t' }))).toMatch(/comment/i);
  });
});
