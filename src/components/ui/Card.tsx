import React, { CSSProperties, ReactNode } from 'react';
import { theme } from '../../styles/theme';

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
    background: theme.gradients.card,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    boxShadow: theme.shadows.md,
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
