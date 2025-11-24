import React, { CSSProperties, ReactNode } from 'react';
import { theme } from '../../styles/theme';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, style = {}, className }) => {
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
    <div style={cardStyles} className={className}>
      {children}
    </div>
  );
};
