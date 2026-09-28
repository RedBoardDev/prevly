import { describe, expect, it } from 'vitest';
import { endpointFromScriptAttr } from './endpoint';

describe('endpointFromScriptAttr', () => {
  it('uses the attribute when it is a same-origin path', () => {
    expect(endpointFromScriptAttr('/api/prevly-feedback')).toBe('/api/prevly-feedback');
  });

  it('falls back to the default when the attribute is absent or empty', () => {
    expect(endpointFromScriptAttr(null)).toBe('/_prevly/api/feedback');
    expect(endpointFromScriptAttr(undefined)).toBe('/_prevly/api/feedback');
    expect(endpointFromScriptAttr('')).toBe('/_prevly/api/feedback');
  });

  it('rejects a protocol-relative or absolute URL, falling back to the default', () => {
    expect(endpointFromScriptAttr('//evil.example.com/feedback')).toBe('/_prevly/api/feedback');
    expect(endpointFromScriptAttr('https://evil.example.com/feedback')).toBe('/_prevly/api/feedback');
  });

  it('rejects a relative path with no leading slash', () => {
    expect(endpointFromScriptAttr('api/feedback')).toBe('/_prevly/api/feedback');
  });
});
