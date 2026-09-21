import { el } from './dom';
import { resolvePins } from './pins';
import type { NumberedItem, PinTarget } from './pins';
import { relativeTime } from './time';
import type { FeedbackItem } from './types';

export interface PinLayer {
  update(items: FeedbackItem[], page: string): void;
  orphans(): NumberedItem[];
  count(): number;
  setVisible(visible: boolean): void;
  isVisible(): boolean;
  closePopover(): void;
  destroy(): void;
}

export function createPinLayer(layer: HTMLElement, host: Element): PinLayer {
  const container = el('div', { class: 'pin-container' });
  layer.append(container);

  let items: FeedbackItem[] = [];
  let page = '';
  let visible = true;
  let targets: PinTarget[] = [];
  let orphanList: NumberedItem[] = [];
  let nodes = new Map<string, HTMLElement>();
  let popover: HTMLElement | null = null;
  let pinned = false;
  let frame = 0;
  let debounce = 0;

  const position = (): void => {
    for (const target of targets) {
      const node = nodes.get(target.item.id);
      if (!node) continue;
      if (!target.el.isConnected) {
        node.setAttribute('hidden', '');
        continue;
      }
      const rect = target.el.getBoundingClientRect();
      const offscreen =
        rect.bottom < -40 ||
        rect.top > window.innerHeight + 40 ||
        rect.right < -40 ||
        rect.left > window.innerWidth + 40 ||
        (rect.width === 0 && rect.height === 0);
      if (offscreen) {
        node.setAttribute('hidden', '');
        continue;
      }
      node.removeAttribute('hidden');
      const x = Math.min(Math.max(rect.right - 11, 2), window.innerWidth - 24);
      const y = Math.min(Math.max(rect.top - 11, 2), window.innerHeight - 24);
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
    }
    if (popover) placePopover(popover);
  };

  const schedule = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (visible) position();
    });
  };

  const rebuild = (): void => {
    const resolution = resolvePins(items, page, document, host);
    targets = resolution.matched;
    orphanList = resolution.orphans;

    const next = new Map<string, HTMLElement>();
    for (const target of targets) {
      const existing = nodes.get(target.item.id);
      const node = existing ?? makePin(target);
      node.textContent = String(target.n);
      next.set(target.item.id, node);
      if (!existing) container.append(node);
    }
    for (const [id, node] of nodes) {
      if (!next.has(id)) node.remove();
    }
    nodes = next;
    container.toggleAttribute('hidden', !visible);
    if (visible) position();
  };

  const makePin = (target: PinTarget): HTMLElement =>
    el('button', {
      class: 'pin',
      attrs: {
        type: 'button',
        'aria-label': `Feedback ${target.n} from ${target.item.author}`,
        'data-prevly-pin': target.item.id,
      },
      on: {
        click: (event: Event) => {
          event.stopPropagation();
          togglePopover(target);
        },
        mouseenter: () => {
          if (!pinned) showPopover(target);
        },
        mouseleave: () => {
          if (!pinned) closePopover();
        },
      },
    });

  const showPopover = (target: PinTarget): void => {
    closePopover();
    const item = target.item;
    const node = el(
      'div',
      { class: 'popover', attrs: { role: 'dialog', 'aria-label': `Feedback ${target.n}` } },
      el(
        'div',
        {},
        el('span', { class: 'who', text: item.author }),
        el('span', { class: 'when', text: relativeTime(item.created_at) }),
      ),
      el('div', { class: 'body', text: item.comment }),
      item.comment_url
        ? el('a', {
            text: 'GitHub',
            attrs: { href: item.comment_url, target: '_blank', rel: 'noreferrer noopener' },
          })
        : null,
    );
    node.dataset.pin = item.id;
    container.append(node);
    popover = node;
    placePopover(node);
  };

  // Hover already opened the popover before the click lands, so a plain toggle
  // closes it on the first click. Click pins it; a second click on the pinned
  // pin closes it.
  const togglePopover = (target: PinTarget): void => {
    if (pinned && popover?.dataset.pin === target.item.id) {
      closePopover();
      return;
    }
    showPopover(target);
    pinned = true;
  };

  function closePopover(): void {
    popover?.remove();
    popover = null;
    pinned = false;
  }

  function placePopover(node: HTMLElement): void {
    const id = node.dataset.pin;
    const anchor = id ? nodes.get(id) : null;
    if (!anchor || anchor.hasAttribute('hidden')) {
      closePopover();
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const width = node.offsetWidth || 260;
    const height = node.offsetHeight || 120;
    const left = Math.min(Math.max(rect.left - width + 22, 8), window.innerWidth - width - 8);
    const top = rect.top > height + 12 ? rect.top - height - 8 : rect.bottom + 8;
    node.style.left = `${left}px`;
    node.style.top = `${Math.min(top, window.innerHeight - height - 8)}px`;
  }

  const onMutation = (): void => {
    if (debounce) clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      debounce = 0;
      if (visible) rebuild();
    }, 250);
  };

  const observer = new MutationObserver(onMutation);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden'],
  });
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);

  return {
    update(nextItems, nextPage) {
      items = nextItems;
      page = nextPage;
      rebuild();
    },
    orphans: () => orphanList,
    count: () => targets.length + orphanList.length,
    setVisible(next) {
      visible = next;
      if (!next) closePopover();
      container.toggleAttribute('hidden', !next);
      if (next) rebuild();
    },
    isVisible: () => visible,
    closePopover,
    destroy() {
      observer.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
      if (debounce) clearTimeout(debounce);
      closePopover();
      container.remove();
    },
  };
}
