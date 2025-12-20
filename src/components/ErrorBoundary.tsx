import React, { Component, ReactNode } from 'react';
import { theme } from '../styles/theme';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch JavaScript errors in child components
 * and display a fallback UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <DefaultErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ error, onReset }) => (
  <div
    style={{
      padding: '24px',
      margin: '16px 0',
      background: 'rgba(255, 61, 87, 0.1)',
      border: '1px solid rgba(255, 61, 87, 0.3)',
      borderRadius: theme.borderRadius.md,
    }}
    role="alert"
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <span style={{ fontSize: '24px' }} aria-hidden="true">
        ⚠️
      </span>
      <div style={{ flex: 1 }}>
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: theme.fontSizes.lg,
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.error,
          }}
        >
          Etwas ist schiefgelaufen
        </h3>
        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: theme.fontSizes.md,
            color: theme.colors.text.secondary,
            lineHeight: '1.5',
          }}
        >
          Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
        </p>

        {error && process.env.NODE_ENV === 'development' && (
          <pre
            style={{
              margin: '0 0 16px 0',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: theme.borderRadius.sm,
              fontSize: '12px',
              color: theme.colors.text.secondary,
              overflow: 'auto',
              maxHeight: '120px',
            }}
          >
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onReset}
            style={{
              padding: '8px 16px',
              background: theme.colors.primary,
              border: 'none',
              borderRadius: theme.borderRadius.sm,
              color: '#000',
              fontSize: '14px',
              fontWeight: theme.fontWeights.semibold,
              cursor: 'pointer',
            }}
          >
            Erneut versuchen
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.sm,
              color: theme.colors.text.primary,
              fontSize: '14px',
              fontWeight: theme.fontWeights.medium,
              cursor: 'pointer',
            }}
          >
            Seite neu laden
          </button>
        </div>
      </div>
    </div>
  </div>
);

/**
 * Higher-order component to wrap a component with an ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `WithErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithErrorBoundary;
}
