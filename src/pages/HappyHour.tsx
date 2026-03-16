import PageHeader from '../components/layout/PageHeader';
import SectionHeader from '../components/layout/SectionHeader';
import HappyHourCard from '../components/menu/HappyHourCard';
import OptionMenuCard from '../components/menu/OptionMenuCard';
import LoadingSkeleton from '../components/menu/LoadingSkeleton';
import { useHappyHour } from '../hooks/useMenuData';
import { specialItems } from '../data/doogersMenu';

export default function HappyHour() {
  const { data: happyHourData, loading } = useHappyHour();

  const drinks = happyHourData.filter((item) => item.type === 'drink');
  const food = happyHourData.filter(
    (item) => item.type === 'food' || item.type === 'app'
  );

  return (
    <div>
      <PageHeader
        eyebrow="Every Single Day"
        title="Happy Hour"
        subtitle="The best deals in Seaside, 7 days a week"
      />

      {/* Time Display */}
      <div className="section-container py-12 text-center">
        <p className="text-6xl md:text-8xl font-heading font-bold gradient-text">
          3pm &ndash; 5pm
        </p>
        <p className="text-text-muted text-xl mt-4">Every Single Day</p>
      </div>

      {/* Happy Hour Drinks */}
      <section className="section-padding">
        <div className="section-container">
          <SectionHeader eyebrow="Drinks" title="Happy hour drinks" />

          <div className="mt-8">
            {loading ? (
              <LoadingSkeleton count={4} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {drinks.map((item) => (
                  <HappyHourCard
                    key={item.id}
                    name={item.name}
                    description={item.description}
                    price={item.price}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Specials — Wings & Tacos */}
      <section className="section-padding bg-surface/30">
        <div className="section-container">
          <SectionHeader eyebrow="Specials" title="Wings & tacos" />
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {specialItems.map((item) => (
              <OptionMenuCard
                key={item.name}
                name={item.name}
                description={item.description}
                options={item.options!}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Happy Hour Food */}
      <section className="section-padding">
        <div className="section-container">
          <SectionHeader eyebrow="Bites" title="Happy hour food" />

          <div className="mt-8">
            {loading ? (
              <LoadingSkeleton count={4} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {food.map((item) => (
                  <HappyHourCard
                    key={item.id}
                    name={item.name}
                    description={item.description}
                    price={item.price}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
