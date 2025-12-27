/**
 * FinishPanel - Post-match actions (edit result, resume, load next)
 */

import { CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../../design-tokens';
import { Button } from '../../ui';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { LiveMatch } from '../MatchCockpit';

export interface FinishPanelProps {
  match: LiveMatch;
  onResume(): void;
  onEdit(): void;
  onNext(): void;
}

export const FinishPanel: React.FC<FinishPanelProps> = ({ match, onResume, onEdit, onNext }) => {
  const isMobile = useIsMobile();

  const panelStyle: CSSProperties = {
    marginTop: spacing.md,
    padding: isMobile ? spacing.lg : spacing.md,
    borderRadius: borderRadius.lg,
    border: `1px dashed ${colors.border}`,
    background: colors.monitorSectionBgStrong,
    fontSize: isMobile ? fontSizes.md : fontSizes.sm,
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? spacing.sm : '6px',
  };

  const titleStyle: CSSProperties = {
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    fontSize: isMobile ? fontSizes.lg : fontSizes.md,
  };

  const summaryStyle: CSSProperties = {
    fontSize: isMobile ? fontSizes.md : fontSizes.sm,
    color: colors.textSecondary,
  };

  const controlsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  };

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>Spiel beendet – Ergebnis prüfen</div>
      <div style={summaryStyle}>
        <div>
          <strong style={{ color: colors.textPrimary }}>{match.homeTeam.name}</strong> vs.{' '}
          <strong style={{ color: colors.textPrimary }}>{match.awayTeam.name}</strong>
        </div>
        <div>
          Endstand:{' '}
          <strong style={{ color: colors.textPrimary }}>
            {match.homeScore} : {match.awayScore}
          </strong>
        </div>
      </div>
      <div style={controlsStyle}>
        <Button
          variant="secondary"
          size={isMobile ? "md" : "sm"}
          onClick={onEdit}
          style={{ flex: isMobile ? '1' : '0 1 auto', minHeight: isMobile ? '48px' : 'auto' }}
        >
          Ergebnis korrigieren
        </Button>
        <Button
          variant="secondary"
          size={isMobile ? "md" : "sm"}
          onClick={onResume}
          style={{ flex: isMobile ? '1' : '0 1 auto', minHeight: isMobile ? '48px' : 'auto' }}
        >
          Spiel wieder aufnehmen
        </Button>
        <Button
          variant="primary"
          size={isMobile ? "md" : "sm"}
          onClick={onNext}
          style={{ flex: isMobile ? '1' : '0 1 auto', minHeight: isMobile ? '48px' : 'auto' }}
        >
          Nächstes Spiel laden
        </Button>
      </div>
    </div>
  );
};
