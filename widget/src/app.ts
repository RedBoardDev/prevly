import { AUTHOR_KEY, activationCookie } from './activation';
import { createApi } from './api';
import type { FeedbackApi } from './api';
import type { ConsoleRecorder } from './console-recorder';
import { clear, el } from './dom';
import { openEditor } from './editor';
import type { Editor } from './editor';
import { buildMeta, metaError } from './meta';
import { createPicker } from './picker';
import type { PickResult } from './picker';
import { createPinLayer } from './pin-layer';
import type { PinLayer } from './pin-layer';
import { currentPage } from './pins';
import { captureViewport } from './screenshot';
import { computeSelector, elementText } from './selector';
import { CSS } from './styles';
import type { FeedbackItem } from './types';

export interface App {
  mount(): void;
  unmount(): void;
  open(): void;
  isMounted(): boolean;
}

export interface AppDeps {
  recorder: ConsoleRecorder;
  api?: FeedbackApi;
  storage?: Storage | null;
}

export function createApp(deps: AppDeps): App {
  const api = deps.api ?? createApi();
  const storage = deps.storage === undefined ? safeStorage() : deps.storage;

  let host: HTMLElement | null = null;
  let layer: HTMLElement | null = null;
  let pinLayer: PinLayer | null = null;
  let picker: ReturnType<typeof createPicker> | null = null;
  let editor: Editor | null = null;
  let menu: HTMLElement | null = null;
  let badge: HTMLElement | null = null;
  let toastTimer = 0;
  let items: FeedbackItem[] = [];

  function mount(): void {
    if (host) return;

    host = document.createElement('prevly-feedback');
    for (const [name, value] of [
      ['position', 'fixed'],
      ['inset', '0'],
      ['z-index', '2147483647'],
      ['pointer-events', 'none'],
      ['display', 'block'],
    ] as Array<[string, string]>) {
      host.style.setProperty(name, value, 'important');
    }

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    layer = el('div', { class: 'root' });
    shadow.append(style, layer);

    for (const type of ['keydown', 'keyup', 'keypress'] as const) {
      host.addEventListener(type, (event) => event.stopPropagation());
    }

    badge = el('span', { class: 'badge', attrs: { hidden: '' } });
    const launcher = el(
      'button',
      {
        class: 'launcher',
        attrs: { type: 'button', 'aria-label': 'Preview feedback', 'data-prevly': 'launcher' },
        on: {
          click: (event: Event) => {
            event.stopPropagation();
            toggleMenu();
          },
        },
      },
      document.createTextNode('💬'),
      badge,
    );
    layer.append(launcher);

    picker = createPicker(layer);
    pinLayer = createPinLayer(layer, host);

    document.body.append(host);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onDocumentPointerDown, true);

    void refresh();
  }

  function unmount(): void {
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    picker?.cancel();
    editor?.close();
    editor = null;
    pinLayer?.destroy();
    pinLayer = null;
    picker = null;
    menu = null;
    badge = null;
    layer = null;
    if (toastTimer) clearTimeout(toastTimer);
    host?.remove();
    host = null;
  }

  async function refresh(): Promise<void> {
    items = await api.list();
    if (!pinLayer || !layer) return;
    pinLayer.update(items, currentPage(location));
    const count = pinLayer.count();
    if (badge) {
      badge.textContent = String(count);
      badge.toggleAttribute('hidden', count === 0);
    }
    if (menu) renderMenu();
  }

  function toggleMenu(): void {
    if (menu) closeMenu();
    else openMenu();
  }

  function openMenu(): void {
    if (!layer || menu) return;
    menu = el('div', { class: 'menu', attrs: { role: 'menu', 'aria-label': 'Preview feedback' } });
    layer.append(menu);
    renderMenu();
  }

  function closeMenu(): void {
    menu?.remove();
    menu = null;
  }

  function renderMenu(): void {
    if (!menu || !pinLayer) return;
    clear(menu);
    const visible = pinLayer.isVisible();
    const total = pinLayer.count();

    menu.append(
      item('New feedback', 'Start a new feedback', () => {
        closeMenu();
        startPicking();
      }),
      item(
        `Pins on this page (${total})`,
        'Toggle the pins on this page',
        () => {
          pinLayer?.setVisible(!pinLayer.isVisible());
          renderMenu();
        },
        visible ? 'shown' : 'hidden',
      ),
      item('Hide widget', 'Hide the feedback widget on this browser', () => {
        try {
          document.cookie = activationCookie(false);
        } catch {
          /* cookies blocked: hiding still takes effect for this page load */
        }
        unmount();
      }),
    );

    const orphans = pinLayer.orphans();
    if (orphans.length) {
      menu.append(
        el('div', { class: 'menu-sep' }),
        el('div', { class: 'menu-title', text: 'Element no longer on the page' }),
      );
      for (const orphan of orphans) {
        menu.append(
          el(
            'div',
            { class: 'menu-orphan' },
            el('b', { text: `${orphan.n}. ${orphan.item.author}` }),
            document.createTextNode(` · ${excerpt(orphan.item.comment)}`),
          ),
        );
      }
    }
  }

  function item(
    label: string,
    ariaLabel: string,
    onClick: () => void,
    hint?: string,
  ): HTMLButtonElement {
    return el(
      'button',
      {
        class: 'menu-item',
        attrs: { type: 'button', role: 'menuitem', 'aria-label': ariaLabel },
        on: { click: () => onClick() },
      },
      document.createTextNode(label),
      hint ? el('span', { class: 'hint', text: hint }) : null,
    );
  }

  function startPicking(): void {
    if (!picker) return;
    pinLayer?.closePopover();
    picker.start(
      (result) => void onPicked(result),
      () => undefined,
    );
  }

  async function onPicked(result: PickResult): Promise<void> {
    const shot = await withHostHidden(() => captureViewport(host));
    const selector = computeSelector(result.el);
    const element = { tag: result.el.tagName.toLowerCase(), text: elementText(result.el) };

    editor = openEditor(layer as HTMLElement, {
      shot,
      rect: result.rect,
      element,
      author: readAuthor(),
      onCancel: () => {
        editor?.close();
        editor = null;
      },
      onSubmit: async ({ comment, author, png }) => {
        const meta = buildMeta({
          author,
          comment,
          page: currentPage(location),
          title: document.title,
          selector,
          element,
          click: result.click,
          rect: result.rect,
          viewport: {
            w: window.innerWidth,
            h: window.innerHeight,
            dpr: window.devicePixelRatio || 1,
          },
          userAgent: navigator.userAgent,
          console: deps.recorder.entries(),
        });

        const invalid = metaError(meta);
        if (invalid) return invalid;

        const outcome = await api.submit(meta, png);
        if (!outcome.ok) {
          if (outcome.kind === 'rate-limit') {
            const retry = outcome.retryAfter;
            return retry ? `${outcome.message} (retry in ${retry}s)` : outcome.message;
          }
          return outcome.message;
        }

        writeAuthor(author);
        editor?.close();
        editor = null;
        toast(outcome.item);
        void refresh();
        return null;
      },
    });
  }

  async function withHostHidden<T>(action: () => Promise<T>): Promise<T> {
    host?.setAttribute('data-prevly-hidden', '');
    if (host) host.style.setProperty('display', 'none', 'important');
    await nextFrame();
    try {
      return await action();
    } finally {
      host?.removeAttribute('data-prevly-hidden');
      if (host) host.style.setProperty('display', 'block', 'important');
    }
  }

  function toast(feedback: FeedbackItem): void {
    if (!layer) return;
    if (toastTimer) clearTimeout(toastTimer);
    layer.querySelector('.toast')?.remove();
    const node = el(
      'div',
      { class: 'toast', attrs: { role: 'status', 'data-prevly': 'toast' } },
      document.createTextNode(feedback.comment_url ? 'Sent ·' : 'Sent, comment pending'),
      feedback.comment_url
        ? el('a', {
            text: 'open on GitHub',
            attrs: { href: feedback.comment_url, target: '_blank', rel: 'noreferrer noopener' },
          })
        : null,
    );
    layer.append(node);
    toastTimer = window.setTimeout(() => {
      node.remove();
      toastTimer = 0;
    }, 9000);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (editor) {
      editor.close();
      editor = null;
    } else if (picker?.isActive()) {
      picker.cancel();
    } else if (menu) {
      closeMenu();
    } else {
      pinLayer?.closePopover();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function onDocumentPointerDown(event: Event): void {
    if (!menu || !host) return;
    const path = event.composedPath();
    if (path.includes(menu) || path.includes(host)) return;
    closeMenu();
  }

  function readAuthor(): string {
    try {
      return storage?.getItem(AUTHOR_KEY) ?? '';
    } catch {
      return '';
    }
  }

  function writeAuthor(value: string): void {
    try {
      storage?.setItem(AUTHOR_KEY, value);
    } catch {
      /* storage unavailable */
    }
  }

  return {
    mount,
    unmount,
    open() {
      mount();
      openMenu();
    },
    isMounted: () => host !== null,
  };
}

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 70 ? `${flat.slice(0, 70)}…` : flat;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

