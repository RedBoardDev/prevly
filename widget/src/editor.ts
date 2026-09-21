import { el } from './dom';
import { canvasToPng } from './screenshot';
import type { Shot } from './screenshot';
import { ACCENT } from './styles';
import type { ElementInfo, Rect } from './types';


type Shape = { kind: 'pen'; pts: Array<[number, number]> };

export interface EditorOptions {
  shot: Shot | null;
  rect: Rect | null;
  element: ElementInfo;
  author: string;
  onCancel(): void;
  onSubmit(input: { comment: string; author: string; png: Blob | null }): Promise<string | null>;
}

export interface Editor {
  close(): void;
}

export function openEditor(layer: HTMLElement, options: EditorOptions): Editor {
  const { shot } = options;
  const shapes: Shape[] = [];
  let draft: Shape | null = null;
  let sending = false;

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
      ctx.strokeRect(
        options.rect.x * s,
        options.rect.y * s,
        options.rect.w * s,
        options.rect.h * s,
      );
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

  let start: [number, number] | null = null;

  canvas.addEventListener('pointerdown', (event) => {
    if (!shot) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    start = toCanvasPoint(event);
    draft = { kind: 'pen', pts: [start] };
    paint();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!draft || !start) return;
    const [x, y] = toCanvasPoint(event);
    draft.pts.push([x, y]);
    paint();
  });

  const finish = (): void => {
    if (draft && !isEmpty(draft)) shapes.push(draft);
    draft = null;
    start = null;
    paint();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  const undoButton = el('button', {
    class: 'tool',
    text: 'Undo',
    attrs: { type: 'button', 'aria-label': 'Undo the last drawing' },
    on: {
      click: () => {
        shapes.pop();
        paint();
      },
    },
  });
  const clearButton = el('button', {
    class: 'tool',
    text: 'Clear',
    attrs: { type: 'button', 'aria-label': 'Clear all drawings' },
    on: {
      click: () => {
        shapes.length = 0;
        paint();
      },
    },
  });

  const comment = el('textarea', {
    attrs: {
      'aria-label': 'Comment',
      placeholder: 'What is wrong on this element?',
      required: 'required',
      'data-prevly': 'comment',
    },
  });
  const author = el('input', {
    attrs: {
      'aria-label': 'Your name',
      placeholder: 'Your name',
      required: 'required',
      'data-prevly': 'author',
    },
  });
  author.value = options.author;

  const error = el('div', { class: 'error', attrs: { role: 'alert' } });

  const cancelButton = el('button', {
    class: 'btn',
    text: 'Cancel',
    attrs: { type: 'button', 'aria-label': 'Cancel this feedback' },
    on: { click: () => options.onCancel() },
  });

  const sendButton = el('button', {
    class: 'btn btn-primary',
    text: 'Send',
    attrs: { type: 'button', 'aria-label': 'Send this feedback', 'data-prevly': 'send' },
    on: { click: () => void send() },
  });

  async function send(): Promise<void> {
    if (sending) return;
    const commentValue = comment.value.trim();
    const authorValue = author.value.trim();
    if (!commentValue) {
      error.textContent = 'A comment is required.';
      comment.focus();
      return;
    }
    if (!authorValue) {
      error.textContent = 'A name is required.';
      author.focus();
      return;
    }

    sending = true;
    error.textContent = '';
    sendButton.setAttribute('disabled', 'disabled');
    sendButton.textContent = 'Sending…';

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

    const failure = await options.onSubmit({ comment: commentValue, author: authorValue, png });
    sending = false;
    sendButton.removeAttribute('disabled');
    sendButton.textContent = 'Send';
    if (failure) error.textContent = failure;
  }

  const preview = shot
    ? el('div', { class: 'canvas-wrap' }, canvas)
    : el('div', {
        class: 'notice',
        text: 'The screenshot could not be captured on this page. You can still send the report without an image.',
      });

  const modal = el(
    'div',
    { class: 'modal', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'New feedback' } },
    el('h2', { text: `Feedback on <${options.element.tag}>` }),
    preview,
    shot
      ? el(
          'div',
          { class: 'tools' },
          undoButton,
          clearButton,
        )
      : null,
    el(
      'div',
      { class: 'fields' },
      el('label', { text: 'Comment' }, comment),
      el('label', { text: 'Your name' }, author),
    ),
    error,
    el('div', { class: 'actions' }, cancelButton, sendButton),
  );

  const backdrop = el(
    'div',
    {
      class: 'backdrop',
      on: {
        pointerdown: (event: Event) => {
          if (event.target === backdrop) options.onCancel();
        },
      },
    },
    modal,
  );

  layer.append(backdrop);
  paint();
  comment.focus();

  return {
    close() {
      backdrop.remove();
    },
  };
}

function isEmpty(shape: Shape): boolean {
  return shape.pts.length < 2;
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
