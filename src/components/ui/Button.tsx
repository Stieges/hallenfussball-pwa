import React, { CSSProperties, ReactNode } from 'react';
import { theme } from '../../styles/theme';

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
}) => {
  const baseStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontWeight: theme.fontWeights.bold,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: theme.fonts.body,
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.5 : 1,
  };

  const sizeStyles: Record<string, CSSProperties> = {
    sm: {
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      fontSize: theme.fontSizes.sm,
    },
    md: {
      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
      fontSize: theme.fontSizes.md,
    },
    lg: {
      padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
      fontSize: theme.fontSizes.lg,
    },
  };

  const variantStyles: Record<string, CSSProperties> = {
    primary: {
      background: theme.gradients.primary,
      color: theme.colors.background,
    },
    secondary: {
      background: theme.colors.surface,
      color: theme.colors.text.primary,
      border: `1px solid ${theme.colors.border}`,
    },
    ghost: {
      background: 'transparent',
      color: theme.colors.text.secondary,
    },
    danger: {
      background: theme.colors.error,
      color: theme.colors.text.primary,
    },
  };

  const combinedStyles: CSSProperties = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={combinedStyles}
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      {icon && iconPosition === 'left' && (
        <span style={{ display: 'flex' }} aria-hidden="true">{icon}</span>
      )}
      {children}
      {icon && iconPosition === 'right' && (
        <span style={{ display: 'flex' }} aria-hidden="true">{icon}</span>
      )}
    </button>
  );
};
