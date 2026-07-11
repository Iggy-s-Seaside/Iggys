/**
 * GIF export pipeline — renders animated compositions frame-by-frame.
 *
 * Uses gifenc (~8KB) for lightweight, mobile-friendly GIF encoding.
 * Downscales output to half resolution for performance on iPhone.
 */

import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { EditorState } from '../../types';
import { exportToCanvasAsync } from './exportToCanvas';

/**
 * Map gifenc's documented quality knob (1-30, lower = better) onto the
 * `maxColors` palette-size argument quantize() actually accepts.
 */
export function qualityToMaxColors(quality: number): number {
  return Math.min(256, Math.max(64, Math.round(256 * (10 / Math.max(quality, 1)))));
}

/**
 * Resolve the timestamp to seek a video layer to for a given shared-timeline
 * `time`. Looping videos shorter than the timeline wrap via modulo instead
 * of freezing on their last frame once `time` outruns their duration;
 * non-looping videos pass `time` through unchanged (browsers clamp to end).
 */
export function computeVideoSeekTime(time: number, videoDuration: number, loops: boolean): number {
  if (loops && isFinite(videoDuration) && videoDuration > 0 && time > videoDuration) {
    return time % videoDuration;
  }
  return time;
}

/**
 * Seek a single video element to `time` and resolve once it has settled.
 *
 * Mirrors VideoRefContext's seekAll, but per-video — needed here because each
 * video may need a different target time (looping videos wrap the shared
 * timeline via modulo; see the call site in the export loop).
 */
function seekVideoTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (video.readyState < 1) return Promise.resolve(); // Skip unloaded videos

  if (Math.abs(video.currentTime - time) < 0.01) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;

    // Timeout safety — don't hang forever if seeked never fires
    setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }, 2000);
  });
}

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
    quality = 10,
    onProgress,
    abortSignal,
  } = options;

  const maxColors = qualityToMaxColors(quality);

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

      const allRefs = videoRefs.getAll();
      const layerById = new Map(state.layers.map((layer) => [layer.id, layer]));
      await Promise.all(
        Array.from(allRefs, ([layerId, video]) => {
          const layer = layerById.get(layerId);
          const loops = layer?.videoLoop !== false; // Default true
          return seekVideoTo(video, computeVideoSeekTime(time, video.duration, loops));
        })
      );
    }

    // Render full composition at native resolution
    const fullCanvas = await exportToCanvasAsync(state, videoRefs.getAll());

    // Downscale to output dimensions
    scaleCtx.clearRect(0, 0, outW, outH);
    scaleCtx.drawImage(fullCanvas, 0, 0, outW, outH);

    // Get pixel data
    const imageData = scaleCtx.getImageData(0, 0, outW, outH);
    const { data } = imageData;

    // Quantize to the quality-derived palette size
    const palette = quantize(data, maxColors, { format: 'rgba4444' });
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
