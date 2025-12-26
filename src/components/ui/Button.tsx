import React, { CSSProperties, ReactNode, useState, useEffect } from 'react';
import { borderRadius, colors, fontFamilies, fontSizes, fontWeights, gradients, spacing } from '../../design-tokens';
import { transitions } from '../../styles/motion';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  fullWidth?: boolean;
  style?: CSSProperties;
  /** Accessible label for screen readers (required for icon-only buttons) */
  'aria-label'?: string;
  /** Button type attribute */
  type?: 'button' | 'submit' | 'reset';
  /** Enable press effect (scale down on press). Default: true */
  pressEffect?: boolean;
  /** Loading state - shows spinner and disables button */
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  fullWidth = false,
  style = {},
  'aria-label': ariaLabel,
  type = 'button',
  pressEffect = true,
  loading = false,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const isDisabled = disabled || loading;
  const shouldAnimate = pressEffect && !prefersReducedMotion && !isDisabled;

  const handlePressStart = () => {
    if (shouldAnimate) {
      setIsPressed(true);
    }
  };

  const handlePressEnd = () => {
    setIsPressed(false);
  };

  const baseStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    border: 'none',
    borderRadius: borderRadius.md,
    fontWeight: fontWeights.bold,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: `all 0.2s ease, ${transitions.buttonPress}`,
    fontFamily: fontFamilies.body,
    width: fullWidth ? '100%' : 'auto',
    opacity: isDisabled ? 0.5 : 1,
    transform: isPressed ? 'scale(0.97)' : 'scale(1)',
  };

  const sizeStyles: Record<string, CSSProperties> = {
    sm: {
      padding: `${spacing.sm} ${spacing.md}`,
      fontSize: fontSizes.sm,
    },
    md: {
      padding: `${spacing.md} ${spacing.lg}`,
      fontSize: fontSizes.md,
    },
    lg: {
      padding: `${spacing.lg} ${spacing.xl}`,
      fontSize: fontSizes.lg,
    },
  };

  const variantStyles: Record<string, CSSProperties> = {
    primary: {
      background: gradients.primary,
      color: colors.background,
    },
    secondary: {
      background: colors.surface,
      color: colors.textPrimary,
      border: `1px solid ${colors.border}`,
    },
    ghost: {
      background: 'transparent',
      color: colors.textSecondary,
    },
    danger: {
      background: colors.error,
      color: colors.textPrimary,
    },
  };

  const combinedStyles: CSSProperties = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  // Loading spinner component
  const LoadingSpinner = () => (
    <span
      style={{
        display: 'inline-block',
        width: '1em',
        height: '1em',
        border: '2px solid currentColor',
        borderRightColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
      aria-hidden="true"
    />
  );

  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      style={combinedStyles}
      aria-label={ariaLabel}
      aria-disabled={isDisabled}
      aria-busy={loading}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressEnd}
    >
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <span style={{ display: 'flex' }} aria-hidden="true">{icon}</span>
          )}
          {children}
          {icon && iconPosition === 'right' && (
            <span style={{ display: 'flex' }} aria-hidden="true">{icon}</span>
          )}
        </>
      )}
    </button>
  );
};
