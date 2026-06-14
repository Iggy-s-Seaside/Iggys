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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CartProvider>
        <App />
      </CartProvider>
    </BrowserRouter>
  </StrictMode>
);
