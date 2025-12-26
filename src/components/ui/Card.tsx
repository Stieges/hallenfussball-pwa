import React, { CSSProperties, ReactNode } from 'react';
import { borderRadius, colors, gradients, shadows, spacing } from '../../design-tokens';
interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  style = {},
  className,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const cardStyles: CSSProperties = {
    background: gradients.card,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    boxShadow: shadows.md,
    ...style,
  };

  return (
    <div
      style={cardStyles}
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
};
