import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmProvider } from './hooks/useConfirm';
import App from './App';
import { registerSW } from './pwa/registerSW';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <ThemeProvider>
                <AuthProvider>
                    <ErrorBoundary>
                        <ConfirmProvider>
                            <App />
                        </ConfirmProvider>
                    </ErrorBoundary>
                    <Toaster
                        position="bottom-center"
                        containerStyle={{ bottom: 130 }}
                        toastOptions={{
                            duration: 3000,
                            className:
                                '!bg-surface !text-text-primary !border !border-border !shadow-card',
                            style: {
                                fontSize: '14px',
                            },
                        }}
                    />
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    </StrictMode>,
);

// Chunk-mismatch self-heal. After a deploy, Netlify drops the previous build's
// content-hashed chunks. A tab still running the OLD index.html will try to
// import() a chunk filename that no longer exists when you navigate to a lazy
// route (Pipeline, Reports, …) → Vite fires `vite:preloadError`, which would
// otherwise bubble to the ErrorBoundary ("Something hiccuped"). Reload once: the
// network-first service worker then serves the fresh index.html with valid chunk
// names. A sessionStorage guard prevents a reload loop if the chunk is genuinely
// gone (real 404, offline) rather than just stale.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'iggys.chunkReloadAt';
  const now = Date.now();
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(KEY) || '0');
  } catch {
    /* private mode — fall through, worst case one extra reload */
  }
  // Only auto-reload if we haven't already done so in the last 10s.
  if (now - last < 10_000) return;
  try {
    sessionStorage.setItem(KEY, String(now));
  } catch {
    /* ignore */
  }
  event.preventDefault();
  window.location.reload();
});

// Conservative PWA: only registers in production (network-first, auto-update);
// in dev it unregisters any stale worker so Vite HMR is never shadowed.
registerSW();
