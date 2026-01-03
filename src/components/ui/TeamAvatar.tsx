import React, { useState, CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';
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
  xxl: 120, // Monitor view, TV displays
} as const;

type AvatarSize = keyof typeof AVATAR_SIZES;

interface TeamAvatarProps {
  /** Team data with name, optional logo and colors */
  team: {
    name: string;
    logo?: TeamLogo;
    colors?: TeamColors;
  };
  /** Size variant */
  size?: AvatarSize;
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
  showColorRing = false,
  style = {},
  'data-testid': testId,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const pixelSize = AVATAR_SIZES[size];
  const ringWidth = size === 'xs' ? 2 : size === 'sm' ? 2 : 3;
  const fontSize = Math.round(pixelSize * 0.4);

  const logo = team.logo;
  const hasLogo = logo && logo.type !== 'initials' && !imageError;
  const logoUrl = hasLogo ? logo.value : null;

  const initials = getInitials(team.name);
  const bgColor = getBackgroundColor(team.name, team.logo?.backgroundColor || team.colors?.primary);

  const containerStyles: CSSProperties = {
    position: 'relative',
    width: pixelSize,
    height: pixelSize,
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
    backgroundColor: hasLogo && imageLoaded ? 'transparent' : bgColor,
    color: '#FFFFFF',
    fontSize: `${fontSize}px`,
    fontWeight: cssVars.fontWeights.bold,
    fontFamily: cssVars.fontFamilies.body,
    textTransform: 'uppercase',
    userSelect: 'none',
    border: showColorRing && team.colors?.primary
      ? `${ringWidth}px solid ${team.colors.primary}`
      : `1px solid ${cssVars.colors.border}`,
    boxSizing: 'border-box',
  };

  const imageStyles: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
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
      <div style={avatarStyles}>
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
        <div style={initialsContainerStyles}>
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
