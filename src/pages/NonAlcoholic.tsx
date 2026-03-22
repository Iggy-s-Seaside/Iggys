import { Link } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import SectionHeader from '../components/layout/SectionHeader';
import { nonAlcoholicData } from '../data/nonAlcoholic';

const ACCENT_STYLES: Record<string, { border: string; dot: string }> = {
  primary: {
    border: 'border-l-primary/40',
    dot: 'bg-primary',
  },
  accent: {
    border: 'border-l-accent/40',
    dot: 'bg-accent',
  },
  amber: {
    border: 'border-l-amber-500/40',
    dot: 'bg-amber-500',
  },
};

export default function NonAlcoholic() {
  return (
    <>
      <PageHeader
        eyebrow="Everyone's Welcome"
        title="Non-Alcoholic Menu"
        subtitle="Great drinks for everyone — no alcohol required"
      />

      {nonAlcoholicData.map((category, idx) => {
        const styles = ACCENT_STYLES[category.accentColor] ?? ACCENT_STYLES.primary;

        return (
          <section
            key={category.title}
            className={`section-padding ${idx % 2 === 0 ? '' : 'bg-surface/30'}`}
          >
            <div className="section-container">
              <SectionHeader title={category.title} subtitle={category.subtitle} />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
                {category.items.map((item) => (
                  <div
                    key={item.name}
                    className={`glass-card-hover p-5 border-l-2 ${styles.border}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} shrink-0`} />
                          <h3 className="font-heading font-semibold text-white">
                            {item.name}
                          </h3>
                        </div>
                        {item.description && (
                          <p className="text-text-muted text-sm mt-1 ml-3.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <span className="text-primary font-bold text-lg shrink-0">
                        {item.price}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* Bottom CTA */}
      <section className="section-padding">
        <div className="section-container text-center">
          <p className="text-text-muted mb-6">Looking for something stronger?</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/cocktails" className="btn-primary">
              Check out our cocktail menu
            </Link>
            <Link to="/beers" className="btn-outline">
              Or our beer selection
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
