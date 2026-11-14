/**
 * Stile und Größenregeln des Dialogs „Spielplan teilen“ (@OB-085). Ausgelagert, damit die Komponente unter 300 Zeilen bleibt.
 *
 * Höhenregel: Der Dialog ist am Handy ein Blatt von höchstens 90 % der Fensterhöhe. Kopf, Fuß mit Taste, Code, Beschriftungen
 * und Link brauchen zusammen `QR_RESERVE`; der QR-Code bekommt den Rest, nie weniger als `QR_MIN` (@OB-085: mindestens 160 Bildpunkte)
 * und nie mehr als `QR_MAX` (Normalgröße am Laptop). So passen Code, QR-Code und „Link kopieren“ ohne Scrollen ins Bild.
 */
import type { CSSProperties } from 'react';
import { cssVars, mediaQueries } from '../../design-tokens';

/** Mindestbreite des QR-Codes (@OB-085, HART) */
const QR_MIN = '160px';
/** Normalgröße des QR-Codes (Laptop, Tablet, hohe Handys) */
const QR_MAX = '220px';
/** Höhe von Kopf, Fuß, Code, Beschriftungen, Link und Abständen neben dem QR-Code (am 360×640-Handy gemessen) */
const QR_RESERVE = '400px';
/** Fensterhöhe, unter der die Abstände im Inhalt enger werden (niedrige Handys wie 360×640) */
const COMPACT_HEIGHT = '700px';
/** Höchstanteil der Fensterhöhe, den das Blatt nutzt (wie DialogSurface) */
const SHEET_SHARE = '90';

/** Klassen und Handy-Regeln: Abstände und QR-Größe hängen an der Fensterhöhe, deshalb als CSS statt als Inline-Wert. */
export const shareDialogCss = `
  .share-dialog-body { display: flex; flex-direction: column; gap: ${cssVars.spacing.xl}; }
  .share-dialog-qr {
    width: ${QR_MAX};
    width: clamp(${QR_MIN}, calc(${SHEET_SHARE}vh - ${QR_RESERVE}), ${QR_MAX});
    width: clamp(${QR_MIN}, calc(${SHEET_SHARE}dvh - ${QR_RESERVE}), ${QR_MAX});
  }
  ${mediaQueries.tabletDown} {
    .share-dialog-body { gap: ${cssVars.spacing.md}; }
  }
  @media (max-height: ${COMPACT_HEIGHT}) {
    .share-dialog-body { gap: ${cssVars.spacing.sm}; }
  }
`;

export const qrSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
};

export const qrImageStyle: CSSProperties = {
  aspectRatio: '1 / 1',
  borderRadius: cssVars.borderRadius.md,
  border: `1px solid ${cssVars.colors.border}`,
  background: cssVars.colors.qrBackground,
  padding: cssVars.spacing.sm,
  boxSizing: 'border-box',
};

export const qrPlaceholderStyle: CSSProperties = {
  ...qrImageStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: cssVars.colors.textMuted,
  fontSize: cssVars.fontSizes.sm,
  textAlign: 'center',
};

export const qrCaptionStyle: CSSProperties = {
  margin: 0,
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textSecondary,
  textAlign: 'center',
};

export const urlSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.xs,
};

export const labelStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textSecondary,
  fontWeight: cssVars.fontWeights.medium,
};

/** Link als auswählbarer Text: umbricht an jeder Stelle, nie abgeschnitten, nie mit „…“ gekürzt. */
export const urlTextStyle: CSSProperties = {
  margin: 0,
  padding: cssVars.spacing.sm,
  borderRadius: cssVars.borderRadius.sm,
  border: `1px solid ${cssVars.colors.borderControl}`,
  background: cssVars.colors.surface,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.sm,
  fontFamily: cssVars.fontFamilies.mono,
  cursor: 'text',
  userSelect: 'all',
  overflowWrap: 'anywhere',
  wordBreak: 'break-all',
};

export const deepLinkLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
  cursor: 'pointer',
  minHeight: cssVars.touchTargets.minimum,
  userSelect: 'none',
};

export const feedbackStyle: CSSProperties = {
  padding: cssVars.spacing.sm,
  marginBottom: cssVars.spacing.sm,
  borderRadius: cssVars.borderRadius.sm,
  background: cssVars.colors.primary,
  color: cssVars.colors.background,
  textAlign: 'center',
  fontSize: cssVars.fontSizes.md,
  fontWeight: cssVars.fontWeights.medium,
};

export const shareCodeDisplayStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
  padding: cssVars.spacing.sm,
  background: cssVars.colors.surfaceElevated,
  borderRadius: cssVars.borderRadius.md,
};

export const shareCodeLabelStyle: CSSProperties = {
  color: cssVars.colors.textSecondary,
  fontSize: cssVars.fontSizes.sm,
};

export const shareCodeValueStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.headlineLg,
  fontWeight: cssVars.fontWeights.bold,
  // eslint-disable-next-line local-rules/no-hardcoded-font-styles -- Monospace is intentional for share code display
  fontFamily: 'monospace',
  letterSpacing: '0.2em',
  color: cssVars.colors.primary,
};

export const notPublicHintStyle: CSSProperties = {
  padding: cssVars.spacing.sm,
  background: cssVars.colors.warningLight,
  borderRadius: cssVars.borderRadius.md,
  border: `1px solid ${cssVars.colors.warningBorder}`,
  color: cssVars.colors.warning,
  fontSize: cssVars.fontSizes.sm,
  textAlign: 'center',
};
