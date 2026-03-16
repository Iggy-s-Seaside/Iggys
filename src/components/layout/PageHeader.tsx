interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

export default function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <section className="gradient-mesh-bg py-24 lg:py-32 pt-32 text-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="uppercase tracking-widest text-xs font-bold text-primary mb-4">
          {eyebrow}
        </p>
        <div className="w-12 h-0.5 bg-gradient-to-r from-primary to-accent mx-auto mb-6" />
        <h1 className="font-heading text-4xl lg:text-5xl font-bold text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="text-text-muted text-lg max-w-2xl mx-auto mt-4">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
