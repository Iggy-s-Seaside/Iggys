import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw, Phone } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
        <div className="card max-w-sm w-full p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <AlertTriangle size={26} className="text-primary" />
          </div>
          <h1 className="text-lg font-semibold text-text-primary mb-1.5">Something hiccuped</h1>
          <p className="text-sm text-text-secondary mb-6">
            The app ran into an unexpected snag. Reloading usually clears it right up.
          </p>
          <button onClick={this.handleReload} className="btn-primary w-full">
            <RotateCw size={16} />
            Reload
          </button>
          <a
            href="tel:+15037380672"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 text-sm text-text-muted hover:text-primary transition-colors"
          >
            <Phone size={14} />
            Still stuck? Call (503) 738-0672
          </a>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
