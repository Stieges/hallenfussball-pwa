/**
 * Endstand-Block der App (R3-5; @ET-041, @ET-042, @ET-044, @TM-058): Darstellung wie der Endstand-Block der Zuschauer-Seite
 * (Mockup Runde 2 `zs-klar-390`, `zs-ps-390`) – Sieger, Plätze mit Herkunft, Torschützen – plus Kennzeichen „vorläufig“ vor dem
 * Abschluss (B3). Nur Darstellung: ob der Stand gespeichert oder vorläufig ist, entscheidet `FinalStandingsPanel`.
 */
import { useTranslation } from 'react-i18next';
import type { FinalStandingRow, ScorerRow } from '../../../core/standings/finalStandings';
import type { Tournament } from '../../../types/tournament';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { formatClock, formatDay } from '../model/finishFormat';
import { placeOriginLabel } from '../model/placeOrigin';
import { shootoutNote, type ShootoutTournament } from '../model/finishSummary';
import { ScorerList } from './ScorerList';
import { TeamName } from './HyphenSafe';
import { badge, placeNumber, standingsRow, standingsRowFirst, winnerCard, winnerName } from './finalStandingsStyles';
import { heading, placeList, small, strong, tightStack } from './finishStyles';

export type FinalStandingsViewTournament = Pick<Tournament, 'groups'> & ShootoutTournament;

export interface FinalStandingsViewProps {
  tournament: FinalStandingsViewTournament;
  ranking: readonly FinalStandingRow[];
  scorers: readonly ScorerRow[];
  /** `true` = der Stand steht noch nicht fest („vorläufig“). */
  provisional: boolean;
  /** Zeitpunkt des Abschlusses (nur gespeichert). */
  finishedAt?: string;
  /** Torschützen evtl. unvollständig (vorläufig, Ereignisse der Spielsteuerung nicht lesbar): Hinweis über der Liste. */
  scorersIncomplete?: boolean;
}

export function FinalStandingsView({ tournament, ranking, scorers, provisional, finishedAt, scorersIncomplete = false }: FinalStandingsViewProps) {
  const { t, i18n } = useTranslation('tournament');
  const note = provisional ? null : shootoutNote(tournament, ranking);
  const winners = ranking.filter((row) => row.place === 1);
  const winner = !provisional && winners.length === 1 ? winners[0] : undefined;
  const day = formatDay(finishedAt, i18n.language);
  const clock = formatClock(finishedAt, i18n.language);
  const originOf = (row: FinalStandingRow): string =>
    row.place === 1 && note !== null ? t('finalStandings.originShootout') : placeOriginLabel(row.origin, t, tournament);
  return (
    <div style={{ display: 'grid', gap: cssVars.spacing.md }} data-testid="final-standings" data-state={provisional ? 'provisional' : 'stored'}>
      {provisional && (
        <InlineNotice tone="info" icon={<Icons.Info size={iconSizeValues.sm} />} live={false} data-testid="final-standings-provisional">
          <span style={strong}>{t('finalStandings.provisionalTitle')}</span>
          <span style={small}>{t('finalStandings.provisionalText')}</span>
        </InlineNotice>
      )}
      {winner !== undefined && (
        <div style={winnerCard} data-testid="final-standings-winner">
          <Icons.Trophy size={iconSizeValues.xl} />
          <div style={tightStack}>
            <span style={small}>{t('finalStandings.winner')}</span>
            <p style={winnerName}><TeamName name={winner.teamName} /></p>
            {note !== null && <span style={small}>{t('finalStandings.winnerShootout', { winner: note.winner, loser: note.loser, other: note.otherName })}</span>}
          </div>
        </div>
      )}
      <section style={tightStack} aria-labelledby="final-standings-title">
        <h3 id="final-standings-title" style={{ ...heading, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: cssVars.spacing.sm }}>
          {t('finalStandings.title')}
          {provisional && <span style={badge} data-testid="final-standings-badge">{t('finalStandings.provisionalBadge')}</span>}
        </h3>
        <ol style={placeList} data-testid="final-standings-list">
          {ranking.map((row, index) => (
            <li key={row.teamId} style={{ ...standingsRow, ...(!provisional && row.place === 1 ? standingsRowFirst : {}), ...(index === ranking.length - 1 ? { borderBottom: 'none' } : {}) }} data-testid="final-standing-row" data-place={row.place}>
              <span style={placeNumber}>{row.place}</span>
              <span style={{ display: 'grid', minWidth: 0 }}>
                <span style={strong}><TeamName name={row.teamName} /></span>
                <span style={small} data-testid="final-standing-origin">{originOf(row)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <ScorerList scorers={scorers} provisional={provisional} incomplete={scorersIncomplete} />
      {!provisional && (
        <p style={{ ...small, textAlign: 'center' }} data-testid="final-standings-saved">
          {day !== null && clock !== null ? t('finalStandings.savedAt', { date: day, time: clock }) : t('finalStandings.savedNoDate')}
        </p>
      )}
    </div>
  );
}
