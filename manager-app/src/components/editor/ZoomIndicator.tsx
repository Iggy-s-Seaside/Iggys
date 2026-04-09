import { memo, useState, useEffect, useRef } from 'react';

interface ZoomIndicatorProps {
  zoom: number;
}

export const ZoomIndicator = memo<ZoomIndicatorProps>(({ zoom }) => {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevZoomRef = useRef(zoom);

  useEffect(() => {
    // Only show when zoom actually changes (not on mount)
    if (Math.abs(zoom - prevZoomRef.current) > 0.001) {
      setVisible(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setVisible(false), 1500);
    }
    prevZoomRef.current = zoom;
    return () => clearTimeout(timeoutRef.current);
  }, [zoom]);

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none
        bg-black/60 backdrop-blur-md rounded-full px-3 py-1 text-xs text-white font-mono
        transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {Math.round(zoom * 100)}%
    </div>
  );
});

ZoomIndicator.displayName = 'ZoomIndicator';
