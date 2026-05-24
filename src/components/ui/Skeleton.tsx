import React from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  /** Width of the skeleton (CSS value) */
  width?: string;
  /** Height of the skeleton (CSS value) */
  height?: string;
  /** Shape variant */
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  /** Animation type - respects prefers-reduced-motion */
  animation?: 'shimmer' | 'pulse' | 'none';
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Number of text lines to display (for variant="text") */
  lines?: number;
  /** Accessible label for screen readers */
  'aria-label'?: string;
}

/**
 * Skeleton loading placeholder component.
 *
 * Displays a placeholder animation while content is loading.
 * Automatically respects `prefers-reduced-motion` preference.
 *
 * @example
 * // Single line text skeleton
 * <Skeleton variant="text" width="200px" />
 *
 * // Avatar skeleton
 * <Skeleton variant="circular" width="48px" height="48px" />
 *
 * // Card skeleton
 * <Skeleton variant="rounded" width="100%" height="120px" />
 *
 * // Multiple text lines
 * <Skeleton variant="text" lines={3} />
 */
export function Skeleton({
  width,
  height,
  variant = 'text',
  animation = 'shimmer',
  className = '',
  style,
  lines = 1,
  'aria-label': ariaLabel = 'Loading...',
}: SkeletonProps): React.ReactElement {
  const variantClass = styles[variant] ?? styles.text;
  const animationClass = animation !== 'none' ? styles[animation] : '';

  const combinedStyle: React.CSSProperties = {
    width: width ?? (variant === 'text' ? '100%' : undefined),
    height: height ?? (variant === 'text' ? '1em' : undefined),
    ...style,
  };

  // For text variant with multiple lines
  if (variant === 'text' && lines > 1) {
    return (
      <div
        className={`${styles.textContainer} ${className}`}
        role="status"
        aria-label={ariaLabel}
        aria-busy="true"
      >
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${styles.skeleton} ${variantClass} ${animationClass}`}
            style={{
              ...combinedStyle,
              // Last line is shorter for realism
              width: index === lines - 1 ? '70%' : width ?? '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${styles.skeleton} ${variantClass} ${animationClass} ${className}`}
      style={combinedStyle}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    />
  );
}

export default Skeleton;
