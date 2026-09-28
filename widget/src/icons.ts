const OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';

export const ICON_BADGE = `${OPEN}<path d="M20.5 11.7a8.2 8.2 0 0 1-8.8 8.2 8.8 8.8 0 0 1-3.3-.8L3.5 20.5l1.4-4.6a8.2 8.2 0 0 1-1.4-4.6 8.2 8.2 0 0 1 8.2-8.2 8.2 8.2 0 0 1 8.8 8.6z"/><circle cx="12" cy="11.8" r="1.35" fill="currentColor" stroke="none"/></svg>`;

export const ICON_CLOSE = `${OPEN}<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>`;

export const ICON_TARGET = `${OPEN}<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4"/></svg>`;

export function icon(markup: string, className: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.innerHTML = markup;
  return span;
}
