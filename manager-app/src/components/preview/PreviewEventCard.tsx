import { Clock, MapPin, Repeat } from 'lucide-react';
import type { IggyEvent } from '../../types';
import { format, parseISO } from 'date-fns';

interface PreviewEventCardProps {
  event: Partial<IggyEvent>;
}

export default function PreviewEventCard({ event }: PreviewEventCardProps) {
  const title = event.title || 'Event Title';
  const description = event.description || 'Event description will appear here...';
  const imageUrl = event.image_url;
  const isRecurring = event.is_recurring ?? false;
  const recurringDay = event.recurring_day;
  const time = event.time || '8:00 PM';
  const category = event.category;

  // Parse date for the badge
  let monthStr = 'JAN';
  let dayStr = '1';
  try {
    const dateObj = event.date ? parseISO(event.date) : new Date();
    monthStr = format(dateObj, 'MMM').toUpperCase();
    dayStr = format(dateObj, 'd');
  } catch {
    const now = new Date();
    monthStr = format(now, 'MMM').toUpperCase();
    dayStr = format(now, 'd');
  }

  return (
    <div className="preview-glass-card-hover" style={{ overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Optional image */}
        {imageUrl && (
          <div style={{ width: '100%', height: '200px', overflow: 'hidden' }}>
            <img
              src={imageUrl}
              alt={title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '1.5rem', flex: 1 }}>
          {/* Date badge + Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            {/* Date badge */}
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.75rem',
                background: 'rgba(45, 212, 191, 0.1)',
                border: '1px solid rgba(45, 212, 191, 0.2)',
                minWidth: '52px',
              }}
            >
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#2dd4bf',
                }}
              >
                {monthStr}
              </span>
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  lineHeight: 1.2,
                }}
              >
                {dayStr}
              </span>
            </div>

            {/* Title + badges */}
            <div style={{ flex: 1 }}>
              <h3
                className="preview-heading"
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#f0f5f5',
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h3>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {isRecurring && (
                  <span className="preview-badge preview-badge-teal">
                    <Repeat size={12} style={{ marginRight: '4px' }} />
                    {recurringDay ? `Every ${recurringDay}` : 'Recurring'}
                  </span>
                )}
                {category && (
                  <span className="preview-badge preview-badge-amber">
                    {category}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Time + Location row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '1rem',
              fontSize: '0.875rem',
              color: '#94a3b8',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={14} style={{ color: '#2dd4bf' }} />
              <span>{time}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <MapPin size={14} style={{ color: '#2dd4bf' }} />
              <span>Iggy's Seaside</span>
            </div>
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
        </div>
      </div>
    </div>
  );
}
