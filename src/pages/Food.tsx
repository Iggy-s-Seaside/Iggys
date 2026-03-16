import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import MenuCard from '../components/menu/MenuCard';
import OptionMenuCard from '../components/menu/OptionMenuCard';
import { doogersMenu } from '../data/doogersMenu';

const categoryNames = doogersMenu.map((c) => c.title);

export default function Food() {
  const [activeCategory, setActiveCategory] = useState(categoryNames[0]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const navRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  const scrollToCategory = useCallback((name: string) => {
    isScrolling.current = true;
    setActiveCategory(name);

    // Scroll the nav pill into view horizontally (without affecting window scroll)
    if (navRef.current) {
      const btn = navRef.current.querySelector(`[data-category="${name}"]`) as HTMLElement | null;
      if (btn) {
        const container = navRef.current;
        const scrollLeft = btn.offsetLeft - container.offsetWidth / 2 + btn.offsetWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }

    // Scroll the page to the section
    requestAnimationFrame(() => {
      const el = sectionRefs.current[name];
      if (el) {
        const navHeight = navRef.current?.offsetHeight ?? 60;
        const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
      setTimeout(() => {
        isScrolling.current = false;
      }, 900);
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (isScrolling.current) return;
    const navHeight = (navRef.current?.offsetHeight ?? 60) + 100;

    for (let i = categoryNames.length - 1; i >= 0; i--) {
      const el = sectionRefs.current[categoryNames[i]];
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= navHeight) {
          if (categoryNames[i] !== activeCategory) {
            setActiveCategory(categoryNames[i]);
          }
          return;
        }
      }
    }
  }, [activeCategory]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div>
      <PageHeader
        eyebrow="From Dooger's Kitchen"
        title="Food Menu"
        subtitle="Served from Dooger's Seafood & Grill, a Seaside institution since 1983 — right here at the bar"
      />

      {/* Limited Menu Notice + Category Nav */}
      <div className="sticky top-16 lg:top-20 z-40 bg-background/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="section-container py-3">
          {/* Limited menu badge */}
          <div className="flex items-center justify-between gap-4 mb-3">
            <span className="text-accent text-sm font-medium">
              Full menu until 9pm &middot; Limited menu after 9pm
            </span>
          </div>

          {/* Category pills */}
          <div
            ref={navRef}
            className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide -mx-1 px-1"
          >
            {categoryNames.map((name) => (
              <button
                key={name}
                data-category={name}
                onClick={() => scrollToCategory(name)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                  activeCategory === name
                    ? 'bg-primary text-background'
                    : 'bg-white/[0.06] text-text-muted hover:bg-white/10 hover:text-white'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Sections */}
      {doogersMenu.map((category) => (
        <section
          key={category.title}
          ref={(el) => { sectionRefs.current[category.title] = el; }}
          className="py-10 border-b border-white/[0.04] last:border-b-0"
        >
          <div className="section-container">
            {/* Section heading */}
            <div className="mb-6">
              <span className="text-primary text-xs font-bold tracking-widest uppercase">
                {category.eyebrow}
              </span>
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-white mt-1">
                {category.title}
              </h2>
              {category.note && (
                <p className="text-text-muted text-sm mt-2 max-w-2xl">
                  {category.note}
                </p>
              )}
            </div>

            {/* Items grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {category.items.map((item) =>
                item.options ? (
                  <OptionMenuCard
                    key={item.name}
                    name={item.name}
                    description={item.description}
                    options={item.options}
                  />
                ) : (
                  <MenuCard
                    key={item.name}
                    name={item.name}
                    description={item.description}
                    price={item.price}
                  />
                )
              )}
            </div>
          </div>
        </section>
      ))}

      {/* Happy Hour CTA */}
      <section className="section-padding">
        <div className="section-container">
          <div className="glass-card p-8 text-center">
            <h3 className="font-heading text-2xl font-bold text-white mb-3">
              Pair it with happy hour deals
            </h3>
            <p className="text-text-muted mb-6">
              Great food tastes even better at happy hour prices. Every day, 3pm
              to 5pm.
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
