import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

export const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.lg,
  padding: cssVars.spacing.lg,
};

export const introStyle: CSSProperties = {
  margin: 0,
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textSecondary,
};

export const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.sm,
};

export const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.semibold,
  color: cssVars.colors.textPrimary,
};

export const optionStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: cssVars.spacing.md,
  minHeight: cssVars.touchTargets.minimum,
  padding: cssVars.spacing.md,
  borderRadius: cssVars.borderRadius.md,
  border: `${cssVars.borderWidth.thin} solid ${active ? cssVars.colors.primary : cssVars.colors.borderControl}`,
  background: active ? cssVars.colors.surfaceLight : cssVars.colors.surface,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.md,
  textAlign: 'left',
  cursor: 'pointer',
});

export const mutedStyle: CSSProperties = {
  margin: 0,
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textSecondary,
};

export const alertStyle: CSSProperties = {
  margin: 0,
  padding: cssVars.spacing.sm,
  borderRadius: cssVars.borderRadius.sm,
  background: cssVars.colors.errorSubtle,
  color: cssVars.colors.error,
  fontSize: cssVars.fontSizes.sm,
};

export const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: cssVars.spacing.sm,
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
};

export const fileInputStyle: CSSProperties = {
  minHeight: cssVars.touchTargets.minimum,
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textPrimary,
};
