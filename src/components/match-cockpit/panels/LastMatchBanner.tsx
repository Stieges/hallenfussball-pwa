/**
 * LastMatchBanner - Banner showing previously finished match with reopen option
 */

import { CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, spacing } from '../../../design-tokens';
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
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: isMobile ? borderRadius.lg : borderRadius.full,
    border: `1px dashed ${colors.border}`,
    background: colors.monitorSectionBg,
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    fontSize: isMobile ? fontSizes.xs : fontSizes.sm,
  };

  return (
    <div style={bannerStyle}>
      <div style={{ color: colors.textSecondary }}>
        Letztes Spiel:{' '}
        <strong style={{ color: colors.textPrimary }}>
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
