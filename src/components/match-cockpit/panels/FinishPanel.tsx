/**
 * FinishPanel - Post-match actions (edit result, resume, load next)
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
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
    marginTop: cssVars.spacing.md,
    padding: isMobile ? cssVars.spacing.lg : cssVars.spacing.md,
    borderRadius: cssVars.borderRadius.lg,
    border: `1px dashed ${cssVars.colors.border}`,
    background: cssVars.colors.monitorSectionBgStrong,
    fontSize: isMobile ? cssVars.fontSizes.md : cssVars.fontSizes.sm,
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? cssVars.spacing.sm : '6px',
  };

  const titleStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    fontSize: isMobile ? cssVars.fontSizes.lg : cssVars.fontSizes.md,
  };

  const summaryStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.md : cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  };

  const controlsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    flexWrap: 'wrap',
    gap: cssVars.spacing.sm,
    marginTop: cssVars.spacing.sm,
  };

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>Spiel beendet – Ergebnis prüfen</div>
      <div style={summaryStyle}>
        <div>
          <strong style={{ color: cssVars.colors.textPrimary }}>{match.homeTeam.name}</strong> vs.{' '}
          <strong style={{ color: cssVars.colors.textPrimary }}>{match.awayTeam.name}</strong>
        </div>
        <div>
          Endstand:{' '}
          <strong style={{ color: cssVars.colors.textPrimary }}>
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
