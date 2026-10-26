/**
 * Stil-Objekte des Monitor-Editors (M1a aus MonitorEditor.tsx ausgelagert).
 */

import type { CSSProperties } from 'react';
import { borderWidths, cssVars, spacingSemantics } from '../../../../design-tokens';

export const editorStyle: CSSProperties = {
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

export const headerStyle: CSSProperties = {
  padding: cssVars.spacing.lg,
  borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

export const titleStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.xl,
  fontWeight: cssVars.fontWeights.bold,
  color: cssVars.colors.textPrimary,
  margin: 0,
};

export const closeButtonStyle: CSSProperties = {
  minWidth: cssVars.touchTargets.minimum,
  minHeight: cssVars.touchTargets.minimum,
  background: 'transparent',
  border: 'none',
  fontSize: cssVars.fontSizes.xl,
  cursor: 'pointer',
  color: cssVars.colors.textSecondary,
};

export const contentStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: cssVars.spacing.lg,
  position: 'relative',
};

export const loadingOverlayStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: cssVars.zIndex.raised,
  borderRadius: cssVars.borderRadius.md,
};

export const spinnerStyle: CSSProperties = {
  width: cssVars.iconSizes.xl,
  height: cssVars.iconSizes.xl,
  border: `${borderWidths.strong} solid ${cssVars.colors.border}`,
  borderTopColor: cssVars.colors.primary,
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

export const sectionStyle: CSSProperties = {
  marginBottom: cssVars.spacing.xl,
};

export const sectionTitleStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.semibold,
  color: cssVars.colors.textPrimary,
  marginBottom: cssVars.spacing.md,
};

export const settingsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: cssVars.spacing.md,
};

export const inputGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.xs,
};

export const labelStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textSecondary,
};

export const inputStyle: CSSProperties = {
  padding: cssVars.spacing.sm,
  borderRadius: cssVars.borderRadius.md,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  background: cssVars.colors.surface,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.md,
};

export const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

export const slidesListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.sm,
};

export const slideItemStyle = (isEditing: boolean): CSSProperties => ({
  padding: cssVars.spacing.md,
  background: cssVars.colors.surface,
  borderRadius: cssVars.borderRadius.md,
  border: `${cssVars.borderWidth.thin} solid ${isEditing ? cssVars.colors.primary : cssVars.colors.border}`,
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.md,
});

export const slideIconStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.xl,
  width: cssVars.iconSizes.xl,
  textAlign: 'center',
};

export const slideInfoStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

export const slideTypeStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.md,
  fontWeight: cssVars.fontWeights.medium,
  color: cssVars.colors.textPrimary,
};

export const slideDescStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textSecondary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const slideActionsStyle: CSSProperties = {
  display: 'flex',
  gap: cssVars.spacing.xs,
};

export const iconButtonStyle: CSSProperties = {
  minWidth: spacingSemantics.iconButtonSm,
  minHeight: spacingSemantics.iconButtonSm,
  padding: cssVars.spacing.xs,
  background: 'transparent',
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.sm,
  cursor: 'pointer',
  fontSize: cssVars.fontSizes.md,
};

export const addSlideButtonStyle: CSSProperties = {
  width: '100%',
  padding: cssVars.spacing.md,
  background: cssVars.colors.surfaceLight,
  border: `${cssVars.borderWidth.medium} dashed ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
  cursor: 'pointer',
  fontSize: cssVars.fontSizes.md,
  color: cssVars.colors.textPrimary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: cssVars.spacing.sm,
};

export const slideTypeSelectorStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: cssVars.spacing.sm,
  marginTop: cssVars.spacing.md,
  padding: cssVars.spacing.md,
  background: cssVars.colors.surface,
  borderRadius: cssVars.borderRadius.md,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
};

export const slideTypeButtonStyle: CSSProperties = {
  padding: cssVars.spacing.md,
  background: cssVars.colors.surfaceLight,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
  cursor: 'pointer',
  textAlign: 'center',
};

export const errorStyle: CSSProperties = {
  padding: cssVars.spacing.sm,
  background: `${cssVars.colors.error}22`,
  color: cssVars.colors.error,
  borderRadius: cssVars.borderRadius.sm,
  fontSize: cssVars.fontSizes.sm,
  marginBottom: cssVars.spacing.md,
};

export const slideConfigStyle: CSSProperties = {
  marginTop: cssVars.spacing.md,
  padding: cssVars.spacing.md,
  background: cssVars.colors.surfaceLight,
  borderRadius: cssVars.borderRadius.md,
};

export const slidePreviewWrapStyle: CSSProperties = {
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
};

export const slideTypeIconStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.xxl,
  marginBottom: cssVars.spacing.xs,
};

export const slideTypeLabelStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.sm,
};

export const slideTypeQrHintStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.xs,
  color: cssVars.colors.textSecondary,
};
