import React from 'react';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

interface BeerCardProps {
  name: string;
  brewery: string;
  type: string;
  abv: string;
  price: string;
  isOnTap?: boolean;
}

const BeerCard: React.FC<BeerCardProps> = ({
  name,
  brewery,
  type,
  abv,
  price,
  isOnTap = false,
}) => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <div
      ref={ref}
      className={`glass-card-hover relative p-6 ${
        isOnTap ? 'border-l-2 border-l-primary/40' : ''
      } ${isVisible ? 'animate-fade-in-up' : 'opacity-0 translate-y-6'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading font-semibold text-white">{name}</h3>
          <p className="text-primary/70 text-sm">{brewery}</p>
        </div>
        <span className="text-primary font-bold text-lg shrink-0">{price}</span>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className="bg-white/10 text-text-muted text-xs px-2 py-1 rounded-full">
          {type}
        </span>
        {abv && (
          <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
            {abv}
          </span>
        )}
      </div>
    </div>
  );
};

export default BeerCard;
