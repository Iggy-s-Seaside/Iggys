/**
 * GIF export pipeline — renders animated compositions frame-by-frame.
 *
 * Uses gifenc (~8KB) for lightweight, mobile-friendly GIF encoding.
 * Downscales output to half resolution for performance on iPhone.
 */

import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { EditorState } from '../../types';
import { exportToCanvasAsync } from './exportToCanvas';

export interface GifExportOptions {
  /** Frames per second (default: 15) */
  fps?: number;
  /** Total duration in seconds (default: longest video duration, max 10) */
  duration?: number;
  /** Output width — default: half of canvas width */
  width?: number;
  /** Output height — default: half of canvas height */
  height?: number;
  /** gifenc quantization quality 1-30 (default: 10, lower = better) */
  quality?: number;
  /** Progress callback (0-1) */
  onProgress?: (progress: number) => void;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

/**
 * Export the current editor state as an animated GIF.
 *
 * For compositions with video layers, each frame seeks all videos to
 * the correct timestamp and renders the full composition to canvas.
 * For static compositions (no video), produces a single-frame GIF.
 */
export async function exportToGif(
  state: EditorState,
  videoRefs: {
    getAll: () => Map<string, HTMLVideoElement>;
    seekAll: (time: number) => Promise<void>;
    hasVideos: () => boolean;
  },
  options: GifExportOptions = {}
): Promise<Blob> {
  const {
    fps = 15,
    quality: _quality = 10,
    onProgress,
    abortSignal,
  } = options;

  // Output dimensions — default to half resolution for performance
  const outW = options.width ?? Math.round(state.canvasWidth / 2);
  const outH = options.height ?? Math.round(state.canvasHeight / 2);

  // Determine total duration
  const hasVideo = videoRefs.hasVideos();
  let totalDuration = options.duration ?? 0;

  if (hasVideo && !totalDuration) {
    // Find longest video layer duration
    const allRefs = videoRefs.getAll();
    for (const [, video] of allRefs) {
      if (video.duration && isFinite(video.duration)) {
        totalDuration = Math.max(totalDuration, video.duration);
      }
    }
    // Cap at 10 seconds to avoid insane GIF sizes
    totalDuration = Math.min(totalDuration, 10);
  }

  // Static composition — single frame
  if (!hasVideo || totalDuration <= 0) {
    totalDuration = 0;
  }

  const totalFrames = totalDuration > 0 ? Math.ceil(totalDuration * fps) : 1;
  const frameDelay = totalDuration > 0 ? Math.round(1000 / fps) : 0;

  // Create GIF encoder
  const gif = GIFEncoder();

  // Offscreen canvas for downscaling
  const scaleCanvas = document.createElement('canvas');
  scaleCanvas.width = outW;
  scaleCanvas.height = outH;
  const scaleCtx = scaleCanvas.getContext('2d')!;

  for (let i = 0; i < totalFrames; i++) {
    // Check cancellation
    if (abortSignal?.aborted) {
      throw new DOMException('Export cancelled', 'AbortError');
    }

    // Seek all videos to the current frame time
    if (hasVideo && totalDuration > 0) {
      const time = (i / totalFrames) * totalDuration;
      await videoRefs.seekAll(time);
    }

    // Render full composition at native resolution
    const fullCanvas = await exportToCanvasAsync(state, videoRefs.getAll());

    // Downscale to output dimensions
    scaleCtx.clearRect(0, 0, outW, outH);
    scaleCtx.drawImage(fullCanvas, 0, 0, outW, outH);

    // Get pixel data
    const imageData = scaleCtx.getImageData(0, 0, outW, outH);
    const { data } = imageData;

    // Quantize to 256 colors
    const palette = quantize(data, 256, { format: 'rgba4444' });
    const indexed = applyPalette(data, palette, 'rgba4444');

    // Write frame
    gif.writeFrame(indexed, outW, outH, {
      palette,
      delay: frameDelay,
      repeat: 0, // Loop forever
    });

    // Report progress
    onProgress?.((i + 1) / totalFrames);

    // Yield to main thread every 5 frames to prevent UI freeze
    if (i % 5 === 4) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  gif.finish();

  // Convert to blob
  const bytes = gif.bytes();
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}
