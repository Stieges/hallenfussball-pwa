/* eslint-disable react-refresh/only-export-components -- Error boundary with fallback component */
import React, { Component, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../design-tokens';
import { LAZY_IMPORT_FAILED_EVENT, type LazyImportFailedDetail } from '../lib/lazyWithRetry';
import { captureFeatureError } from '../lib/sentry';

const LAZY_IMPORT_ERROR_PREFIX = 'Lazy import failed:';
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Callback when user resets the error boundary (e.g., to navigate away) */
  onReset?: () => void;
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

  componentDidMount(): void {
    window.addEventListener(LAZY_IMPORT_FAILED_EVENT, this.handleLazyImportFailed);
  }

  componentWillUnmount(): void {
    window.removeEventListener(LAZY_IMPORT_FAILED_EVENT, this.handleLazyImportFailed);
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // Report to Sentry (only in production, with consent)
    captureFeatureError(error, 'react', 'error-boundary', {
      componentStack: errorInfo.componentStack,
    });

    this.props.onError?.(error, errorInfo);
  }

  handleLazyImportFailed = (e: Event): void => {
    const detail = (e as CustomEvent<LazyImportFailedDetail>).detail;
    this.setState({
      hasError: true,
      error: new Error(`${LAZY_IMPORT_ERROR_PREFIX} ${detail?.chunkName ?? 'unknown chunk'}`),
    });
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
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

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ error, onReset }) => {
  const { t } = useTranslation('common');
  const isLazyImportError = error?.message.startsWith(LAZY_IMPORT_ERROR_PREFIX) ?? false;
  return (
  <div
    style={{
      padding: cssVars.spacing.lg,
      margin: `${cssVars.spacing.md} 0`,
      background: cssVars.colors.errorSubtle,
      border: `1px solid ${cssVars.colors.errorBorder}`,
      borderRadius: cssVars.borderRadius.md,
    }}
    role="alert"
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: cssVars.spacing.sm }}>
      <span style={{ fontSize: cssVars.fontSizes.xxl }} aria-hidden="true">
        ⚠️
      </span>
      <div style={{ flex: 1 }}>
        <h3
          style={{
            margin: `0 0 ${cssVars.spacing.sm} 0`,
            fontSize: cssVars.fontSizes.lg,
            fontWeight: cssVars.fontWeights.semibold,
            color: cssVars.colors.error,
          }}
        >
          {t('errorBoundary.title')}
        </h3>
        <p
          style={{
            margin: `0 0 ${cssVars.spacing.md} 0`,
            fontSize: cssVars.fontSizes.md,
            color: cssVars.colors.textSecondary,
            lineHeight: '1.5',
          }}
        >
          {isLazyImportError ? t('errorBoundary.refreshRequired') : t('errorBoundary.message')}
        </p>

        {error && process.env.NODE_ENV === 'development' && (
          <pre
            style={{
              margin: `0 0 ${cssVars.spacing.md} 0`,
              padding: cssVars.spacing.sm,
              background: cssVars.colors.surfaceElevated,
              borderRadius: cssVars.borderRadius.sm,
              fontSize: cssVars.fontSizes.sm,
              color: cssVars.colors.textSecondary,
              overflow: 'auto',
              maxHeight: '120px',
            }}
          >
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        )}

        <div style={{ display: 'flex', gap: cssVars.spacing.sm }}>
          {!isLazyImportError && (
            <button
              onClick={onReset}
              style={{
                padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
                background: cssVars.colors.primary,
                border: 'none',
                borderRadius: cssVars.borderRadius.sm,
                color: cssVars.colors.onPrimary,
                fontSize: cssVars.fontSizes.md,
                fontWeight: cssVars.fontWeights.semibold,
                cursor: 'pointer',
              }}
            >
              {t('actions.retry')}
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
              background: isLazyImportError ? cssVars.colors.primary : cssVars.colors.surfaceElevated,
              border: isLazyImportError ? 'none' : `1px solid ${cssVars.colors.border}`,
              borderRadius: cssVars.borderRadius.sm,
              color: isLazyImportError ? cssVars.colors.onPrimary : cssVars.colors.textPrimary,
              fontSize: cssVars.fontSizes.md,
              fontWeight: isLazyImportError ? cssVars.fontWeights.semibold : cssVars.fontWeights.medium,
              cursor: 'pointer',
            }}
          >
            {t('actions.reload')}
          </button>
        </div>
      </div>
    </div>
  </div>
  );
};

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

  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Intentional: empty displayName should fall through to name
  WithErrorBoundary.displayName = `WithErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithErrorBoundary;
}
