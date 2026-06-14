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

// Conservative PWA: only registers in production (network-first, auto-update);
// in dev it unregisters any stale worker so Vite HMR is never shadowed.
registerSW();
