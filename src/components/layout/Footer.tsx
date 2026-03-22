import { Link, useLocation } from 'react-router-dom';
import { MapPin, Clock, Mail, Phone, Instagram, Facebook } from 'lucide-react';

const ctaOptions = [
  { path: '/', label: 'View Our Menu', to: '/cocktails' },
  { path: '/cocktails', label: 'See Happy Hour', to: '/happy-hour' },
  { path: '/beers', label: 'View Cocktails', to: '/cocktails' },
  { path: '/food', label: 'See Happy Hour', to: '/happy-hour' },
  { path: '/happy-hour', label: 'Browse the Menu', to: '/food' },
  { path: '/events', label: 'View Our Menu', to: '/cocktails' },
  { path: '/shop', label: 'View Our Menu', to: '/cocktails' },
  { path: '/about', label: 'View Our Menu', to: '/cocktails' },
  { path: '/contact', label: 'See Our Story', to: '/about' },
  { path: '/non-alcoholic', label: 'View Cocktails', to: '/cocktails' },
];

const menuLinks = [
  { label: 'Beers', to: '/beers' },
  { label: 'Cocktails', to: '/cocktails' },
  { label: 'Non-Alcoholic', to: '/non-alcoholic' },
  { label: 'Food', to: '/food' },
  { label: 'Happy Hour', to: '/happy-hour' },
];

const visitLinks = [
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
  { label: 'Book an Event', to: '/contact' },
  { label: 'Shop Merch', to: '/shop' },
];

export default function Footer() {
  const location = useLocation();
  const cta = ctaOptions.find((o) => o.path === location.pathname) ?? ctaOptions[0];

  return (
    <footer className="relative overflow-hidden">
      {/* Top accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      {/* CTA strip */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/80 text-sm font-medium">
            Ready for good drinks and great company?
          </p>
          <div className="flex gap-3">
            <Link
              to={cta.to}
              className="text-sm px-5 py-2 rounded-full bg-primary text-background font-semibold hover:bg-primary/90 transition-colors"
            >
              {cta.label}
            </Link>
            <Link
              to="/contact"
              className="text-sm px-5 py-2 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="bg-[#080c0c]">
        {/* Subtle background glows */}
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-primary/[0.02] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/[0.015] rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            {/* Col 1: Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link to="/" className="inline-block">
                <img
                  src="/images/Iggys_hero.png"
                  alt="Iggy's"
                  className="h-14 w-auto"
                  style={{
                    filter:
                      'drop-shadow(0 0 1px rgba(255,255,255,0.8)) drop-shadow(0 0 4px rgba(45,212,191,0.4))',
                  }}
                />
              </Link>
              <p className="font-display text-accent text-lg mt-3">
                Seaside, Oregon
              </p>
              <p className="text-white/40 text-sm mt-2 leading-relaxed max-w-xs">
                Good drinks, fresh seafood, and great company — a family legacy on
                the Oregon Coast since 1983.
              </p>

              {/* Social links */}
              <div className="flex gap-3 mt-5">
                <a
                  href="https://www.instagram.com/iggysseaside/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/40 hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-all"
                  aria-label="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
                <a
                  href="https://www.facebook.com/profile.php?id=100091456485116"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/40 hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-all"
                  aria-label="Facebook"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Col 2: Find Us — shown first on mobile for walk-in visitors */}
            <div className="order-first sm:order-last">
              <h4 className="text-xs font-bold tracking-widest uppercase text-primary/80 mb-4">
                Find Us
              </h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-primary/60 mt-0.5 shrink-0" />
                  <a
                    href="https://maps.google.com/?q=200+S+Franklin+St,+Seaside,+OR+97138"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/40 hover:text-primary transition-colors"
                  >
                    200 S Franklin St
                    <br />
                    Seaside, OR 97138
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-primary/60 shrink-0" />
                  <span className="text-sm text-white/40">
                    7 Days &middot; 12pm&ndash;12am
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-primary/60 shrink-0" />
                  <a
                    href="tel:+15037380672"
                    className="text-sm text-white/40 hover:text-primary transition-colors"
                  >
                    (503) 738-0672
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-primary/60 shrink-0" />
                  <a
                    href="mailto:iggysbarevents@gmail.com"
                    className="text-sm text-white/40 hover:text-primary transition-colors"
                  >
                    iggysbarevents@gmail.com
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Menu */}
            <div>
              <h4 className="text-xs font-bold tracking-widest uppercase text-primary/80 mb-4">
                Menu
              </h4>
              <ul className="space-y-2.5">
                {menuLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-white/40 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4: Visit */}
            <div>
              <h4 className="text-xs font-bold tracking-widest uppercase text-primary/80 mb-4">
                Visit
              </h4>
              <ul className="space-y-2.5">
                {visitLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-white/40 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="relative border-t border-white/[0.04]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-white/20">
              &copy; {new Date().getFullYear()} Iggy's Seaside. All rights
              reserved.
            </p>
            <p className="text-xs text-white/20">
              Connected to{' '}
              <a
                href="https://www.doogersseafood.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/40 hover:text-primary transition-colors"
              >
                Dooger's Seafood &amp; Grill
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
