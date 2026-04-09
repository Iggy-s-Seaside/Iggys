import { Wine, UtensilsCrossed, Sun } from 'lucide-react';
import type { Special } from '../../types';

interface PreviewSpecialCardProps {
  special: Partial<Special>;
}

const TYPE_CONFIG = {
  drink: {
    icon: Wine,
    bg: 'rgba(45, 212, 191, 0.1)',
    color: '#2dd4bf',
    label: 'Drink',
  },
  food: {
    icon: UtensilsCrossed,
    bg: 'rgba(245, 158, 11, 0.1)',
    color: '#f59e0b',
    label: 'Food',
  },
  seasonal: {
    icon: Sun,
    bg: 'rgba(168, 85, 247, 0.1)',
    color: '#a78bfa',
    label: 'Seasonal',
  },
} as const;

export default function PreviewSpecialCard({ special }: PreviewSpecialCardProps) {
  const title = special.title || 'Special Title';
  const description = special.description || 'Special description will appear here...';
  const type = special.type || 'drink';
  const price = special.price;

  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className="preview-glass-card-hover" style={{ padding: '1.5rem' }}>
      {/* Top row: icon + title + type label + price */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        {/* Type icon */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            borderRadius: '0.75rem',
            background: config.bg,
          }}
        >
          <Icon size={20} style={{ color: config.color }} />
        </div>

        {/* Title + type label */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            className="preview-heading"
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: '#f0f5f5',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {title}
          </h3>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: config.color,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {config.label}
          </span>
        </div>

        {/* Price */}
        {price && (
          <span
            className="preview-text-primary-color"
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ${price}
          </span>
        )}
      </div>

      {/* Description */}
      <p
        className="preview-text-muted"
        style={{
          marginTop: '0.75rem',
          fontSize: '0.875rem',
          lineHeight: 1.6,
          margin: '0.75rem 0 0 0',
        }}
      >
        {description}
      </p>

      {/* Image if present */}
      {special.image_url && (
        <div
          style={{
            marginTop: '0.75rem',
            borderRadius: '0.5rem',
            overflow: 'hidden',
            height: '160px',
          }}
        >
          <img
            src={special.image_url}
            alt={title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      )}
    </div>
  );
}
