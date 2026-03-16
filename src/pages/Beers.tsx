import { useState } from 'react';
import { Link } from 'react-router-dom';
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

  return (
    <div>
      <PageHeader
        eyebrow="Craft & Cold"
        title="Beer Menu"
        subtitle="8 rotating taps featuring the best of Oregon, plus a full cold selection"
      />

      {/* On Tap */}
      <section className="section-padding">
        <div className="section-container">
          <SectionHeader eyebrow="On Tap" title="Fresh from the taps" />

          <div className="mt-8">
            {onTapLoading ? (
              <LoadingSkeleton count={6} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {onTapData.map((item) => (
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
