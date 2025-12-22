/**
 * MatchMeta - Display match metadata (referee, match ID, duration)
 */

import { CSSProperties } from 'react';
import { theme } from '../../../styles/theme';
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
    gap: theme.spacing.sm,
    alignItems: 'center',
    fontSize: isMobile ? theme.fontSizes.xs : theme.fontSizes.sm,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
  };

  const metaItemStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: isMobile ? `6px ${theme.spacing.sm}` : `4px ${theme.spacing.sm}`,
    borderRadius: '999px',
    border: `1px solid ${theme.colors.border}`,
    background: 'rgba(15, 23, 42, 0.65)',
  };

  const labelStyle: CSSProperties = {
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.text.primary,
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
