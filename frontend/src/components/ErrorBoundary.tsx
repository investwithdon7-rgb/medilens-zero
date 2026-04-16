import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in dev; swap for a real error tracking service (Sentry etc.) in prod
    console.error('[MediLens] Uncaught error:', error.message, errorInfo.componentStack);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '50vh', padding: '3rem 2rem',
          textAlign: 'center', gap: '1rem',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(251,113,133,0.1)', color: 'var(--rose-400)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ color: 'var(--text-primary)' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 420, fontSize: '0.9rem' }}>
            An unexpected error occurred. This has been noted. Please refresh and try again —
            if the problem persists, the data pipeline may be updating.
          </p>
          <button
            onClick={() => window.location.href = '/medilens'}
            className="btn btn-primary"
            style={{ marginTop: '0.5rem' }}
          >
            Back to Home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
