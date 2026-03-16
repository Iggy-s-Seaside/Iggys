import { useScrollAnimation } from '../../hooks/useScrollAnimation';

interface OptionMenuCardProps {
  name: string;
  description?: string;
  options: { label: string; price: string }[];
}

export default function OptionMenuCard({
  name,
  description,
  options,
}: OptionMenuCardProps) {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <div
      ref={ref}
      className={`glass-card-hover relative p-5 ${
        isVisible ? 'animate-fade-in-up' : 'opacity-0 translate-y-6'
      }`}
    >
      <h3 className="font-heading text-lg font-semibold text-white">{name}</h3>

      {description && (
        <p className="text-text-muted text-sm mt-1 italic">{description}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-3">
        {options.map((opt) => (
          <span
            key={opt.label}
            className="bg-white/[0.06] border border-white/10 rounded-full px-3 py-1 text-sm"
          >
            <span className="text-text-muted">{opt.label}</span>{' '}
            <span className="text-primary font-bold">{opt.price}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
