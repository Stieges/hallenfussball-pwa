/**
 * Verwaltung, Zustand C „abgeschlossen“ (@LZ-009, @LZ-036, @LZ-039, @LZ-040; Mockup Runde 2, Daniel 25.10.): Hinweis mit Zeitpunkt
 * („Turnier abgeschlossen am Sa., 28.11.2026, 13:10 Uhr“) und dem Satz „Wieder öffnen geht nur über den Betreiber.“ (kein Knopf,
 * Notweg @LZ-091), der gespeicherte Endstand (Plätze 1 bis 3), Haupttaste „Zuschauer-Ansicht öffnen“ und die Liste „Nach dem
 * Ende eingetroffen“. Hängt NICHT an `useCan('manageLifecycle')` (nach dem Abschluss falsch, Review #394 H-1): wer diesen Bereich
 * zeigt, hat die Rolle schon geprüft (`openAfterClose`, Ruling #394 H-1).
 */
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../../../types/tournament';
import { cssVars, dialogWidths, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { generateLiveUrl } from '../../../utils/shareUtils';
import type { LateEntriesState } from '../hooks/useLateEntries';
import type { StoredStandingsState } from '../hooks/useStoredFinalStandings';
import { TeamName } from './HyphenSafe';
import { formatClock, formatDay } from '../model/finishFormat';
import { shootoutNote } from '../model/finishSummary';
import { LateEntriesCard } from './LateEntriesCard';
import { card, heading, placeList, placeNumber, placeRow, small, strong, text } from './finishStyles';

export type FinishedStateTournament = Pick<Tournament, 'id' | 'teams' | 'matches' | 'groups' | 'standingDecisions' | 'pointSystem' | 'placementLogic' | 'placementsToPlayOut' | 'forfeitScore' | 'finishedAt' | 'isPublic' | 'shareCode'>;

export interface FinishedStateViewProps {
  tournament: FinishedStateTournament;
  /** Gespeicherter Endstand (gelesen vom Aufrufer). */
  stored: StoredStandingsState;
  /** „Nach dem Ende eingetroffen“; `null` = Liste nicht zeigen (kein Recht der Turnierleitung). */
  late: LateEntriesState | null;
  self?: { id: string; name: string | null };
}

/** Nur Darstellung von Zustand C; Lesen und Rechte stecken in `FinishedStateSection`. */
export function FinishedStateView({ tournament, stored, late, self }: FinishedStateViewProps) {
  const { t, i18n } = useTranslation('tournament');
  const day = formatDay(tournament.finishedAt, i18n.language);
  const clock = formatClock(tournament.finishedAt, i18n.language);
  const ranking = stored.status === 'ok' ? stored.snapshot.ranking.slice(0, 3) : [];
  const note = stored.status === 'ok' ? shootoutNote(tournament, stored.snapshot.ranking) : null;
  const publicOn = tournament.isPublic !== false && tournament.shareCode !== undefined && tournament.shareCode !== '';
  const openPublic = (): void => {
    if (tournament.shareCode) {
      window.open(generateLiveUrl(tournament.shareCode), '_blank', 'noopener,noreferrer');
    }
  };
  return (
    <div style={{ display: 'grid', gap: cssVars.spacing.md }} data-testid="finished-state">
      <InlineNotice tone="info" icon={<Icons.Lock size={iconSizeValues.sm} />} live={false} data-testid="tournament-ended">
        <span style={strong}>{day !== null && clock !== null ? t('finish.closed.title', { date: day, time: clock }) : t('finish.closed.titleNoDate')}</span>
        <span style={text}>{t('finish.closed.text')}</span>
        <span style={text}>{t('finish.closed.reopen')}</span>
      </InlineNotice>
      <div style={{ display: 'grid', gap: cssVars.spacing.md, alignItems: 'start', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${dialogWidths.sm}), 1fr))` }} data-testid="finished-layout">
        <section style={card} aria-labelledby="finish-standings-title">
          <h3 id="finish-standings-title" style={heading}>{t('finish.closed.standings')}</h3>
          {stored.status === 'ok' && (
            <ol style={placeList} data-testid="finished-standings">
              {ranking.map((row, index) => (
                <li key={row.teamId} style={{ ...placeRow, ...(index === ranking.length - 1 ? { borderBottom: 'none' } : {}) }}>
                  <span style={placeNumber}>{row.place}</span>
                  <span style={strong}><TeamName name={row.teamName} /></span>
                  <span style={small}>{index === 0 && note !== null ? t('finish.closed.shootout', { winner: note.winner, loser: note.loser }) : ''}</span>
                </li>
              ))}
            </ol>
          )}
          {(stored.status === 'failed' || stored.status === 'none') && <p style={small} role="status" data-testid="finished-standings-unavailable">{t('finish.closed.standingsUnavailable')}</p>}
          {publicOn ? (
            <>
              <div><Button variant="primary" size="lg" icon={<Icons.ExternalLink size={iconSizeValues.sm} />} onClick={openPublic} data-testid="public-view-open" data-primary style={{ minHeight: cssVars.touchTargets.primary }}>{t('finish.closed.openPublic')}</Button></div>
              <p style={small}>{t('finish.closed.openPublicHint')}</p>
            </>
          ) : <p style={small} data-testid="public-view-off">{t('finish.closed.notPublic')}</p>}
        </section>
        {late !== null && <LateEntriesCard tournament={tournament} late={late} self={self} />}
      </div>
    </div>
  );
}
