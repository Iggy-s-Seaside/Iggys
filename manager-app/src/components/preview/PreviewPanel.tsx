import { useEffect, useState } from 'react';
import { X, Smartphone, Monitor } from 'lucide-react';
import SitePreviewShell from './SitePreviewShell';
import PreviewEventCard from './PreviewEventCard';
import PreviewSpecialCard from './PreviewSpecialCard';
import PreviewMenuCard from './PreviewMenuCard';

interface PreviewPanelProps {
  open: boolean;
  onClose: () => void;
  type: 'event' | 'special' | 'menu';
  data: Record<string, any>;
}

export default function PreviewPanel({ open, onClose, type, data }: PreviewPanelProps) {
  const [viewport, setViewport] = useState<'mobile' | 'desktop'>('mobile');
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Manage mount/unmount for animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Trigger slide-in after mount
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const renderPreview = () => {
    switch (type) {
      case 'event':
        return <PreviewEventCard event={data} />;
      case 'special':
        return <PreviewSpecialCard special={data} />;
      case 'menu':
        return <PreviewMenuCard item={data} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 50,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '400px',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          background: '#1a1a2e',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.3)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#f0f5f5',
              margin: 0,
            }}
          >
            Live Preview
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Viewport toggles */}
            <button
              onClick={() => setViewport('mobile')}
              title="Mobile view"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                background: viewport === 'mobile' ? 'rgba(45, 212, 191, 0.15)' : 'transparent',
                color: viewport === 'mobile' ? '#2dd4bf' : '#94a3b8',
                transition: 'all 0.2s ease',
              }}
            >
              <Smartphone size={16} />
            </button>
            <button
              onClick={() => setViewport('desktop')}
              title="Desktop view"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                background: viewport === 'desktop' ? 'rgba(45, 212, 191, 0.15)' : 'transparent',
                color: viewport === 'desktop' ? '#2dd4bf' : '#94a3b8',
                transition: 'all 0.2s ease',
              }}
            >
              <Monitor size={16} />
            </button>

            {/* Divider */}
            <div
              style={{
                width: '1px',
                height: '20px',
                background: 'rgba(255, 255, 255, 0.1)',
                margin: '0 0.25rem',
              }}
            />

            {/* Close */}
            <button
              onClick={onClose}
              title="Close preview"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                color: '#94a3b8',
                transition: 'all 0.2s ease',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '0',
          }}
        >
          <SitePreviewShell viewport={viewport}>
            {renderPreview()}
          </SitePreviewShell>
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.75rem',
            color: '#64748b',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          Preview updates live as you edit
        </div>
      </div>
    </>
  );
}
