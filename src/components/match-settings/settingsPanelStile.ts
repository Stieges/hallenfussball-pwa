/**
 * Gemeinsame Stile (Tokens) der Einstellungen des Match Cockpits. Aus `MatchCockpitSettingsPanel.tsx` gelöst (H4-12), Verhalten gleich.
 */

import type { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';

// Form element dimensions
const SELECT_MIN_WIDTH = 180;
const SLIDER_WIDTH = 120;

export const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.lg,
    // Task R2 Fixrunde 3: Reset der nativen <fieldset>-Default-Styles (Browser setzen sonst
    // border/padding/margin/min-width auf das Element) — hält das Panel optisch identisch zum
    // vorherigen <div>.
    border: 'none',
    margin: 0,
    padding: 0,
    minWidth: 0,
  },
  section: {
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.md,
  },
  sectionTitle: {
    margin: 0,
    marginBottom: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap', // schmale Anzeige: Bedienelement rutscht unter die Beschriftung statt sie zu überdecken
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: cssVars.spacing.md,
    padding: `${cssVars.spacing.sm} 0`,
    borderBottom: `1px solid ${cssVars.colors.border}`,
  },
  rowContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: '1 1 50%',
    minWidth: 0,
  },
  rowLabel: {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  },
  rowDescription: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
  rowControl: {
    flexShrink: 0,
    maxWidth: '100%',
  },

  // Select
  select: {
    minWidth: `min(${SELECT_MIN_WIDTH}px, 100%)`, // nie breiter als die Karte (@OB-021)
    maxWidth: '100%',
    flex: '1 1 auto',
    height: cssVars.touchTargets.minimum, // @OB-022: Bedienelemente mindestens 44 hoch
    padding: `0 ${cssVars.spacing.lg} 0 ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.lg, // @OB-022: Eingabefelder mindestens 16
    fontFamily: cssVars.fontFamilies.body,
    color: cssVars.colors.textPrimary,
    background: cssVars.colors.surfaceSolid,
    border: `1px solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23A3B8D4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    backgroundSize: '16px',
  },

  // Slider
  sliderContainer: {
    display: 'flex',
    flexWrap: 'wrap', // „Anhören“ bricht auf schmalen Handys in die nächste Zeile statt über den Rand zu ragen
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  // Schieberegler in nativer Darstellung: Tippfläche mindestens 44 hoch, Schrift mindestens 16 (@OB-022)
  slider: {
    width: `${SLIDER_WIDTH}px`,
    height: cssVars.touchTargets.minimum,
    fontSize: cssVars.fontSizes.lg,
    accentColor: cssVars.colors.primary,
    cursor: 'pointer',
  },
  iconButton: {
    minWidth: cssVars.touchTargets.minimum,
  },

  // Upload
  uploadContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  errorText: {
    marginTop: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.error,
  },
};
