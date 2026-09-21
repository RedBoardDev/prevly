import { describe, expect, it } from 'vitest';
import { parseActivationUrl } from './activation';

describe('parseActivationUrl', () => {
  it('ignores a plain url', () => {
    expect(parseActivationUrl('https://pr-1.example.com/reports?tab=costs')).toEqual({
      requested: false,
      cleanedUrl: null,
    });
  });

  it('ignores a flag with another value', () => {
    expect(parseActivationUrl('https://x.test/?prevly_feedback=0').requested).toBe(false);
  });

  it('detects the query flag and strips only it', () => {
    const result = parseActivationUrl('https://x.test/reports?tab=costs&prevly_feedback=1');
    expect(result.requested).toBe(true);
    expect(result.cleanedUrl).toBe('/reports?tab=costs');
  });

  it('drops the question mark when the flag was the only parameter', () => {
    expect(parseActivationUrl('https://x.test/reports?prevly_feedback=1').cleanedUrl).toBe(
      '/reports',
    );
  });

  it('detects the hash flag and strips it', () => {
    const result = parseActivationUrl('https://x.test/a/b#prevly-feedback');
    expect(result.requested).toBe(true);
    expect(result.cleanedUrl).toBe('/a/b');
  });

  it('keeps an unrelated hash', () => {
    expect(parseActivationUrl('https://x.test/a?prevly_feedback=1#section').cleanedUrl).toBe(
      '/a#section',
    );
  });

  it('survives a malformed url', () => {
    expect(parseActivationUrl('not a url').requested).toBe(false);
  });
});
