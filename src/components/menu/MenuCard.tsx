import React from 'react';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

interface MenuCardProps {
  name: string;
  description?: string | null;
  price: string;
  badge?: string;
  badgeVariant?: 'teal' | 'amber';
}

const MenuCard: React.FC<MenuCardProps> = ({
  name,
  description,
  price,
  badge,
  badgeVariant = 'teal',
}) => {
  const { ref, isVisible } = useScrollAnimation();

  const badgeClasses =
    badgeVariant === 'amber'
      ? 'bg-accent/20 text-accent'
      : 'bg-primary/20 text-primary';

  return (
    <div
      ref={ref}
      className={`glass-card-hover relative p-6 ${
        isVisible ? 'animate-fade-in-up' : 'opacity-0 translate-y-6'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-lg font-semibold text-white">
          {name}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {badge && (
            <span
              className={`text-2xs font-bold uppercase px-2 py-0.5 rounded-full ${badgeClasses}`}
            >
              {badge}
            </span>
          )}
          <span className="text-primary font-bold">{price}</span>
        </div>
      </div>

      {description && (
        <p className="text-text-muted text-sm mt-2 italic">{description}</p>
      )}
    </div>
  );
};

export default MenuCard;
