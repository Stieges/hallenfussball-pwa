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

/**
 * Preset skeleton configurations for common use cases
 */
export const SkeletonPresets = {
  /** Avatar placeholder (48x48 circle) */
  Avatar: (props?: Partial<SkeletonProps>) => (
    <Skeleton
      variant="circular"
      width="48px"
      height="48px"
      aria-label="Loading avatar"
      {...props}
    />
  ),

  /** Team name text placeholder */
  TeamName: (props?: Partial<SkeletonProps>) => (
    <Skeleton
      variant="text"
      width="120px"
      height="20px"
      aria-label="Loading team name"
      {...props}
    />
  ),

  /** Score placeholder */
  Score: (props?: Partial<SkeletonProps>) => (
    <Skeleton
      variant="rounded"
      width="48px"
      height="32px"
      aria-label="Loading score"
      {...props}
    />
  ),

  /** Match card placeholder */
  MatchCard: (props?: Partial<SkeletonProps>) => (
    <Skeleton
      variant="rounded"
      width="100%"
      height="80px"
      aria-label="Loading match"
      {...props}
    />
  ),

  /** Tournament card placeholder */
  TournamentCard: (props?: Partial<SkeletonProps>) => (
    <Skeleton
      variant="rounded"
      width="100%"
      height="160px"
      aria-label="Loading tournament"
      {...props}
    />
  ),

  /** Button placeholder */
  Button: (props?: Partial<SkeletonProps>) => (
    <Skeleton
      variant="rounded"
      width="100px"
      height="40px"
      aria-label="Loading button"
      {...props}
    />
  ),
} as const;

export default Skeleton;
