export const LIMITS = {
  author: 80,
  comment: 4000,
  page: 2000,
  title: 200,
  selector: 500,
  elementText: 120,
  client: 80,
  attrValue: 80,
  classes: 6,
  ancestors: 6,
  pathDepth: 20,
  consoleEntries: 20,
  consoleMessage: 500,
  networkEntries: 5,
  networkPath: 200,
  requestId: 100,
  contextKeys: 10,
  contextKey: 200,
  contextValue: 200,
} as const;

export function clamp(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

export function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
