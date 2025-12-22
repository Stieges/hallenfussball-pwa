/**
 * FinishPanel - Post-match actions (edit result, resume, load next)
 */

import { CSSProperties } from 'react';
import { theme } from '../../../styles/theme';
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
    marginTop: theme.spacing.md,
    padding: isMobile ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    border: `1px dashed ${theme.colors.border}`,
    background: 'rgba(15, 23, 42, 0.95)',
    fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.sm,
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? theme.spacing.sm : '6px',
  };

  const titleStyle: CSSProperties = {
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
    fontSize: isMobile ? theme.fontSizes.lg : theme.fontSizes.md,
  };

  const summaryStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.sm,
    color: theme.colors.text.secondary,
  };

  const controlsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  };

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>Spiel beendet – Ergebnis prüfen</div>
      <div style={summaryStyle}>
        <div>
          <strong style={{ color: theme.colors.text.primary }}>{match.homeTeam.name}</strong> vs.{' '}
          <strong style={{ color: theme.colors.text.primary }}>{match.awayTeam.name}</strong>
        </div>
        <div>
          Endstand:{' '}
          <strong style={{ color: theme.colors.text.primary }}>
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
