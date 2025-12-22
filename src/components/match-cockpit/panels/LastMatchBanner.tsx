/**
 * LastMatchBanner - Banner showing previously finished match with reopen option
 */

import { CSSProperties } from 'react';
import { theme } from '../../../styles/theme';
import { Button } from '../../ui';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { MatchSummary } from '../MatchCockpit';

export interface LastMatchBannerProps {
  lastMatch: {
    match: MatchSummary;
    homeScore: number;
    awayScore: number;
  };
  onReopen(): void;
}

export const LastMatchBanner: React.FC<LastMatchBannerProps> = ({ lastMatch, onReopen }) => {
  const isMobile = useIsMobile();

  const bannerStyle: CSSProperties = {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: isMobile ? theme.borderRadius.lg : '999px',
    border: `1px dashed ${theme.colors.border}`,
    background: 'rgba(15, 23, 42, 0.9)',
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    fontSize: isMobile ? theme.fontSizes.xs : theme.fontSizes.sm,
  };

  return (
    <div style={bannerStyle}>
      <div style={{ color: theme.colors.text.secondary }}>
        Letztes Spiel:{' '}
        <strong style={{ color: theme.colors.text.primary }}>
          Spiel {lastMatch.match.number}: {lastMatch.match.homeTeam.name} {lastMatch.homeScore} :{' '}
          {lastMatch.awayScore} {lastMatch.match.awayTeam.name}
        </strong>
      </div>
      <Button variant="secondary" size="sm" onClick={onReopen}>
        Als aktuelles Spiel öffnen
      </Button>
    </div>
  );
};
