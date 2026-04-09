import { memo, useState } from 'react';
import type { ImageFilters } from '../../types';
import { buildFilterString } from './canvasUtils';

interface BackgroundLayerProps {
  backgroundColor: string;
  backgroundGradient?: string;
  backgroundOverlay?: string;
  backgroundImage: string | null;
  imageFilters: ImageFilters;
}

export const BackgroundLayer = memo<BackgroundLayerProps>(({
  backgroundColor,
  backgroundGradient,
  backgroundOverlay,
  backgroundImage,
  imageFilters,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const filterStr = buildFilterString(imageFilters);
  const hasOverlay = imageFilters.overlayOpacity > 0;

  return (
    <div
      data-canvas-bg=""
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor }}
    >
      {/* Gradient overlay */}
      {backgroundGradient && (
        <div
          className="absolute inset-0"
          style={{ background: backgroundGradient }}
        />
      )}

      {/* Background image with CSS filters */}
      {backgroundImage && !imgError && (
        <img
          src={backgroundImage}
          alt=""
          crossOrigin="anonymous"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: 'cover',
            filter: filterStr !== 'none' ? filterStr : undefined,
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 200ms ease',
          }}
          draggable={false}
        />
      )}

      {/* Loading spinner for image */}
      {backgroundImage && !imgLoaded && !imgError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Background darkening overlay */}
      {backgroundOverlay && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: backgroundOverlay }}
        />
      )}

      {/* Color overlay */}
      {hasOverlay && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: imageFilters.overlayColor,
            opacity: imageFilters.overlayOpacity,
          }}
        />
      )}
    </div>
  );
});

BackgroundLayer.displayName = 'BackgroundLayer';
