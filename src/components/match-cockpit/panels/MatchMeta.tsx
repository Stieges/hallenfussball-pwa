/**
 * MatchMeta - Display match metadata (referee, match ID, duration)
 */

import { CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../../design-tokens';
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
    gap: spacing.sm,
    alignItems: 'center',
    fontSize: isMobile ? fontSizes.xs : fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  };

  const metaItemStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: isMobile ? `6px ${spacing.sm}` : `${spacing.xs} ${spacing.sm}`,
    borderRadius: borderRadius.full,
    border: `1px solid ${colors.border}`,
    background: colors.monitorSectionBgLight,
  };

  const labelStyle: CSSProperties = {
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
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
