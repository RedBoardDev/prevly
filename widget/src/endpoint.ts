const DEFAULT_ENDPOINT = '/_prevly/api/feedback';

// endpointFromScriptAttr resolves the embedded script's data-endpoint
// attribute into an endpoint to POST to: the attribute itself when it is a
// same-origin path, the default otherwise. "//host/path" is protocol-relative,
// not same-origin, so it is rejected like any other absolute URL.
export function endpointFromScriptAttr(attr: string | null | undefined): string {
  if (typeof attr !== 'string' || !attr) return DEFAULT_ENDPOINT;
  if (!attr.startsWith('/') || attr.startsWith('//')) return DEFAULT_ENDPOINT;
  return attr;
}
