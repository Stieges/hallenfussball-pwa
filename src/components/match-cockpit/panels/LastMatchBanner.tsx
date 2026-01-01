/**
 * LastMatchBanner - Banner showing previously finished match with reopen option
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
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
    marginBottom: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    borderRadius: isMobile ? cssVars.borderRadius.lg : cssVars.borderRadius.full,
    border: `1px dashed ${cssVars.colors.border}`,
    background: cssVars.colors.monitorSectionBg,
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'center',
    justifyContent: 'space-between',
    gap: cssVars.spacing.sm,
    fontSize: isMobile ? cssVars.fontSizes.xs : cssVars.fontSizes.sm,
  };

  return (
    <div style={bannerStyle}>
      <div style={{ color: cssVars.colors.textSecondary }}>
        Letztes Spiel:{' '}
        <strong style={{ color: cssVars.colors.textPrimary }}>
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
