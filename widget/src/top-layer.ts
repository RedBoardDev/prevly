export interface Surface {
  readonly node: HTMLElement;
  show(): void;
  hide(): void;
  isShown(): boolean;
  destroy(): void;
}

export function supportsTopLayer(): boolean {
  try {
    return typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.togglePopover === 'function';
  } catch {
    return false;
  }
}

export function createSurface(node: HTMLElement, topLayer: boolean): Surface {
  if (topLayer) {
    node.setAttribute('popover', 'manual');
    node.classList.add('top-layer');
  } else {
    node.setAttribute('hidden', '');
  }
  let shown = false;

  const show = (): void => {
    if (shown) return;
    shown = true;
    if (!topLayer) {
      node.removeAttribute('hidden');
      return;
    }
    try {
      node.showPopover();
    } catch {
      node.removeAttribute('hidden');
    }
  };

  const hide = (): void => {
    if (!shown) return;
    shown = false;
    if (!topLayer) {
      node.setAttribute('hidden', '');
      return;
    }
    try {
      node.hidePopover();
    } catch {
      node.setAttribute('hidden', '');
    }
  };

  return {
    node,
    show,
    hide,
    isShown: () => shown,
    destroy() {
      hide();
      node.remove();
    },
  };
}
