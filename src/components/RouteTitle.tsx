import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BASE = "Iggy's Seaside Bar";

const TITLES: Record<string, string> = {
  '/': `${BASE} — Seaside, Oregon`,
  '/beers': `Beers on Tap — ${BASE}`,
  '/cocktails': `Cocktail Menu — ${BASE}`,
  '/food': `Food Menu — ${BASE}`,
  '/happy-hour': `Happy Hour — ${BASE}`,
  '/non-alcoholic': `Non-Alcoholic Drinks — ${BASE}`,
  '/shop': `Merch — ${BASE}`,
  '/events': `Events & Top Deck Saturdays — ${BASE}`,
  '/about': `Our Story — ${BASE}`,
  '/contact': `Contact & Hours — ${BASE}`,
  '/book': `Book a Private Event — ${BASE}`,
  '/feedback': `Share Your Feedback — ${BASE}`,
  '/checkout/success': `Order Confirmed — ${BASE}`,
  '/checkout/cancel': `Checkout Canceled — ${BASE}`,
  '/privacy': `Privacy Policy — ${BASE}`,
  '/sms-terms': `SMS Terms — ${BASE}`,
};

export default function RouteTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = TITLES[pathname] ?? `${BASE} — Seaside, Oregon`;
  }, [pathname]);

  return null;
}
