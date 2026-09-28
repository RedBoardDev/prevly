import { createApi } from './api';
import type { FeedbackApi } from './api';
import { createBadge } from './badge';
import type { Badge } from './badge';
import type { ConsoleRecorder } from './console-recorder';
import { el } from './dom';
import { buildMeta, metaError } from './meta';
import type { NetworkRecorder } from './network-recorder';
import type { Corner, ResolvedOptions } from './options';
import { openPanel } from './panel';
import type { Panel, PanelSubmission } from './panel';
import { createPicker } from './picker';
import type { PickResult } from './picker';
import { createPinLayer } from './pin-layer';
import type { PinLayer } from './pin-layer';
import { currentPage } from './pins';
import { captureViewport } from './screenshot';
import type { Shot } from './screenshot';
import { computeSelector, elementText } from './selector';
import type { WidgetStorage } from './storage';
import { CSS } from './styles';
import { createSurface, supportsTopLayer } from './top-layer';
import type { Surface } from './top-layer';
import { describeTarget } from './target';
import type { TargetDescription } from './target';
import type { FeedbackItem, Point, Rect } from './types';

export interface App {
  mount(): void;
  unmount(): void;
  open(): void;
  isMounted(): boolean;
}

export interface AppDeps {
  options: ResolvedOptions;
  recorder: ConsoleRecorder;
  network: NetworkRecorder;
  storage: WidgetStorage;
  api?: FeedbackApi;
}

interface PickedContext {
  selector: string | null;
  element: TargetDescription;
  click: Point;
  rect: Rect;
}

export function createApp(deps: AppDeps): App {
  const { options, storage } = deps;
  const labels = options.labels;
  const api = deps.api ?? createApi({ path: options.endpoint });
  const topLayer = supportsTopLayer();

  let host: HTMLElement | null = null;
  let root: HTMLElement | null = null;
  let badge: Badge | null = null;
  let pinSurface: Surface | null = null;
  let pickSurface: Surface | null = null;
  let toastSurface: Surface | null = null;
  let pinLayer: PinLayer | null = null;
  let picker: ReturnType<typeof createPicker> | null = null;
  let panel: Panel | null = null;
  let media: MediaQueryList | null = null;
  let toastTimer = 0;
  let corner: Corner = storage.readCorner() ?? options.position;
  // Closing lives only for the current page: a reload always brings the
  // badge back, so nothing is persisted here.
  let closed = false;
  let locked = false;

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
    root = el('div', { class: 'root' });
    shadow.append(style, root);
    applyTheme();

    for (const type of ['keydown', 'keyup', 'keypress'] as const) {
      host.addEventListener(type, (event) => event.stopPropagation());
    }

    document.body.append(host);

    badge = createBadge(root, {
      labels,
      corner,
      topLayer,
      onOpen: () => openPageReport(),
      onClose: () => closeBadge(),
      onCorner: (next) => {
        corner = next;
        storage.writeCorner(corner);
      },
    });
    if (!closed) badge.surface.show();

    pinSurface = createSurface(el('div', { class: 'overlay' }), topLayer);
    root.append(pinSurface.node);
    pinSurface.show();
    pinLayer = createPinLayer(pinSurface.node, host, labels);

    pickSurface = createSurface(el('div', { class: 'overlay' }), topLayer);
    root.append(pickSurface.node);
    picker = createPicker(pickSurface.node, labels);

    toastSurface = createSurface(el('div', { class: 'overlay' }), topLayer);
    root.append(toastSurface.node);

    document.addEventListener('keydown', onKeyDown, true);
    void refresh();
  }

  function unmount(): void {
    document.removeEventListener('keydown', onKeyDown, true);
    media?.removeEventListener('change', applyTheme);
    media = null;
    picker?.cancel();
    panel?.close();
    panel = null;
    pinLayer?.destroy();
    pinLayer = null;
    picker = null;
    badge?.destroy();
    badge = null;
    pinSurface = null;
    pickSurface = null;
    toastSurface = null;
    if (toastTimer) clearTimeout(toastTimer);
    root = null;
    host?.remove();
    host = null;
  }

  function applyTheme(): void {
    if (!root) return;
    let theme = options.theme;
    if (theme === 'auto') {
      if (!media && typeof window.matchMedia === 'function') {
        media = window.matchMedia('(prefers-color-scheme: dark)');
        media.addEventListener('change', applyTheme);
      }
      theme = media?.matches ? 'dark' : 'light';
    }
    root.setAttribute('data-theme', theme);
  }

  async function refresh(): Promise<void> {
    const result = await api.list();
    locked = result.locked;
    if (!pinLayer) return;
    pinLayer.update(result.items, currentPage(location));
    badge?.setCount(pinLayer.count());
  }

  function closeBadge(): void {
    closed = true;
    badge?.surface.hide();
  }

  function revealBadge(): void {
    if (!closed) return;
    closed = false;
    badge?.surface.show();
  }

  function openPageReport(): void {
    if (panel) return;
    openReportPanel(null, null, null);
  }

  function startPicking(): void {
    if (!picker || !pickSurface) return;
    closePanel();
    pinLayer?.closePopover();
    pickSurface.show();
    picker.start(
      (result) => void onPicked(result),
      () => pickSurface?.hide(),
    );
  }

  async function onPicked(result: PickResult): Promise<void> {
    pickSurface?.hide();
    const shot = await withHostHidden(() => captureViewport(host));
    openReportPanel(
      {
        selector: computeSelector(result.el),
        element: describeTarget(result.el, elementText(result.el)),
        click: result.click,
        rect: result.rect,
      },
      shot,
      result.rect,
    );
  }

  function openReportPanel(picked: PickedContext | null, shot: Shot | null, rect: Rect | null): void {
    if (!root) return;
    closePanel();

    panel = openPanel(root, {
      labels,
      corner,
      topLayer,
      shot,
      shotFailed: picked !== null && shot === null,
      rect,
      heading: picked ? `<${picked.element.tag}>` : null,
      author: options.reporter?.name ?? storage.readAuthor(),
      askAuthor: options.reporter === null,
      allowPick: picked === null,
      types: options.types,
      locked,
      onPick: () => startPicking(),
      onCancel: () => closePanel(),
      onSubmit: (input) => submit(input, picked),
    });
  }

  function closePanel(): void {
    panel?.close();
    panel = null;
  }

  async function submit(input: PanelSubmission, picked: PickedContext | null): Promise<string | null> {
    const meta = buildMeta({
      type: input.type,
      author: input.author,
      comment: input.comment,
      page: currentPage(location),
      title: document.title,
      selector: picked?.selector ?? null,
      element: picked?.element ?? null,
      click: picked?.click ?? null,
      rect: picked?.rect ?? null,
      viewport: {
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
      },
      userAgent: navigator.userAgent,
      console: deps.recorder.entries(),
      context: options.context,
      network: deps.network.entries(),
    });

    const invalid = metaError(meta, labels);
    if (invalid) return invalid;

    const outcome = await api.submit(meta, input.png);
    if (!outcome.ok) {
      if (outcome.kind === 'locked') {
        locked = true;
        closePanel();
        openReportPanel(null, null, null);
        return null;
      }
      if (outcome.kind === 'rate-limit') {
        return outcome.retryAfter
          ? `${labels.rateLimited} (${labels.retryIn} ${outcome.retryAfter}s)`
          : labels.rateLimited;
      }
      return outcome.message || labels.sendFailed;
    }

    if (options.reporter === null) storage.writeAuthor(input.author);
    closePanel();
    toast(outcome.item);
    void refresh();
    return null;
  }

  async function withHostHidden<T>(action: () => Promise<T>): Promise<T> {
    if (host) host.style.setProperty('display', 'none', 'important');
    await nextFrame();
    try {
      return await action();
    } finally {
      if (host) host.style.setProperty('display', 'block', 'important');
    }
  }

  function toast(feedback: FeedbackItem): void {
    if (!toastSurface) return;
    if (toastTimer) clearTimeout(toastTimer);
    toastSurface.node.replaceChildren(
      el(
        'div',
        { class: 'toast', attrs: { role: 'status', 'data-prevly': 'toast', 'data-corner': corner } },
        document.createTextNode(feedback.comment_url ? labels.sent : labels.sentPending),
        feedback.comment_url
          ? el('a', {
              text: labels.openReport,
              attrs: { href: feedback.comment_url, target: '_blank', rel: 'noreferrer noopener' },
            })
          : null,
      ),
    );
    toastSurface.show();
    toastTimer = window.setTimeout(() => {
      toastSurface?.hide();
      toastTimer = 0;
    }, 9000);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (panel) {
      closePanel();
    } else if (picker?.isActive()) {
      picker.cancel();
    } else {
      pinLayer?.closePopover();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  return {
    mount,
    unmount,
    open() {
      mount();
      revealBadge();
      openPageReport();
    },
    isMounted: () => host !== null,
  };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
