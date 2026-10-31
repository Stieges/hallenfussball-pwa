import React, { useState, CSSProperties } from 'react';
import { cssVars, displayFontSizes } from '../../design-tokens';
import { TeamLogo, TeamColors } from '../../types/tournament';

/**
 * Avatar sizes following design token spacing
 */
const AVATAR_SIZES = {
  xs: 24,   // Compact lists, tables
  sm: 32,   // Desktop cards
  md: 40,   // Mobile match cards
  lg: 56,   // Live display
  xl: 80,   // Edit dialog, detail view
  xxl: 120, // Monitor view
  xxxl: 180, // TV displays, large projections
} as const;

/** Initialen-Schrift als Anteil der Avatar-Größe */
const INITIALS_SHARE = 0.4;

/**
 * Bild-Logo ganz im Kreis (Daniel 31.10., @ZM-157, @ZM-185): das Bild wird mit erhaltenem Seitenverhältnis in ein Quadrat von
 * 1/√2 des Durchmessers eingepasst; dessen Ecken liegen genau auf dem Kreis, also liegt jedes eingepasste Logo (hoch, breit, quadratisch)
 * vollständig im Kreis – nichts wird angeschnitten.
 */
const LOGO_INSCRIBED_SHARE = 0.7;

export type AvatarSize = keyof typeof AVATAR_SIZES;

interface TeamAvatarProps {
  /** Team data with name, optional logo and colors */
  team: {
    name: string;
    logo?: TeamLogo;
    colors?: TeamColors;
    /**
     * Offene Spielseite (Herkunft statt Team, @TM-015): der Name ist dann eine Herkunft oder „noch offen“.
     * Der Avatar zeigt dafür keine Initialen und keine Farbe, nur einen neutralen Platzhalter.
     */
    pending?: boolean;
  };
  /** Size variant */
  size?: AvatarSize;
  /** Größe als Token-String (z. B. `displayFontSizes.teamName`); hat Vorrang vor `size` (Monitor, Aufgabe 3.1) */
  dimension?: string;
  /**
   * Initialen neutral statt Weiß auf Streufarbe (Monitor, Spielanzeige S3): Fläche, Schrift und Rand kommen vom Thema der Anzeige,
   * damit zwei Buchstaben in jeder Farbe lesbar bleiben (Kontrast ≥ 4,5 : 1). Ein Logo bleibt davon unberührt.
   */
  neutral?: { background: string; color: string; border: string };
  /** Show jersey color ring around avatar */
  showColorRing?: boolean;
  /** Additional styles */
  style?: CSSProperties;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}

/**
 * Get initials from team name (first 2 letters or first letters of first 2 words)
 */
function getInitials(name: string): string {
  if (!name) {return '??';}

  const words = name.trim().split(/\s+/);

  if (words.length >= 2) {
    // First letter of first two words: "FC Bayern" -> "FB"
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  // First two letters of single word: "Bayern" -> "BA"
  return name.slice(0, 2).toUpperCase();
}

/**
 * Generate a deterministic background color from team name
 */
function getBackgroundColor(name: string, providedColor?: string): string {
  if (providedColor) {return providedColor;}

  // Simple hash function for deterministic color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use muted colors from a predefined palette
  const colors = [
    '#4A5568', // Gray
    '#2B6CB0', // Blue
    '#2F855A', // Green
    '#C53030', // Red
    '#805AD5', // Purple
    '#D69E2E', // Yellow/Gold
    '#00A3C4', // Teal
    '#C05621', // Orange
  ];

  return colors[Math.abs(hash) % colors.length];
}

export const TeamAvatar: React.FC<TeamAvatarProps> = ({
  team,
  size = 'md',
  dimension,
  neutral,
  showColorRing = false,
  style = {},
  'data-testid': testId,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const pixelSize = AVATAR_SIZES[size];
  const ringWidth = size === 'xs' ? 2 : size === 'sm' ? 2 : 3;
  const fontSize = dimension === undefined ? `${Math.round(pixelSize * INITIALS_SHARE)}px` : `max(calc(${dimension} * ${INITIALS_SHARE}), ${displayFontSizes.clockHint})`;

  const logo = team.logo;
  const hasLogo = logo && logo.type !== 'initials' && !imageError;
  const logoUrl = hasLogo ? logo.value : null;

  const pending = team.pending === true;
  const initials = pending ? '' : getInitials(team.name);
  const bgColor = getBackgroundColor(team.name, team.logo?.backgroundColor ?? team.colors?.primary);

  const containerStyles: CSSProperties = {
    position: 'relative',
    width: dimension ?? pixelSize,
    height: dimension ?? pixelSize,
    flexShrink: 0,
    ...style,
  };

  const avatarStyles: CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: cssVars.borderRadius.full,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: pending || (hasLogo && imageLoaded) ? 'transparent' : neutral?.background ?? bgColor,
    color: neutral?.color ?? '#FFFFFF',
    fontSize,
    fontWeight: cssVars.fontWeights.bold,
    fontFamily: cssVars.fontFamilies.body,
    textTransform: 'uppercase',
    userSelect: 'none',
    border: pending
      ? `1px dashed ${cssVars.colors.textPlaceholder}`
      : neutral !== undefined
        ? `${cssVars.borderWidth.thin} solid ${neutral.border}`
      : showColorRing && team.colors?.primary
        ? `${ringWidth}px solid ${team.colors.primary}`
        : `1px solid ${cssVars.colors.border}`,
    boxSizing: 'border-box',
  };

  const imageStyles: CSSProperties = {
    width: `${LOGO_INSCRIBED_SHARE * 100}%`,
    height: `${LOGO_INSCRIBED_SHARE * 100}%`,
    objectFit: 'contain',
    opacity: imageLoaded ? 1 : 0,
    transition: 'opacity 0.2s ease',
  };

  const initialsContainerStyles: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: hasLogo && imageLoaded ? 0 : 1,
    transition: 'opacity 0.2s ease',
  };

  return (
    <div style={containerStyles} data-testid={testId}>
      <div style={avatarStyles} aria-hidden={pending ? 'true' : undefined}>
        {logoUrl && (
          <img
            src={logoUrl}
            alt={`${team.name} Logo`}
            style={imageStyles}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}
        <div style={initialsContainerStyles} data-initialen>
          {initials}
        </div>
      </div>

      {/* Secondary color indicator (small dot) */}
      {showColorRing && team.colors?.secondary && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: Math.round(pixelSize * 0.3),
            height: Math.round(pixelSize * 0.3),
            borderRadius: cssVars.borderRadius.full,
            backgroundColor: team.colors.secondary,
            border: `2px solid ${cssVars.colors.background}`,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default TeamAvatar;
