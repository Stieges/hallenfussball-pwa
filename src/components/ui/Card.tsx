import React, { CSSProperties, ReactNode } from 'react';
import { cssVars } from '../../design-tokens'
interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Test ID for E2E tests */
  'data-testid'?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  style = {},
  className,
  onClick,
  onMouseEnter,
  onMouseLeave,
  'data-testid': testId,
}) => {
  const cardStyles: CSSProperties = {
    background: cssVars.gradients.card,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.xl,
    boxShadow: cssVars.shadows.md,
    ...style,
  };

  return (
    <div
      style={cardStyles}
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-testid={testId}
    >
      {children}
    </div>
  );
};
