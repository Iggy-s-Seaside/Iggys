interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
}

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: SectionHeaderProps) {
  const isCenter = align === 'center';

  return (
    <div className={isCenter ? 'text-center' : ''}>
      {eyebrow && (
        <p className="uppercase tracking-widest text-xs font-bold text-primary flex items-center gap-3">
          <span className="w-3 h-0.5 bg-gradient-to-r from-primary to-accent inline-block" />
          {eyebrow}
        </p>
      )}
      <h2 className="font-heading text-3xl lg:text-4xl font-bold text-white mt-3">
        {title}
      </h2>
      {subtitle && (
        <p
          className={`text-text-muted mt-4 max-w-2xl ${
            isCenter ? 'mx-auto' : ''
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
