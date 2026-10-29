/**
 * Endstand auf der Zuschauer-Seite (R3-6; @LZ-074, @LZ-075, @ET-044, @ET-045, @ZM-011, @ZM-012, @ZM-102): der beim Abschluss gespeicherte
 * Endstand oben, Spielplan darunter. Dieselbe Darstellung wie in der App (`FinalStandingsView`), Platz 1 in Gold. Nie neu gerechnet
 * und nie vor dem Abschluss: ohne `final` vom Server steht hier nichts (auch kein vorläufiger Stand). Torschützen nur, wenn die
 * Antwort sie trägt (Schalter). Kindermodus (E7): statt des Endstands „Turnier beendet – danke fürs Mitspielen“, abhängig vom öffentlichen Stand (abgeschlossen ∧ Kindermodus), nicht vom Server-Endstand.
 * Tabellen für Zuschauer aus: keine Herkunft, keine Zahlen (@ZM-102).
 */
import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicFinalStandings } from '../../../core/repositories/publicFinalStandings';
import type { TournamentView } from '../../../core/view';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import type { Tournament } from '../../../types/tournament';
import { showsFinalStandings, showsKidsEnded } from '../showsFinalStandings';
import { FinalStandingsView } from '../../tournament-finish/components/FinalStandingsView';

export interface PublicFinalStandingsProps {
  tournament: Tournament;
  view: TournamentView;
  finalStandings: PublicFinalStandings;
}

const kidsStyle: CSSProperties = {
  margin: 0, padding: cssVars.spacing.lg, textAlign: 'center', fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.bold,
  color: cssVars.colors.textPrimary, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.lg,
};
const titleStyle: CSSProperties = {
  margin: `${cssVars.spacing.lg} 0 ${cssVars.spacing.sm}`, fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary,
};

/** Abzeichen „Turnier abgeschlossen“ im Kopf der Seite (Grau wie in der App, mit Schloss; Schrift in Textfarbe – das Grau `statusFinished` erreicht auf der Tönung nur 4,2:1). */
export const PublicEndedBadge: React.FC = () => {
  const { t } = useTranslation('publicView');
  return (
    <span
      data-testid="tournament-ended"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs, padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
        borderRadius: cssVars.borderRadius.full, background: cssVars.colors.statusFinishedBg, color: cssVars.colors.textPrimary,
        border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.statusFinished}`, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold,
      }}
    >
      <Icons.Lock size={iconSizeValues.sm} />
      {t('liveView.ended')}
    </span>
  );
};

export const PublicFinalStandingsBlock: React.FC<PublicFinalStandingsProps> = ({ tournament, view, finalStandings }) => {
  const { t } = useTranslation('publicView');
  if (showsKidsEnded(tournament, view)) {
    return <p style={kidsStyle} data-testid="final-standings-kids">{t('liveView.endedKids')}</p>;
  }
  if (finalStandings.status !== 'final' || !showsFinalStandings(view, finalStandings)) {
    return null;
  }
  return (
    <>
      <FinalStandingsView
        tournament={tournament}
        ranking={finalStandings.snapshot.ranking}
        scorers={finalStandings.scorersPublic ? finalStandings.snapshot.scorers : undefined}
        provisional={false}
        finishedAt={finalStandings.finishedAt}
        variant="public"
        hideTableDetails={!view.rules.tables}
      />
      <h2 style={titleStyle}>{t('liveView.scheduleTitle')}</h2>
    </>
  );
};
