import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import App from './App';
import './index.css';

// Microsoft Clarity — heatmaps + session replay for the booking funnel.
// Inert until VITE_CLARITY_ID is set, so this ships safely with no project id.
const clarityId = import.meta.env.VITE_CLARITY_ID as string | undefined;
if (clarityId) {
  const w = window as unknown as { clarity?: { (...a: unknown[]): void; q?: unknown[] } };
  w.clarity = w.clarity || function (...args: unknown[]) { (w.clarity!.q = w.clarity!.q || []).push(args); };
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${clarityId}`;
  document.head.appendChild(s);
}

// Google Ads (gtag.js) — conversion tracking for high-intent funnel events.
// Inert until VITE_GOOGLE_ADS_ID is set (mirrors the Clarity gate above), so
// this ships safely with no account id. The actual conversion firing lives in
// lib/track.ts, which checks for window.gtag before sending anything.
const googleAdsId = import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined;
if (googleAdsId) {
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = w.gtag || function (...args: unknown[]) { w.dataLayer!.push(args); };
  w.gtag('js', new Date());
  w.gtag('config', googleAdsId);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAdsId)}`;
  document.head.appendChild(s);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CartProvider>
        <App />
      </CartProvider>
    </BrowserRouter>
  </StrictMode>
);
