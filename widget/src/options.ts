// ReportType used to be the closed 'bug' | 'design' | 'question' union; it is
// now any id from the resolved `types` list, so it is kept as a plain string
// alias for signature compatibility.
export type ReportType = string;

export const REPORT_TYPES: readonly ReportType[] = ['bug', 'design', 'question'];

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export const CORNERS: readonly Corner[] = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];

export type Theme = 'auto' | 'light' | 'dark';

export interface Reporter {
  name: string;
}

export interface NetworkOptions {
  origins?: string[];
  // The response header read into the payload's requestId field. x-request-id
  // is one API's convention, not a standard: a host using x-correlation-id or
  // traceparent sets this instead. The payload field stays named requestId
  // regardless of what the header was called.
  requestIdHeader?: string;
}

// A report type the host offers in the panel's selector. id travels in the
// payload's `type` field and must be safe to embed in a URL or a Go switch
// case; label is what the reviewer sees.
export interface TypeOption {
  id: string;
  label: string;
}

const TYPE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const MAX_TYPES = 8;

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
  locked: string;
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
  locked: 'Open this preview from the link in the pull request to send feedback.',
};

const FRENCH_LABELS: Labels = {
  badge: 'Signaler un problème',
  close: 'Masquer',
  reports: 'signalements sur cette page',
  panel: 'Nouveau signalement',
  comment: "Que s'est-il passé ?",
  commentPlaceholder: 'Décrivez-le en une phrase',
  type: 'Type',
  typeBug: 'Bug',
  typeDesign: 'Design',
  typeQuestion: 'Question',
  name: 'Votre nom',
  namePlaceholder: 'Votre nom',
  reportingAs: 'Signalé en tant que',
  changeName: 'modifier',
  send: 'Envoyer',
  sending: 'Envoi…',
  sendHint: 'Ctrl/Cmd + Entrée',
  cancel: 'Annuler',
  point: 'Pointer un élément',
  pickerHint: "Cliquez sur l'élément à signaler · Échap pour annuler",
  undo: 'Annuler',
  clear: 'Effacer',
  noScreenshot:
    "La capture d'écran n'a pas pu être réalisée. Le signalement peut quand même être envoyé sans image.",
  commentRequired: 'Un commentaire est requis.',
  nameRequired: 'Un nom est requis.',
  pageUnknown: 'La page est inconnue.',
  sendFailed: "L'envoi a échoué.",
  rateLimited: 'Trop de signalements. Réessayez dans un instant.',
  retryIn: 'nouvel essai dans',
  sent: 'Envoyé',
  sentPending: 'Envoyé, commentaire en attente',
  openReport: 'ouvrir',
  pin: 'Signalement',
  from: 'de',
  locked: 'Ouvrez cet aperçu depuis le lien de la pull request pour envoyer un signalement.',
};

// LOCALES maps a locale key to its complete label set. Adding a language is one
// entry here, not a special case in resolveOptions.
export const LOCALES: Record<string, Labels> = {
  en: DEFAULT_LABELS,
  fr: FRENCH_LABELS,
};

// localeFor resolves document.documentElement.lang into one of LOCALES' keys:
// 'fr' and any 'fr-*' regional variant pick French, everything else English.
function localeFor(lang: string | null | undefined): string {
  const l = (lang ?? '').toLowerCase();
  if (l === 'fr' || l.startsWith('fr-')) return 'fr';
  return 'en';
}

export interface MountOptions {
  endpoint: string;
  reporter?: Reporter;
  context?: Record<string, string>;
  labels?: Partial<Labels>;
  position?: Corner;
  network?: NetworkOptions;
  theme?: Theme;
  types?: TypeOption[];
}

export interface ResolvedOptions {
  endpoint: string;
  reporter: Reporter | null;
  context: Record<string, string>;
  labels: Labels;
  position: Corner;
  origins: string[];
  requestIdHeader: string;
  theme: Theme;
  types: TypeOption[];
}

const CONTEXT_LIMITS = { keys: 10, key: 200, value: 200 } as const;

export function resolveOptions(input: MountOptions): ResolvedOptions {
  const documentLang = typeof document !== 'undefined' ? document.documentElement.lang : undefined;
  const base = LOCALES[localeFor(documentLang)] ?? DEFAULT_LABELS;
  const labels = { ...base, ...cleanLabels(input?.labels) };
  return {
    endpoint: typeof input?.endpoint === 'string' ? input.endpoint : '',
    reporter: reporterOf(input?.reporter),
    context: contextOf(input?.context),
    labels,
    position: CORNERS.includes(input?.position as Corner)
      ? (input.position as Corner)
      : 'bottom-right',
    origins: originsOf(input?.network?.origins),
    requestIdHeader: requestIdHeaderOf(input?.network?.requestIdHeader),
    theme: input?.theme === 'auto' || input?.theme === 'dark' ? input.theme : 'light',
    types: typesOf(input?.types, labels),
  };
}

function defaultTypes(labels: Labels): TypeOption[] {
  return [
    { id: 'bug', label: labels.typeBug },
    { id: 'design', label: labels.typeDesign },
    { id: 'question', label: labels.typeQuestion },
  ];
}

// typesOf validates the host's list and falls back to the default three on
// anything wrong, rather than throwing: mountFeedback must never throw.
function typesOf(types: TypeOption[] | undefined, labels: Labels): TypeOption[] {
  if (!Array.isArray(types) || types.length === 0 || types.length > MAX_TYPES) {
    return defaultTypes(labels);
  }
  const seen = new Set<string>();
  const out: TypeOption[] = [];
  for (const entry of types) {
    const id = entry?.id;
    const label = entry?.label;
    if (typeof id !== 'string' || !TYPE_ID_PATTERN.test(id)) return defaultTypes(labels);
    if (typeof label !== 'string' || !label) return defaultTypes(labels);
    if (seen.has(id)) return defaultTypes(labels);
    seen.add(id);
    out.push({ id, label });
  }
  return out;
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

function requestIdHeaderOf(header: string | undefined): string {
  const name = typeof header === 'string' ? header.trim() : '';
  return name || 'x-request-id';
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
