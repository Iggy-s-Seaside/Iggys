import React from 'react';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

interface HappyHourCardProps {
  name: string;
  description: string;
  price: string;
  icon?: string;
}

const HappyHourCard: React.FC<HappyHourCardProps> = ({
  name,
  description,
  price,
  icon,
}) => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <div
      ref={ref}
      className={`glass-card-hover p-5 flex items-start gap-4 ${
        isVisible ? 'animate-fade-in-up' : 'opacity-0 translate-y-6'
      }`}
    >
      {icon && (
        <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-2xl">
          {icon}
        </div>
      )}

      <div className="min-w-0">
        <h3 className="font-semibold text-white">{name}</h3>
        <p className="text-text-muted text-sm">{description}</p>
        <p className="text-accent font-bold text-lg mt-1">{price}</p>
      </div>
    </div>
  );
};

export default HappyHourCard;
