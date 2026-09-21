import { domToCanvas } from 'modern-screenshot';

export interface Shot {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  scale: number;
}

export const MAX_SCALE = 2;

export function captureScale(dpr: number): number {
  const value = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return Math.min(value, MAX_SCALE);
}

export async function captureViewport(ignore: Node | null): Promise<Shot | null> {
  try {
    const scale = captureScale(window.devicePixelRatio);
    const full = await domToCanvas(document.documentElement, {
      scale,
      backgroundColor: pageBackground(),
      timeout: 15_000,
      filter: (node) => !(ignore && (node === ignore || ignore.contains(node))),
    });

    const width = Math.max(1, Math.round(window.innerWidth * scale));
    const height = Math.max(1, Math.round(window.innerHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const sx = Math.round(window.scrollX * scale);
    const sy = Math.round(window.scrollY * scale);
    ctx.drawImage(full, sx, sy, width, height, 0, 0, width, height);

    return { canvas, width, height, scale };
  } catch (error) {
    console.debug('[prevly] screenshot failed', error);
    return null;
  }
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

function pageBackground(): string {
  try {
    const body = getComputedStyle(document.body).backgroundColor;
    if (body && body !== 'rgba(0, 0, 0, 0)' && body !== 'transparent') return body;
    const html = getComputedStyle(document.documentElement).backgroundColor;
    if (html && html !== 'rgba(0, 0, 0, 0)' && html !== 'transparent') return html;
  } catch {
    /* fall through */
  }
  return '#ffffff';
}
