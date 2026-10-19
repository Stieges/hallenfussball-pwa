/**
 * Stile der Sichtbarkeits-Seite (aus `index.tsx` ausgelagert, Spielanzeige 2.3): nur Tokens, keine Logik.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';

export const visibilityStyles = {
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  } as CSSProperties,

  radioOption: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  radioOptionSelected: {
    borderColor: cssVars.colors.primary,
    background: cssVars.colors.primarySubtle,
  } as CSSProperties,

  radioLabel: {
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  radioDescription: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
    marginTop: cssVars.spacing.xs,
  } as CSSProperties,

  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  } as CSSProperties,

  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.bodyMd,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  qrContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.lg,
  } as CSSProperties,

  linkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    flexWrap: 'wrap',
  } as CSSProperties,

  linkInput: {
    flex: 1,
    minWidth: 0,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: cssVars.colors.inputBg,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodySm,
  } as CSSProperties,

  copyButton: {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: cssVars.colors.primarySubtle,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.primaryBorder}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.primary,
    fontSize: cssVars.fontSizes.bodySm,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  copyButtonSuccess: {
    background: cssVars.colors.successLight,
    borderColor: cssVars.colors.successHover,
    color: cssVars.colors.success,
  } as CSSProperties,

  qrPreview: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.lg,
    flexWrap: 'wrap',
  } as CSSProperties,

  qrPlaceholder: {
    width: cssVars.sizing.qrPlaceholder,
    height: cssVars.sizing.qrPlaceholder,
    background: cssVars.colors.surfaceHover,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.displayLg,
    color: cssVars.colors.textMuted,
    flexShrink: 0,
  } as CSSProperties,

  qrActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  } as CSSProperties,

  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: cssVars.colors.surface,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodySm,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  tip: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.infoLight,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.infoBorder}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.info,
  } as CSSProperties,

  disabledSection: {
    opacity: cssVars.opacity.disabled,
    pointerEvents: 'none',
  } as CSSProperties,

  saveIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: cssVars.colors.successLight,
    color: cssVars.colors.success,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.labelSm,
    marginLeft: cssVars.spacing.sm,
  } as CSSProperties,
} as const;
