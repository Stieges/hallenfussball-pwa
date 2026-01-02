/**
 * Legal Page Styles - Shared styles for legal pages
 *
 * Extracted for React Fast Refresh compatibility.
 */

import { type CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';

export const sectionStyles = {
  section: {
    marginBottom: cssVars.spacing.xl,
  } as CSSProperties,

  h2: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.semibold,
    marginBottom: cssVars.spacing.md,
    marginTop: cssVars.spacing.xl,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  h3: {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.medium,
    marginBottom: cssVars.spacing.sm,
    marginTop: cssVars.spacing.lg,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  paragraph: {
    fontSize: cssVars.fontSizes.md,
    lineHeight: 1.6,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  strong: {
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  placeholder: {
    backgroundColor: cssVars.colors.warningLight,
    color: cssVars.colors.warning,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
    fontFamily: 'monospace',
    fontSize: cssVars.fontSizes.sm,
  } as CSSProperties,

  link: {
    color: cssVars.colors.primary,
    textDecoration: 'underline',
  } as CSSProperties,

  buttonLink: {
    color: cssVars.colors.primary,
    textDecoration: 'underline',
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    cursor: 'pointer',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
  } as CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  th: {
    padding: cssVars.spacing.sm,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    textAlign: 'left',
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.sm,
  } as CSSProperties,

  td: {
    padding: cssVars.spacing.sm,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  list: {
    paddingLeft: cssVars.spacing.lg,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  listItem: {
    fontSize: cssVars.fontSizes.md,
    lineHeight: 1.6,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.xs,
  } as CSSProperties,
};
