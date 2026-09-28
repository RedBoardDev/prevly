import { el } from './dom';
import { ICON_CLOSE, ICON_TARGET, icon } from './icons';
import type { Corner, Labels, ReportType } from './options';
import { REPORT_TYPES } from './options';
import { canvasToPng } from './screenshot';
import type { Shot } from './screenshot';
import { ACCENT } from './styles';
import { createSurface } from './top-layer';
import type { Rect } from './types';

type Shape = { kind: 'pen'; pts: Array<[number, number]> };

export interface PanelSubmission {
  type: ReportType;
  comment: string;
  author: string;
  png: Blob | null;
}

export interface PanelOptions {
  labels: Labels;
  corner: Corner;
  topLayer: boolean;
  shot: Shot | null;
  shotFailed: boolean;
  rect: Rect | null;
  heading: string | null;
  author: string;
  askAuthor: boolean;
  allowPick: boolean;
  onPick(): void;
  onCancel(): void;
  onSubmit(input: PanelSubmission): Promise<string | null>;
}

export interface Panel {
  close(): void;
  focus(): void;
}

export function openPanel(root: ParentNode & Node, options: PanelOptions): Panel {
  const { labels, shot } = options;
  const shapes: Shape[] = [];
  let draft: Shape | null = null;
  let sending = false;
  let type: ReportType = 'bug';

  const canvas = el('canvas');
  const stroke = shot ? Math.max(2, Math.round(3 * shot.scale)) : 3;
  if (shot) {
    canvas.width = shot.width;
    canvas.height = shot.height;
  }

  const render = (ctx: CanvasRenderingContext2D): void => {
    if (!shot) return;
    ctx.clearRect(0, 0, shot.width, shot.height);
    ctx.drawImage(shot.canvas, 0, 0);
    ctx.save();
    ctx.strokeStyle = ACCENT;
    ctx.fillStyle = ACCENT;
    ctx.lineWidth = stroke;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (options.rect && options.rect.w > 0 && options.rect.h > 0) {
      const s = shot.scale;
      ctx.strokeRect(options.rect.x * s, options.rect.y * s, options.rect.w * s, options.rect.h * s);
    }
    for (const shape of shapes) drawShape(ctx, shape);
    if (draft) drawShape(ctx, draft);
    ctx.restore();
  };

  const paint = (): void => {
    const ctx = canvas.getContext('2d');
    if (ctx) render(ctx);
  };

  const toCanvasPoint = (event: PointerEvent): [number, number] => {
    const box = canvas.getBoundingClientRect();
    const sx = box.width ? canvas.width / box.width : 1;
    const sy = box.height ? canvas.height / box.height : 1;
    return [(event.clientX - box.left) * sx, (event.clientY - box.top) * sy];
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (!shot) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    draft = { kind: 'pen', pts: [toCanvasPoint(event)] };
    paint();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!draft) return;
    draft.pts.push(toCanvasPoint(event));
    paint();
  });
  const finish = (): void => {
    if (draft && draft.pts.length >= 2) shapes.push(draft);
    draft = null;
    paint();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  const comment = el('textarea', {
    class: 'field-input',
    attrs: {
      'aria-label': labels.comment,
      placeholder: labels.commentPlaceholder,
      required: 'required',
      'data-prevly': 'comment',
    },
  });

  const typeButtons = REPORT_TYPES.map((value) =>
    el('button', {
      class: 'type-option',
      text: typeLabel(labels, value),
      attrs: {
        type: 'button',
        role: 'radio',
        'aria-checked': value === type ? 'true' : 'false',
        'data-prevly-type': value,
      },
      on: {
        click: () => {
          type = value;
          for (const node of typeButtons) {
            node.setAttribute(
              'aria-checked',
              node.getAttribute('data-prevly-type') === value ? 'true' : 'false',
            );
          }
        },
      },
    }),
  );
  const typeRow = el(
    'div',
    { class: 'type-row', attrs: { role: 'radiogroup', 'aria-label': labels.type } },
    ...typeButtons,
  );

  const authorInput = el('input', {
    class: 'field-input',
    attrs: {
      'aria-label': labels.name,
      placeholder: labels.namePlaceholder,
      'data-prevly': 'author',
    },
  });
  authorInput.value = options.author;

  const authorField = el('label', { class: 'field' }, authorInput);
  const authorKnown = el(
    'div',
    { class: 'author-known' },
    el('span', { text: `${labels.reportingAs} ${options.author}` }),
    el('button', {
      class: 'link',
      text: labels.changeName,
      attrs: { type: 'button', 'data-prevly': 'change-name' },
      on: {
        click: () => {
          authorKnown.setAttribute('hidden', '');
          authorField.removeAttribute('hidden');
          authorInput.focus();
        },
      },
    }),
  );

  if (!options.askAuthor) {
    authorField.setAttribute('hidden', '');
    authorKnown.setAttribute('hidden', '');
  } else if (options.author) {
    authorField.setAttribute('hidden', '');
  } else {
    authorKnown.setAttribute('hidden', '');
  }

  const error = el('div', { class: 'error', attrs: { role: 'alert' } });

  const sendButton = el('button', {
    class: 'btn btn-primary',
    text: labels.send,
    attrs: { type: 'button', 'aria-label': labels.send, 'data-prevly': 'send' },
    on: { click: () => void send() },
  });

  const cancelButton = el('button', {
    class: 'btn',
    text: labels.cancel,
    attrs: { type: 'button', 'aria-label': labels.cancel, 'data-prevly': 'cancel' },
    on: { click: () => options.onCancel() },
  });

  const pickButton = el(
    'button',
    {
      class: 'btn btn-ghost',
      attrs: { type: 'button', 'aria-label': labels.point, 'data-prevly': 'point' },
      on: { click: () => options.onPick() },
    },
    icon(ICON_TARGET, 'btn-icon'),
    document.createTextNode(labels.point),
  );

  async function send(): Promise<void> {
    if (sending) return;
    const commentValue = comment.value.trim();
    if (!commentValue) {
      error.textContent = labels.commentRequired;
      comment.focus();
      return;
    }
    const authorValue = options.askAuthor ? authorInput.value.trim() : options.author;
    if (options.askAuthor && !authorValue) {
      error.textContent = labels.nameRequired;
      authorField.removeAttribute('hidden');
      authorKnown.setAttribute('hidden', '');
      authorInput.focus();
      return;
    }

    sending = true;
    error.textContent = '';
    sendButton.setAttribute('disabled', 'disabled');
    sendButton.textContent = labels.sending;

    let png: Blob | null = null;
    if (shot) {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = shot.width;
      exportCanvas.height = shot.height;
      const ctx = exportCanvas.getContext('2d');
      if (ctx) {
        render(ctx);
        png = await canvasToPng(exportCanvas);
      }
    }

    const failure = await options.onSubmit({ type, comment: commentValue, author: authorValue, png });
    sending = false;
    sendButton.removeAttribute('disabled');
    sendButton.textContent = labels.send;
    if (failure) error.textContent = failure;
  }

  const preview = shot
    ? el(
        'div',
        { class: 'canvas-block' },
        el('div', { class: 'canvas-wrap' }, canvas),
        el(
          'div',
          { class: 'tools' },
          el('button', {
            class: 'tool',
            text: labels.undo,
            attrs: { type: 'button', 'aria-label': labels.undo },
            on: {
              click: () => {
                shapes.pop();
                paint();
              },
            },
          }),
          el('button', {
            class: 'tool',
            text: labels.clear,
            attrs: { type: 'button', 'aria-label': labels.clear },
            on: {
              click: () => {
                shapes.length = 0;
                paint();
              },
            },
          }),
        ),
      )
    : null;

  const card = el(
    'div',
    {
      class: shot ? 'panel panel-wide' : 'panel',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': labels.panel, 'data-prevly': 'panel' },
    },
    el(
      'div',
      { class: 'panel-head' },
      el('span', { class: 'panel-title', text: options.heading ?? labels.panel }),
      el(
        'button',
        {
          class: 'icon-button',
          attrs: { type: 'button', 'aria-label': labels.cancel },
          on: { click: () => options.onCancel() },
        },
        icon(ICON_CLOSE, 'icon-button-glyph'),
      ),
    ),
    preview,
    options.shotFailed ? el('div', { class: 'notice', text: labels.noScreenshot }) : null,
    typeRow,
    el('label', { class: 'field' }, comment),
    authorField,
    authorKnown,
    error,
    el(
      'div',
      { class: 'panel-actions' },
      options.allowPick ? pickButton : null,
      cancelButton,
      sendButton,
    ),
    el('div', { class: 'send-hint', text: labels.sendHint }),
  );

  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    void send();
  });

  const container = el('div', { class: shot ? 'panel-backdrop' : 'panel-anchor' }, card);
  if (!shot) container.setAttribute('data-corner', options.corner);
  if (shot) {
    container.addEventListener('pointerdown', (event) => {
      if (event.target === container) options.onCancel();
    });
  }

  root.appendChild(container);
  const surface = createSurface(container, options.topLayer);
  surface.show();
  paint();
  comment.focus();

  return {
    close() {
      surface.destroy();
    },
    focus() {
      comment.focus();
    },
  };
}

function typeLabel(labels: Labels, type: ReportType): string {
  if (type === 'design') return labels.typeDesign;
  if (type === 'question') return labels.typeQuestion;
  return labels.typeBug;
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
  const first = shape.pts[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < shape.pts.length; i += 1) {
    const point = shape.pts[i];
    if (point) ctx.lineTo(point[0], point[1]);
  }
  ctx.stroke();
}
