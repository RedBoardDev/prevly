export type ReportType = 'bug' | 'design' | 'question';

export const REPORT_TYPES: readonly ReportType[] = ['bug', 'design', 'question'];

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export const CORNERS: readonly Corner[] = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];

export type Theme = 'auto' | 'light' | 'dark';

export interface Reporter {
  name: string;
}

export interface NetworkOptions {
  origins?: string[];
}

export interface Labels {
  badge: string;
  close: string;
  reports: string;
  panel: string;
  comment: string;
  commentPlaceholder: string;
  type: string;
  typeBug: string;
  typeDesign: string;
  typeQuestion: string;
  name: string;
  namePlaceholder: string;
  reportingAs: string;
  changeName: string;
  send: string;
  sending: string;
  sendHint: string;
  cancel: string;
  point: string;
  pickerHint: string;
  undo: string;
  clear: string;
  noScreenshot: string;
  commentRequired: string;
  nameRequired: string;
  pageUnknown: string;
  sendFailed: string;
  rateLimited: string;
  retryIn: string;
  sent: string;
  sentPending: string;
  openReport: string;
  pin: string;
  from: string;
}

export const DEFAULT_LABELS: Labels = {
  badge: 'Report a problem',
  close: 'Hide',
  reports: 'reports on this page',
  panel: 'New report',
  comment: 'What happened?',
  commentPlaceholder: 'Describe it in one sentence',
  type: 'Type',
  typeBug: 'Bug',
  typeDesign: 'Design',
  typeQuestion: 'Question',
  name: 'Your name',
  namePlaceholder: 'Your name',
  reportingAs: 'Reporting as',
  changeName: 'change',
  send: 'Send',
  sending: 'Sending…',
  sendHint: 'Ctrl/Cmd + Enter',
  cancel: 'Cancel',
  point: 'Point at something',
  pickerHint: 'Click the element to report · Esc to cancel',
  undo: 'Undo',
  clear: 'Clear',
  noScreenshot: 'The screenshot could not be captured. The report can still be sent without an image.',
  commentRequired: 'A comment is required.',
  nameRequired: 'A name is required.',
  pageUnknown: 'The page is unknown.',
  sendFailed: 'Sending failed.',
  rateLimited: 'Too many reports. Try again in a moment.',
  retryIn: 'retry in',
  sent: 'Sent',
  sentPending: 'Sent, comment pending',
  openReport: 'open',
  pin: 'Report',
  from: 'from',
};

export interface MountOptions {
  endpoint: string;
  reporter?: Reporter;
  context?: Record<string, string>;
  labels?: Partial<Labels>;
  position?: Corner;
  shortcut?: string;
  network?: NetworkOptions;
  theme?: Theme;
}

export interface ResolvedOptions {
  endpoint: string;
  reporter: Reporter | null;
  context: Record<string, string>;
  labels: Labels;
  position: Corner;
  shortcut: string;
  origins: string[];
  theme: Theme;
}

const CONTEXT_LIMITS = { keys: 10, key: 200, value: 200 } as const;

export function resolveOptions(input: MountOptions): ResolvedOptions {
  return {
    endpoint: typeof input?.endpoint === 'string' ? input.endpoint : '',
    reporter: reporterOf(input?.reporter),
    context: contextOf(input?.context),
    labels: { ...DEFAULT_LABELS, ...cleanLabels(input?.labels) },
    position: CORNERS.includes(input?.position as Corner)
      ? (input.position as Corner)
      : 'bottom-right',
    shortcut: shortcutOf(input?.shortcut),
    origins: originsOf(input?.network?.origins),
    theme: input?.theme === 'light' || input?.theme === 'dark' ? input.theme : 'auto',
  };
}

function reporterOf(reporter: Reporter | undefined): Reporter | null {
  const name = typeof reporter?.name === 'string' ? reporter.name.trim() : '';
  return name ? { name } : null;
}

function contextOf(context: Record<string, string> | undefined): Record<string, string> {
  if (!context || typeof context !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(context)) {
    if (Object.keys(out).length >= CONTEXT_LIMITS.keys) break;
    if (!key || value === null || value === undefined) continue;
    out[key.slice(0, CONTEXT_LIMITS.key)] = String(value).slice(0, CONTEXT_LIMITS.value);
  }
  return out;
}

function cleanLabels(labels: Partial<Labels> | undefined): Partial<Labels> {
  if (!labels || typeof labels !== 'object') return {};
  const out: Partial<Labels> = {};
  for (const [key, value] of Object.entries(labels)) {
    if (typeof value === 'string' && value) out[key as keyof Labels] = value;
  }
  return out;
}

function shortcutOf(shortcut: string | undefined): string {
  const key = typeof shortcut === 'string' ? shortcut.trim() : '';
  return key.length === 1 ? key.toLowerCase() : 'f';
}

function originsOf(origins: string[] | undefined): string[] {
  const base = typeof location !== 'undefined' ? location.origin : '';
  if (!Array.isArray(origins) || origins.length === 0) return base ? [base] : [];
  const out: string[] = [];
  for (const entry of origins) {
    if (typeof entry !== 'string' || !entry) continue;
    try {
      out.push(new URL(entry, base || undefined).origin);
    } catch {
      /* an unparseable origin captures nothing rather than everything */
    }
  }
  return out;
}
