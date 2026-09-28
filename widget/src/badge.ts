import { el } from './dom';
import { ICON_BADGE, ICON_CLOSE, icon } from './icons';
import type { Corner, Labels } from './options';
import { createSurface } from './top-layer';
import type { Surface } from './top-layer';

export interface Badge {
  readonly surface: Surface;
  setCount(count: number): void;
  setCorner(corner: Corner): void;
  destroy(): void;
}

export interface BadgeDeps {
  labels: Labels;
  corner: Corner;
  topLayer: boolean;
  onOpen(): void;
  onClose(): void;
  onCorner(corner: Corner): void;
}

const DRAG_THRESHOLD = 4;

export function createBadge(root: ParentNode & Node, deps: BadgeDeps): Badge {
  const count = el('span', { class: 'badge-count', attrs: { hidden: '' } });
  const button = el(
    'button',
    {
      class: 'badge-button',
      attrs: { type: 'button', 'aria-label': deps.labels.badge, 'data-prevly': 'badge' },
    },
    icon(ICON_BADGE, 'badge-icon'),
    count,
  );
  const close = el(
    'button',
    {
      class: 'badge-close',
      attrs: { type: 'button', 'aria-label': deps.labels.close, 'data-prevly': 'badge-close' },
      on: {
        click: (event: Event) => {
          event.stopPropagation();
          deps.onClose();
        },
      },
    },
    icon(ICON_CLOSE, 'badge-close-icon'),
  );

  const wrap = el('div', { class: 'badge-wrap', attrs: { 'data-corner': deps.corner } }, button, close);
  root.appendChild(wrap);
  const surface = createSurface(wrap, deps.topLayer);

  let dragging = false;
  let moved = false;
  let pointer = -1;
  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const box = wrap.getBoundingClientRect();
    pointer = event.pointerId;
    dragging = true;
    moved = false;
    offsetX = event.clientX - box.left;
    offsetY = event.clientY - box.top;
    startX = event.clientX;
    startY = event.clientY;
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      /* capture is optional */
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== pointer) return;
    if (
      !moved &&
      Math.abs(event.clientX - startX) < DRAG_THRESHOLD &&
      Math.abs(event.clientY - startY) < DRAG_THRESHOLD
    ) {
      return;
    }
    moved = true;
    wrap.setAttribute('data-dragging', '');
    wrap.style.left = `${event.clientX - offsetX}px`;
    wrap.style.top = `${event.clientY - offsetY}px`;
    wrap.style.right = 'auto';
    wrap.style.bottom = 'auto';
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== pointer) return;
    dragging = false;
    pointer = -1;
    try {
      button.releasePointerCapture(event.pointerId);
    } catch {
      /* capture is optional */
    }
    if (!moved) {
      deps.onOpen();
      return;
    }
    const box = wrap.getBoundingClientRect();
    const corner = nearestCorner(box.left + box.width / 2, box.top + box.height / 2);
    clearDragStyles();
    setCorner(corner);
    deps.onCorner(corner);
  };

  function clearDragStyles(): void {
    wrap.removeAttribute('data-dragging');
    wrap.style.left = '';
    wrap.style.top = '';
    wrap.style.right = '';
    wrap.style.bottom = '';
  }

  function setCorner(corner: Corner): void {
    wrap.setAttribute('data-corner', corner);
  }

  button.addEventListener('pointerdown', onPointerDown);
  button.addEventListener('pointermove', onPointerMove);
  button.addEventListener('pointerup', onPointerUp);
  button.addEventListener('pointercancel', () => {
    dragging = false;
    pointer = -1;
    clearDragStyles();
  });
  // A plain click listener would also fire at the end of a drag and open the panel.
  button.addEventListener('click', (event) => event.preventDefault());

  return {
    surface,
    setCount(value) {
      count.textContent = String(value);
      count.toggleAttribute('hidden', value <= 0);
      button.setAttribute(
        'aria-label',
        value > 0 ? `${deps.labels.badge} · ${value} ${deps.labels.reports}` : deps.labels.badge,
      );
    },
    setCorner,
    destroy() {
      surface.destroy();
    },
  };
}

function nearestCorner(x: number, y: number): Corner {
  const left = x < window.innerWidth / 2;
  const top = y < window.innerHeight / 2;
  if (top) return left ? 'top-left' : 'top-right';
  return left ? 'bottom-left' : 'bottom-right';
}
