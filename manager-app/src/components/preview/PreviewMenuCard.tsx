interface PreviewMenuCardProps {
  item: {
    name?: string;
    description?: string;
    ingredients?: string;
    price?: string;
    type?: string;
    brewery?: string;
    abv?: string;
  };
}

export default function PreviewMenuCard({ item }: PreviewMenuCardProps) {
  const name = item.name || 'Menu Item';
  const description = item.description || item.ingredients || '';
  const price = item.price;
  const brewery = item.brewery;
  const abv = item.abv;
  const type = item.type;

  return (
    <div className="preview-glass-card" style={{ padding: '1.25rem' }}>
      {/* Name + Price row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            className="preview-heading"
            style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: '#f0f5f5',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {name}
          </h3>

          {/* Metadata row: type, brewery, abv */}
          {(type || brewery || abv) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.25rem',
                fontSize: '0.75rem',
                color: '#94a3b8',
                flexWrap: 'wrap',
              }}
            >
              {type && <span>{type}</span>}
              {type && (brewery || abv) && <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>}
              {brewery && <span>{brewery}</span>}
              {brewery && abv && <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>}
              {abv && <span>{abv} ABV</span>}
            </div>
          )}
        </div>

        {price && (
          <span
            className="preview-text-primary-color"
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ${price}
          </span>
        )}
      </div>

      {/* Description / ingredients */}
      {description && (
        <p
          className="preview-text-muted"
          style={{
            marginTop: '0.5rem',
            fontSize: '0.8125rem',
            lineHeight: 1.5,
            margin: '0.5rem 0 0 0',
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}
