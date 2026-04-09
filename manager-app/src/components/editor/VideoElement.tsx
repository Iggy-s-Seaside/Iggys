import { memo, useCallback, useRef, useEffect, useState } from 'react';
import type { TextLayer } from '../../types';
import { useVideoRefs } from '../../context/VideoRefContext';
import { resolveMediaSrc, revokeMediaUrl, isIdbRef } from '../../lib/mediaStore';
import { buildFilterCSS } from './canvasUtils';
import { MIN_TOUCH_TARGET } from './editorConstants';

interface VideoElementProps {
  layer: TextLayer;
  isSelected: boolean;
  onPointerDown?: (e: React.PointerEvent, layerId: string) => void;
  zoom?: number;
}

export const VideoElement = memo<VideoElementProps>(({
  layer,
  isSelected,
  onPointerDown,
  zoom = 1,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { register, unregister } = useVideoRefs();
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const prevBlobUrl = useRef<string>('');

  // Resolve idb:// refs to blob URLs
  useEffect(() => {
    const src = layer.videoSrc;
    if (!src) return;

    if (isIdbRef(src)) {
      resolveMediaSrc(src).then((url) => {
        if (url) {
          prevBlobUrl.current = url;
          setResolvedSrc(url);
        }
      });
    } else {
      setResolvedSrc(src);
    }

    return () => {
      // Revoke previous blob URL on src change or unmount
      if (prevBlobUrl.current) {
        revokeMediaUrl(prevBlobUrl.current);
        prevBlobUrl.current = '';
      }
    };
  }, [layer.videoSrc]);

  // Register video ref for export pipeline + set webkit-playsinline for older iOS
  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.setAttribute('webkit-playsinline', '');
      register(layer.id, el);
    }
    return () => {
      unregister(layer.id);
    };
  }, [layer.id, register, unregister, resolvedSrc]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    onPointerDown?.(e, layer.id);
  }, [layer.id, onPointerDown]);

  if (!layer.visible || !resolvedSrc) return null;

  const filterCSS = buildFilterCSS(layer.imageFilters);
  const height = layer.imageHeight || layer.width;

  return (
    <div
      data-layer-id={layer.id}
      className="absolute select-none"
      onPointerDown={handlePointerDown}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: layer.width,
        height,
        transform: `translate(${layer.x}px, ${layer.y}px)${layer.rotation !== 0 ? ` rotate(${layer.rotation}deg)` : ''}`,
        transformOrigin: 'center center',
        opacity: layer.opacity,
        cursor: layer.locked ? 'not-allowed' : 'move',
        pointerEvents: 'auto',
        willChange: isSelected ? 'transform' : 'auto',
        borderRadius: 4,
        overflow: 'hidden',
        clipPath: layer.imageCrop ? `inset(${layer.imageCrop.top}% ${layer.imageCrop.right}% ${layer.imageCrop.bottom}% ${layer.imageCrop.left}%)` : undefined,
        mixBlendMode: (layer.blendMode || 'normal') as React.CSSProperties['mixBlendMode'],
      }}
    >
      {/* Invisible touch target expander */}
      {zoom < 1 && (() => {
        const expandY = Math.max(0, (MIN_TOUCH_TARGET / zoom - height) / 2);
        return expandY > 0 ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: -expandY,
              bottom: -expandY,
            }}
          />
        ) : null;
      })()}

      {/* Video — all attributes critical for iOS inline autoplay */}
      <video
        ref={videoRef}
        src={resolvedSrc}
        autoPlay
        muted={layer.videoMuted !== false}
        loop={layer.videoLoop !== false}
        playsInline
        /* webkit-playsinline applied via ref for older iOS */
        poster={layer.videoPosterSrc}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: layer.imageFit || 'cover',
          filter: filterCSS,
          display: 'block',
          pointerEvents: 'none', // Don't let video steal taps
        }}
      />

      {/* Overlay color if specified */}
      {layer.imageFilters && layer.imageFilters.overlayOpacity > 0 && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: layer.imageFilters.overlayColor,
            opacity: layer.imageFilters.overlayOpacity,
            mixBlendMode: 'multiply',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
});

VideoElement.displayName = 'VideoElement';
