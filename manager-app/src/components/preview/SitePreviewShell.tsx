import { useEffect, useRef, useState, type ReactNode } from 'react';
import './previewTheme.css';

interface SitePreviewShellProps {
  viewport: 'mobile' | 'desktop';
  children: ReactNode;
}

const VIEWPORT_WIDTHS = {
  mobile: 375,
  desktop: 768,
} as const;

export default function SitePreviewShell({ viewport, children }: SitePreviewShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const innerWidth = VIEWPORT_WIDTHS[viewport];

  // Inject Google Fonts for Playfair Display + Lobster if not already loaded
  useEffect(() => {
    const fontId = 'preview-google-fonts';
    if (!document.getElementById(fontId)) {
      const link = document.createElement('link');
      link.id = fontId;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lobster&family=Inter:wght@300;400;500;600&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // Use ResizeObserver to scale the inner container to fit parent
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const parentWidth = entry.contentRect.width;
        const padding = 32; // 16px each side
        const available = parentWidth - padding;
        const newScale = available >= innerWidth ? 1 : available / innerWidth;
        setScale(Math.min(newScale, 1));
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [innerWidth]);

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div
          className="site-preview"
          style={{
            width: `${innerWidth}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            minHeight: '200px',
            padding: '16px',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
