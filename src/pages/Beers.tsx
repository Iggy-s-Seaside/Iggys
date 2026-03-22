import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import SectionHeader from '../components/layout/SectionHeader';
import BeerCard from '../components/menu/BeerCard';
import LoadingSkeleton from '../components/menu/LoadingSkeleton';
import CategoryTabs from '../components/menu/CategoryTabs';
import { useOnTap, useOffTap } from '../hooks/useMenuData';

const COLD_CATEGORIES = ['All', 'Craft/Import', 'Domestic', 'Value', 'Seltzer & N/A'];

export default function Beers() {
  const { data: onTapData, loading: onTapLoading } = useOnTap();
  const { data: offTapData, loading: offTapLoading } = useOffTap();
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredOffTap = offTapData.filter((item) => {
    if (activeCategory === 'All') return true;

    const type = item.type?.toLowerCase() ?? '';
    const price = item.price?.trim() ?? '';

    switch (activeCategory) {
      case 'Craft/Import':
        return (
          type.includes('ipa') ||
          type.includes('stout') ||
          (type.includes('lager') && !type.includes('american')) ||
          type.includes('cider')
        );
      case 'Domestic':
        return type.includes('american') && price === '$5';
      case 'Value':
        return price === '$4';
      case 'Seltzer & N/A':
        return type.includes('seltzer') || type.includes('n/a');
      default:
        return true;
    }
  });

  const featuredBeer = onTapData[0];
  const remainingOnTap = onTapData.slice(1);

  return (
    <div>
      <PageHeader
        eyebrow="Craft & Cold"
        title="Beer Menu"
        subtitle="8 rotating taps featuring the best of Oregon, plus a full cold selection"
      />

      {/* On Tap */}
      <section className="section-padding section-glow">
        <div className="section-container">
          <SectionHeader eyebrow="On Tap" title="Fresh from the taps" />

          <div className="mt-8">
            {onTapLoading ? (
              <LoadingSkeleton count={6} />
            ) : (
              <div className="animate-fade-in">
                {/* Featured beer — staff pick hero */}
                {featuredBeer && (
                  <div className="glass-card border-l-4 border-l-accent p-6 md:p-8 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <span className="inline-flex items-center gap-1.5 bg-accent/10 text-accent text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-accent/20 mb-3">
                          <Star className="w-3 h-3" />
                          Staff Pick
                        </span>
                        <h3 className="font-heading text-2xl font-bold text-white">
                          {featuredBeer.name}
                        </h3>
                        <p className="text-primary/70 text-sm mt-1">{featuredBeer.brewery}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="bg-white/10 text-text-muted text-xs px-2 py-1 rounded-full">
                            {featuredBeer.type}
                          </span>
                          {featuredBeer.abv && (
                            <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                              {featuredBeer.abv}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-primary font-bold text-2xl md:text-3xl shrink-0">
                        {featuredBeer.price?.trim()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Remaining on-tap beers */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {remainingOnTap.map((item) => (
                    <BeerCard
                      key={item.id}
                      name={item.name}
                      brewery={item.brewery}
                      type={item.type}
                      abv={item.abv}
                      price={item.price?.trim()}
                      isOnTap={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Cold Selection */}
      <section className="section-padding bg-surface/30">
        <div className="section-container">
          <SectionHeader eyebrow="Bottles & Cans" title="Cold selection" />

          <div className="mt-8">
            <CategoryTabs
              categories={COLD_CATEGORIES}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />

            <div className="mt-6">
              {offTapLoading ? (
                <LoadingSkeleton count={6} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOffTap.map((item) => (
                    <BeerCard
                      key={item.id}
                      name={item.name}
                      brewery={item['description '] ?? ''}
                      type={item.type}
                      abv={item.abv ?? ''}
                      price={item.price?.trim()}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Happy Hour CTA */}
      <section className="section-padding">
        <div className="section-container">
          <div className="glass-card p-8 text-center">
            <h3 className="font-heading text-2xl font-bold text-white mb-3">
              Happy hour is even better with beer
            </h3>
            <p className="text-text-muted mb-6">
              Enjoy discounted drafts and bottles every day from 3pm to 5pm.
            </p>
            <Link to="/happy-hour" className="btn-primary">
              View Happy Hour
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
