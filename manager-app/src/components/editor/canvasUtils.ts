/**
 * Shared canvas rendering utilities.
 * Used by BackgroundLayer, ImageElement, VideoElement, and exportToCanvas.
 */

import type { ImageFilters } from '../../types';

/**
 * Build CSS filter string from ImageFilters.
 * Returns 'none' if no filters are active.
 */
export function buildFilterString(filters: ImageFilters): string {
  const parts: string[] = [];
  if (filters.brightness !== 100) parts.push(`brightness(${filters.brightness}%)`);
  if (filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`);
  if (filters.saturation !== 100) parts.push(`saturate(${filters.saturation}%)`);
  if (filters.blur > 0) parts.push(`blur(${filters.blur}px)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

/**
 * Build optional CSS filter string from partial ImageFilters.
 * Returns undefined if no filters are active (for inline style usage).
 */
export function buildFilterCSS(filters?: Partial<ImageFilters>): string | undefined {
  if (!filters) return undefined;
  const parts: string[] = [];
  if (filters.brightness !== undefined && filters.brightness !== 100) parts.push(`brightness(${filters.brightness}%)`);
  if (filters.contrast !== undefined && filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`);
  if (filters.saturation !== undefined && filters.saturation !== 100) parts.push(`saturate(${filters.saturation}%)`);
  if (filters.blur !== undefined && filters.blur > 0) parts.push(`blur(${filters.blur}px)`);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Draw an image onto a canvas using "cover" behaviour:
 * scale to fill while maintaining aspect ratio, then center-crop.
 */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number,
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = canvasW / canvasH;

  let srcX = 0, srcY = 0, srcW = img.naturalWidth, srcH = img.naturalHeight;

  if (imgRatio > canvasRatio) {
    srcW = img.naturalHeight * canvasRatio;
    srcX = (img.naturalWidth - srcW) / 2;
  } else {
    srcH = img.naturalWidth / canvasRatio;
    srcY = (img.naturalHeight - srcH) / 2;
  }

  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvasW, canvasH);
}

/**
 * Parse CSS linear-gradient and render on canvas.
 */
export function renderGradient(ctx: CanvasRenderingContext2D, gradientStr: string, w: number, h: number) {
  const match = gradientStr.match(/linear-gradient\(\s*([\d.]+)deg\s*,\s*(.+)\)/);
  if (!match) return;
  const angle = parseFloat(match[1]);
  const stops = match[2].split(',').map(s => s.trim());

  const rad = (angle - 90) * Math.PI / 180;
  const cx = w / 2, cy = h / 2;
  const len = Math.sqrt(w * w + h * h) / 2;
  const x0 = cx - Math.cos(rad) * len;
  const y0 = cy - Math.sin(rad) * len;
  const x1 = cx + Math.cos(rad) * len;
  const y1 = cy + Math.sin(rad) * len;

  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const stop of stops) {
    const parts = stop.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+([\d.]+)%/);
    if (parts) {
      grad.addColorStop(parseFloat(parts[2]) / 100, parts[1]);
    }
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}
