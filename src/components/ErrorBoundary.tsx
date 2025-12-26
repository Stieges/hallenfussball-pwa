/* eslint-disable react-refresh/only-export-components -- Error boundary with fallback component */
import React, { Component, ReactNode } from 'react';
import { borderRadius, colors, fontSizes, fontWeights } from '../design-tokens';
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
      borderRadius: borderRadius.md,
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
            fontSize: fontSizes.lg,
            fontWeight: fontWeights.semibold,
            color: colors.error,
          }}
        >
          Etwas ist schiefgelaufen
        </h3>
        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: fontSizes.md,
            color: colors.textSecondary,
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
              borderRadius: borderRadius.sm,
              fontSize: '12px',
              color: colors.textSecondary,
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
              background: colors.primary,
              border: 'none',
              borderRadius: borderRadius.sm,
              color: colors.onPrimary,
              fontSize: '14px',
              fontWeight: fontWeights.semibold,
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
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.sm,
              color: colors.textPrimary,
              fontSize: '14px',
              fontWeight: fontWeights.medium,
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
