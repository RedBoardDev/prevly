import { el } from './dom';
import { elementLabel, elementText } from './selector';
import type { Point, Rect } from './types';

export interface PickResult {
  el: Element;
  click: Point;
  rect: Rect;
}

export interface Picker {
  start(onPick: (result: PickResult) => void, onCancel: () => void): void;
  cancel(): void;
  isActive(): boolean;
}

const SUPPRESSED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'contextmenu'];

export function createPicker(layer: HTMLElement): Picker {
  const outline = el('div', { class: 'outline', attrs: { hidden: '' } });
  const label = el('div', { class: 'outline-label', attrs: { hidden: '' } });
  const hint = el('div', {
    class: 'picker-hint',
    text: 'Click the element to report · Esc to cancel',
    attrs: { hidden: '' },
  });
  layer.append(outline, label, hint);

  let active = false;
  let hovered: Element | null = null;
  let onPick: ((result: PickResult) => void) | null = null;
  let onCancel: (() => void) | null = null;
  let previousCursor = '';

  const target = (x: number, y: number): Element | null => {
    const found = document.elementFromPoint(x, y);
    if (!found || found === document.documentElement) return null;
    return found;
  };

  const paint = (element: Element): void => {
    const rect = element.getBoundingClientRect();
    outline.removeAttribute('hidden');
    outline.style.left = `${rect.left}px`;
    outline.style.top = `${rect.top}px`;
    outline.style.width = `${rect.width}px`;
    outline.style.height = `${rect.height}px`;

    const text = elementText(element);
    label.textContent = `${elementLabel(element)}${text ? ` — ${text.slice(0, 60)}` : ''}`;
    label.removeAttribute('hidden');
    const above = rect.top >= 24;
    label.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 330))}px`;
    label.style.top = above ? `${rect.top - 22}px` : `${Math.min(rect.bottom + 4, window.innerHeight - 24)}px`;
  };

  const onMove = (event: MouseEvent): void => {
    if (!active) return;
    const found = target(event.clientX, event.clientY);
    if (!found || found === hovered) return;
    hovered = found;
    paint(found);
  };

  const onScroll = (): void => {
    if (active && hovered) paint(hovered);
  };

  const onSuppressed = (event: Event): void => {
    if (!active) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type !== 'click') return;

    const mouse = event as MouseEvent;
    const found = target(mouse.clientX, mouse.clientY) ?? hovered;
    if (!found) return;
    const rect = found.getBoundingClientRect();
    const picked = onPick;
    teardown();
    picked?.({
      el: found,
      click: { x: mouse.clientX, y: mouse.clientY },
      rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
    });
  };

  function teardown(): void {
    if (!active) return;
    active = false;
    hovered = null;
    onPick = null;
    onCancel = null;
    outline.setAttribute('hidden', '');
    label.setAttribute('hidden', '');
    hint.setAttribute('hidden', '');
    document.documentElement.style.cursor = previousCursor;
    document.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll, true);
    for (const type of SUPPRESSED) document.removeEventListener(type, onSuppressed, true);
  }

  return {
    isActive: () => active,
    start(pick, cancel) {
      if (active) teardown();
      active = true;
      onPick = pick;
      onCancel = cancel;
      previousCursor = document.documentElement.style.cursor;
      document.documentElement.style.cursor = 'crosshair';
      hint.removeAttribute('hidden');
      document.addEventListener('mousemove', onMove, true);
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onScroll, true);
      for (const type of SUPPRESSED) document.addEventListener(type, onSuppressed, true);
    },
    cancel() {
      const cancelled = onCancel;
      teardown();
      cancelled?.();
    },
  };
}
