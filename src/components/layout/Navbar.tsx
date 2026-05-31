import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { useScrollPosition } from '../../hooks/useScrollAnimation';
import { useCart } from '../../context/CartContext';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Beers', to: '/beers' },
  { label: 'Cocktails', to: '/cocktails' },
  { label: 'Food', to: '/food' },
  { label: 'Happy Hour', to: '/happy-hour' },
  { label: 'Events', to: '/events' },
  { label: 'Shop', to: '/shop' },
  { label: 'About', to: '/about' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollY = useScrollPosition();
  const location = useLocation();
  const { totalItems, setIsCartOpen } = useCart();

  const scrolled = scrollY > 50;

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-background/95 backdrop-blur-xl shadow-lg shadow-black/30'
            : 'bg-black/40 backdrop-blur-md'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <img
                src="/images/Iggys_hero.png"
                alt="Iggy's"
                className="h-10 lg:h-14 w-auto"
                style={{
                  filter:
                    'drop-shadow(0 0 1px rgba(255,255,255,0.9)) drop-shadow(0 0 3px rgba(255,255,255,0.6)) drop-shadow(0 0 8px rgba(45,212,191,0.5))',
                }}
              />
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1 lg:gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    location.pathname === link.to
                      ? 'text-primary'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right side: Cart + CTA + Hamburger */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 text-white/70 hover:text-white transition-colors"
                aria-label="Open cart"
              >
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-background text-xs font-bold rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </button>

              <Link
                to="/book"
                className="hidden md:inline-flex btn-primary text-sm px-4 py-2"
              >
                Book Event
              </Link>

              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 text-white/70 hover:text-white transition-colors"
                aria-label="Toggle menu"
              >
                {mobileOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Overlay — rendered outside nav to avoid stacking context issues */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[100] flex flex-col overflow-hidden"
          style={{ backgroundColor: '#0a0f0f' }}
        >
          {/* Ambient glow accents */}
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary/[0.07] rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-accent/[0.06] rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/[0.03] rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="relative flex items-center justify-between px-5 h-16 shrink-0">
            <Link to="/" onClick={() => setMobileOpen(false)}>
              <img
                src="/images/Iggys_hero.png"
                alt="Iggy's"
                className="h-10 w-auto"
                style={{
                  filter:
                    'drop-shadow(0 0 1px rgba(255,255,255,0.9)) drop-shadow(0 0 3px rgba(255,255,255,0.6)) drop-shadow(0 0 8px rgba(45,212,191,0.5))',
                }}
              />
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-2 text-white/70 hover:text-white transition-colors"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Decorative line under header */}
          <div className="relative mx-5 h-px bg-gradient-to-r from-primary/40 via-accent/30 to-transparent" />

          {/* Nav links */}
          <div className="relative flex-1 flex flex-col items-center justify-center gap-1 pb-16">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`relative text-2xl font-heading font-medium py-2.5 px-6 rounded-xl transition-all ${
                    isActive
                      ? 'text-primary'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-0 bg-primary/[0.08] border border-primary/20 rounded-xl" />
                  )}
                  <span className="relative">{link.label}</span>
                </Link>
              );
            })}

            {/* Accent divider before CTA */}
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent my-4" />

            <Link
              to="/book"
              onClick={() => setMobileOpen(false)}
              className="btn-primary px-8 py-3 text-base"
            >
              Book Event
            </Link>

            {/* Hours badge */}
            <p className="mt-6 text-white/30 text-xs tracking-wider uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              Open Daily 12pm&ndash;12am
            </p>
          </div>
        </div>
      )}
    </>
  );
}
