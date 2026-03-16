import { Link } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import SectionHeader from '../components/layout/SectionHeader';
import MenuCard from '../components/menu/MenuCard';
import LoadingSkeleton from '../components/menu/LoadingSkeleton';
import DrinkCarousel from '../components/ui/DrinkCarousel';
import { useCocktails, useShots } from '../hooks/useMenuData';

const COCKTAIL_BADGES: Record<string, { badge: string; badgeVariant?: 'teal' | 'amber' }> = {
  'Burlini Espresso Martini': { badge: 'Fan Favorite' },
  "Iggy's Old Fashion": { badge: 'House Signature' },
  'Marionberry Mule': { badge: 'Oregon Classic', badgeVariant: 'amber' },
};

export default function Cocktails() {
  const { data: cocktails, loading: cocktailsLoading } = useCocktails();
  const { data: shots, loading: shotsLoading } = useShots();

  return (
    <div>
      <PageHeader
        eyebrow="Crafted with Care"
        title="Cocktail Menu"
        subtitle="Signature drinks made from scratch with fresh ingredients and premium spirits"
      />

      {/* Drink Photo Carousel */}
      <DrinkCarousel />

      {/* Signature Cocktails */}
      <section className="section-padding">
        <div className="section-container">
          <SectionHeader
            eyebrow="Signature Cocktails"
            title="Every glass, made from scratch"
          />

          <div className="mt-8">
            {cocktailsLoading ? (
              <LoadingSkeleton count={6} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cocktails.map((item) => {
                  const badgeInfo = COCKTAIL_BADGES[item.name];
                  return (
                    <MenuCard
                      key={item.id}
                      name={item.name}
                      description={item.ingredients}
                      price={item.price}
                      badge={badgeInfo?.badge}
                      badgeVariant={badgeInfo?.badgeVariant}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Shots */}
      <section className="section-padding bg-surface/30">
        <div className="section-container">
          <SectionHeader eyebrow="Shots" title="Quick rounds" />

          <div className="mt-8">
            {shotsLoading ? (
              <LoadingSkeleton count={4} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shots.map((item) => (
                  <MenuCard
                    key={item.id}
                    name={item.name}
                    description={item.ingredients}
                    price={item.price}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Non-Alcoholic CTA */}
      <section className="section-padding">
        <div className="section-container">
          <div className="glass-card p-8 text-center">
            <h3 className="font-heading text-2xl font-bold text-white mb-3">
              Looking for something without alcohol?
            </h3>
            <p className="text-text-muted mb-6">
              Check out our non-alcoholic options, crafted with the same care.
            </p>
            <Link to="/non-alcoholic" className="btn-outline">
              Non-Alcoholic Menu
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
