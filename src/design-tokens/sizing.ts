/**
 * Sizing Tokens - Touch Targets & Component Sizes
 *
 * Based on WCAG 2.1 Success Criterion 2.5.5 (Target Size)
 * Minimum touch target: 44x44px
 * Comfortable: 48x48px (Material Design 3 recommendation)
 * Primary actions: 56x56px
 */

export const touchTargets = {
  /** Minimum accessible touch target (WCAG 2.5.5) */
  minimum: '44px',
  /** Comfortable touch target size (MD3) */
  comfortable: '48px',
  /** Large touch target for primary actions */
  primary: '56px',
} as const;

/** Lesebreiten von Dialogen (nur diese drei verwenden) */
export const dialogWidths = {
  sm: '400px',
  md: '480px',
  lg: '800px',
} as const;

export const touchTargetValues = {
  minimum: 44,
  comfortable: 48,
  primary: 56,
} as const;

/**
 * Icon sizes - harmonized with touch targets
 */
export const iconSizes = {
  /** Small icons (status, inline) */
  xs: '16px',
  /** Default icon size */
  sm: '20px',
  /** Standard icon size */
  md: '24px',
  /** Large icons */
  lg: '32px',
  /** Extra large icons */
  xl: '40px',
} as const;

export const iconSizeValues = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
} as const;

/**
 * Input heights - consistent form elements
 */
export const inputHeights = {
  /** Compact inputs */
  sm: '36px',
  /** Standard input height */
  md: '44px',
  /** Large inputs */
  lg: '56px',
} as const;

/**
 * Button heights - match touch targets
 */
export const buttonHeights = {
  /** Small buttons */
  sm: '36px',
  /** Standard buttons */
  md: '44px',
  /** Large/primary buttons */
  lg: '56px',
} as const;

/**
 * Layout heights - fixed height components
 */
export const layoutHeights = {
  /** Bottom navigation bar height */
  bottomNav: '56px',
  /** Bottom action bar height (save/cancel in edit modes) */
  bottomActionBar: '56px',
  /** Header/toolbar height */
  header: '56px',
} as const;

export const layoutHeightValues = {
  bottomNav: 56,
  bottomActionBar: 56,
  header: 56,
} as const;

/**
 * Component sizes - feste Maße einzelner Bereiche (px, skalieren nicht mit der Schriftgröße).
 */
export const componentSizes = {
  /** Breite der Ereignis-Spalte neben der Spielfläche (Live-Cockpit, ab Desktop) */
  sidebarWidth: '300px',
  /** Mindesthöhe eines Leerzustands (z. B. „Kein Spiel ausgewählt“) */
  emptyStateMinHeight: '300px',
  /** Haarlinie: 1 px, z. B. für unsichtbare, aber vorlesbare Bereiche */
  hairline: '1px',
} as const;

/**
 * Rahmenbreiten (Freigabe Daniel 18.10.): dünn, mittel, kräftig. `cssVars.borderWidth.thin` ist derselbe Wert.
 * Ergebniskasten kleiner Größen: dezenter Rahmen `medium`, kräftiger Rahmen `strong`, Ring `medium`.
 */
export const borderWidths = {
  thin: '1px',
  medium: '2px',
  strong: '3px',
} as const;

/**
 * Mindest-Spaltenbreiten der Raster (grid-template-columns minmax): sm für das Typwahl-Raster,
 * md für das Einstellungsraster des Monitor-Editors.
 */
export const gridMinColumnWidths = { sm: '140px', md: '180px' } as const;

export type TouchTargetKey = keyof typeof touchTargets;
export type IconSizeKey = keyof typeof iconSizes;
export type InputHeightKey = keyof typeof inputHeights;
export type ButtonHeightKey = keyof typeof buttonHeights;
export type LayoutHeightKey = keyof typeof layoutHeights;
