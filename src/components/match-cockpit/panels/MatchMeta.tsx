/**
 * MatchMeta - Display match metadata (referee, match ID, duration)
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
import { useIsMobile } from '../../../hooks/useIsMobile';

export interface MatchMetaProps {
  refereeName?: string;
  matchId: string;
  durationSeconds: number;
}

export const MatchMeta: React.FC<MatchMetaProps> = ({ refereeName, matchId, durationSeconds }) => {
  const isMobile = useIsMobile();

  const metaStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: cssVars.spacing.sm,
    alignItems: 'center',
    fontSize: isMobile ? cssVars.fontSizes.xs : cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.md,
  };

  const metaItemStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: isMobile ? `6px ${cssVars.spacing.sm}` : `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.full,
    border: `1px solid ${cssVars.colors.border}`,
    background: cssVars.colors.monitorSectionBgLight,
  };

  const labelStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  };

  const minutes = Math.round(durationSeconds / 60);

  return (
    <div style={metaStyle}>
      {refereeName && (
        <span style={metaItemStyle}>
          <span style={labelStyle}>Schiedsrichter:</span>
          <span>{refereeName}</span>
        </span>
      )}
      <span style={metaItemStyle}>
        <span style={labelStyle}>Spiel-ID:</span>
        <span>{matchId}</span>
      </span>
      <span style={metaItemStyle}>
        <span style={labelStyle}>Dauer:</span>
        <span>{minutes}:00 Min</span>
      </span>
    </div>
  );
};
