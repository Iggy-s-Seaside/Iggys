import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import MenuCard from '../components/menu/MenuCard';
import OptionMenuCard from '../components/menu/OptionMenuCard';
import { useFoodMenu } from '../hooks/useMenuData';

type MenuMode = 'dinner' | 'lunch';

function getDefaultMode(): MenuMode {
  const hour = new Date().getHours();
  // Before 4pm (16:00) → lunch, after → dinner
  return hour < 16 ? 'lunch' : 'dinner';
}

export default function Food() {
  const { data: allCategories, loading, error } = useFoodMenu();
  const [menuMode, setMenuMode] = useState<MenuMode>(getDefaultMode);

  // Filter categories based on mode
  const categories = useMemo(() => {
    return allCategories.filter(
      (c) => c.menu_type === menuMode || c.menu_type === 'both'
    );
  }, [allCategories, menuMode]);

  const categoryNames = useMemo(() => categories.map((c) => c.title), [categories]);

  const [activeCategory, setActiveCategory] = useState('');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const navRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  // Reset active category when mode changes
  useEffect(() => {
    if (categoryNames.length > 0) {
      setActiveCategory(categoryNames[0]);
      sectionRefs.current = {};
      window.scrollTo({ top: 0 });
    }
  }, [menuMode, categoryNames]);

  const scrollToCategory = useCallback((name: string) => {
    isScrolling.current = true;
    setActiveCategory(name);

    if (navRef.current) {
      const btn = navRef.current.querySelector(`[data-category="${name}"]`) as HTMLElement | null;
      if (btn) {
        const container = navRef.current;
        const scrollLeft = btn.offsetLeft - container.offsetWidth / 2 + btn.offsetWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }

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
  }, [activeCategory, categoryNames]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (loading) {
    return (
      <div>
        <PageHeader
          eyebrow="From Dooger's Kitchen"
          title="Food Menu"
          subtitle="Served from Dooger's Seafood & Grill, a Seaside institution since 1983 — right here at the bar"
        />
        <div className="section-container py-20 text-center">
          <div className="animate-pulse text-text-muted">Loading menu...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          eyebrow="From Dooger's Kitchen"
          title="Food Menu"
          subtitle="Served from Dooger's Seafood & Grill, a Seaside institution since 1983 — right here at the bar"
        />
        <div className="section-container py-20 text-center">
          <p className="text-red-400">Failed to load menu. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="From Dooger's Kitchen"
        title="Food Menu"
        subtitle="Served from Dooger's Seafood & Grill, a Seaside institution since 1983 — right here at the bar"
      />

      {/* Menu Mode Toggle + Category Nav */}
      <div className="sticky top-16 lg:top-20 z-40 bg-background/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="section-container py-3">
          {/* Dinner / Lunch toggle */}
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex bg-white/[0.06] rounded-full p-0.5">
                <button
                  onClick={() => setMenuMode('lunch')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    menuMode === 'lunch'
                      ? 'bg-accent text-background'
                      : 'text-text-muted hover:text-white'
                  }`}
                >
                  Lunch
                </button>
                <button
                  onClick={() => setMenuMode('dinner')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    menuMode === 'dinner'
                      ? 'bg-primary text-background'
                      : 'text-text-muted hover:text-white'
                  }`}
                >
                  Dinner
                </button>
              </div>
              <span className="text-text-muted text-xs">
                {menuMode === 'lunch' ? 'Served until 4pm' : 'Full menu until 9pm · Limited after 9pm'}
              </span>
            </div>
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
      {categories.map((category) => (
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
