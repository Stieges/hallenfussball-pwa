/**
 * MatchForfeitAction (B-12, @W2A-022, @W2A-026, @FU-119): die eine Taste „Nicht angetreten“ (Spiel geplant) bzw.
 * „Wertung zurücknehmen“ (Spiel als Nichtantritt gewertet) an einer Spielkarte des Spielplans der Turnierleitung.
 * Bei jedem anderen Stand (läuft, beendet, abgesetzt) erscheint nichts: ein angepfiffenes Spiel lässt sich nicht als
 * Nichtantritt werten. Ohne `forfeit` (Helfer, Zuschauer) erscheint nichts (@SL-118).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { Button } from '../ui/Button';
import type { ViewMatchStatus } from '../../core/view/types';

export interface MatchForfeitActions {
  mark: (matchId: string) => void;
  revoke: (matchId: string) => void;
}

export interface MatchForfeitActionProps {
  matchId: string;
  /** Fachlicher Status der Ansicht: `scheduled` = geplant, `awarded` = gewertet */
  viewStatus: ViewMatchStatus | undefined;
  forfeit: MatchForfeitActions | undefined;
}

const wrapStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', paddingTop: cssVars.spacing.sm };

export function MatchForfeitAction({ matchId, viewStatus, forfeit }: MatchForfeitActionProps) {
  const { t } = useTranslation('tournament');
  if (!forfeit || (viewStatus !== 'scheduled' && viewStatus !== 'awarded')) {
    return null;
  }
  const revoke = viewStatus === 'awarded';
  return (
    <div style={wrapStyle}>
      <Button
        variant="secondary"
        size="lg"
        style={{ minHeight: cssVars.touchTargets.minimum }}
        onClick={() => (revoke ? forfeit.revoke(matchId) : forfeit.mark(matchId))}
        data-testid={revoke ? `forfeit-revoke-${matchId}` : `forfeit-mark-${matchId}`}
      >
        {revoke ? t('schedule.forfeit.revoke') : t('schedule.forfeit.mark')}
      </Button>
    </div>
  );
}
