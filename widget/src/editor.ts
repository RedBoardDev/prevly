import { el } from './dom';
import { canvasToPng } from './screenshot';
import type { Shot } from './screenshot';
import { ACCENT } from './styles';
import type { ElementInfo, Rect } from './types';

type Tool = 'rect' | 'arrow' | 'pen';

type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'arrow'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'pen'; pts: Array<[number, number]> };

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
  let tool: Tool = 'rect';
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
    for (const shape of shapes) drawShape(ctx, shape, stroke);
    if (draft) drawShape(ctx, draft, stroke);
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
    draft =
      tool === 'pen'
        ? { kind: 'pen', pts: [start] }
        : tool === 'rect'
          ? { kind: 'rect', x: start[0], y: start[1], w: 0, h: 0 }
          : { kind: 'arrow', x1: start[0], y1: start[1], x2: start[0], y2: start[1] };
    paint();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!draft || !start) return;
    const [x, y] = toCanvasPoint(event);
    if (draft.kind === 'pen') draft.pts.push([x, y]);
    else if (draft.kind === 'rect') {
      draft.x = Math.min(start[0], x);
      draft.y = Math.min(start[1], y);
      draft.w = Math.abs(x - start[0]);
      draft.h = Math.abs(y - start[1]);
    } else {
      draft.x2 = x;
      draft.y2 = y;
    }
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

  const toolButton = (value: Tool, labelText: string): HTMLButtonElement =>
    el('button', {
      class: 'tool',
      text: labelText,
      attrs: { type: 'button', 'aria-label': `Tool: ${labelText}`, 'aria-pressed': String(tool === value) },
      on: {
        click: () => {
          tool = value;
          for (const [button, kind] of toolButtons) {
            button.setAttribute('aria-pressed', String(kind === tool));
          }
        },
      },
    });

  const toolButtons: Array<[HTMLButtonElement, Tool]> = [];
  for (const [value, labelText] of [
    ['rect', 'Rectangle'],
    ['arrow', 'Arrow'],
    ['pen', 'Pen'],
  ] as Array<[Tool, string]>) {
    toolButtons.push([toolButton(value, labelText), value]);
  }

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
          ...toolButtons.map(([button]) => button),
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
  if (shape.kind === 'rect') return shape.w < 2 && shape.h < 2;
  if (shape.kind === 'arrow') return Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1) < 4;
  return shape.pts.length < 2;
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, stroke: number): void {
  if (shape.kind === 'rect') {
    ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
    return;
  }
  if (shape.kind === 'pen') {
    ctx.beginPath();
    const first = shape.pts[0];
    if (!first) return;
    ctx.moveTo(first[0], first[1]);
    for (let i = 1; i < shape.pts.length; i += 1) {
      const point = shape.pts[i];
      if (point) ctx.lineTo(point[0], point[1]);
    }
    ctx.stroke();
    return;
  }

  const { x1, y1, x2, y2 } = shape;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(10, stroke * 4);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 7), y2 - head * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 7), y2 - head * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}
