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
import { formatClock, formatDay, formatSigned } from '../model/finishFormat';
import { placeOriginLabel } from '../model/placeOrigin';
import { shootoutNote, type ShootoutTournament } from '../model/finishSummary';
import { ScorerList } from './ScorerList';
import { TeamName } from './HyphenSafe';
import { badge, goldRowFirst, goldWinnerCard, goldTrophy, placeNumber, pointsCell, standingsHeader, standingsRow, standingsRowFirst, valueCell, winnerCard, winnerName } from './finalStandingsStyles';
import { heading, placeList, small, strong, tightStack } from './finishStyles';

export type FinalStandingsViewTournament = Pick<Tournament, 'groups'> & ShootoutTournament;

export interface FinalStandingsViewProps {
  tournament: FinalStandingsViewTournament;
  ranking: readonly FinalStandingRow[];
  /** Ohne Angabe (`undefined`) steht keine Torschützenliste da: Zuschauer ohne Schalter (@ZM-012). */
  scorers?: readonly ScorerRow[];
  /** `true` = der Stand steht noch nicht fest („vorläufig“). */
  provisional: boolean;
  /** Zeitpunkt des Abschlusses (nur gespeichert). */
  finishedAt?: string;
  /** Torschützen evtl. unvollständig (vorläufig, Ereignisse der Spielsteuerung nicht lesbar): Hinweis über der Liste. */
  scorersIncomplete?: boolean;
  /** `public` = Zuschauer-Seite (R3-6, Mockup `zs-*`): Platz 1 in Gold (`medalGold`), keine Herkunftszeile je Platz; sonst die App. */
  variant?: 'app' | 'public';
  /** Herkunft der Plätze, Spalten Sp/Diff/Pkt und Strafstoß-Satz weglassen: Tabellen für Zuschauer aus (@ZM-102). */
  hideTableDetails?: boolean;
}

export function FinalStandingsView({ tournament, ranking, scorers, provisional, finishedAt, scorersIncomplete = false, variant = 'app', hideTableDetails = false }: FinalStandingsViewProps) {
  const { t, i18n } = useTranslation('tournament');
  const gold = variant === 'public';
  const note = provisional || hideTableDetails ? null : shootoutNote(tournament, ranking);
  const winners = ranking.filter((row) => row.place === 1);
  const winner = !provisional && winners.length === 1 ? winners[0] : undefined;
  const day = formatDay(finishedAt, i18n.language);
  const clock = formatClock(finishedAt, i18n.language);
  const originOf = (row: FinalStandingRow): string | null =>
    hideTableDetails || gold ? null : row.place === 1 && note !== null ? t('finalStandings.originShootout') : placeOriginLabel(row.origin, t, tournament);
  // Spalten Sp, Diff, Pkt nur, wenn der gespeicherte Stand Tabellenwerte trägt; gezeigt wird, was gespeichert ist, nie neu gerechnet (@ET-045)
  const withValues = !hideTableDetails && ranking.some((row) => row.tableValues !== undefined);
  return (
    <div style={{ display: 'grid', gap: cssVars.spacing.md }} data-testid="final-standings" data-state={provisional ? 'provisional' : 'stored'}>
      {provisional && (
        <InlineNotice tone="info" icon={<Icons.Info size={iconSizeValues.sm} />} live={false} data-testid="final-standings-provisional">
          <span style={strong}>{t('finalStandings.provisionalTitle')}</span>
          <span style={small}>{t('finalStandings.provisionalText')}</span>
        </InlineNotice>
      )}
      {winner !== undefined && (
        <div style={gold ? goldWinnerCard : winnerCard} data-testid="final-standings-winner">
          <span style={gold ? goldTrophy : undefined}><Icons.Trophy size={iconSizeValues.xl} /></span>
          <div style={tightStack}>
            <span style={small}>{t('finalStandings.winner')}</span>
            <p style={winnerName}><TeamName name={winner.teamName} /></p>
            {note !== null && <span style={small}>{t('finalStandings.winnerShootout', { winner: note.winner, loser: note.loser, other: note.otherName })}</span>}
            {note === null && gold && !hideTableDetails && winner.tableValues !== undefined && (
              <span style={small} data-testid="final-standings-winner-values">
                {t('finalStandings.winnerValues', { count: winner.tableValues.points, diff: formatSigned(winner.tableValues.goalDiff) })}
              </span>
            )}
          </div>
        </div>
      )}
      <section style={tightStack} aria-labelledby="final-standings-title">
        <h3 id="final-standings-title" style={{ ...heading, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: cssVars.spacing.sm }}>
          {t('finalStandings.title')}
          {provisional && <span style={badge} data-testid="final-standings-badge">{t('finalStandings.provisionalBadge')}</span>}
        </h3>
        <div style={placeList}>
          {withValues && (
            <div style={standingsHeader(true)} data-testid="final-standings-header" aria-hidden="true">
              <span>{t('finalStandings.columns.place')}</span>
              <span>{t('finalStandings.columns.team')}</span>
              <span style={valueCell} title={t('finalStandings.columns.gamesLong')}>{t('finalStandings.columns.games')}</span>
              <span style={valueCell} title={t('finalStandings.columns.goalDiffLong')}>{t('finalStandings.columns.goalDiff')}</span>
              <span style={valueCell} title={t('finalStandings.columns.pointsLong')}>{t('finalStandings.columns.points')}</span>
            </div>
          )}
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="final-standings-list">
            {ranking.map((row, index) => (
              <li key={row.teamId} style={{ ...standingsRow(withValues), ...(!provisional && row.place === 1 ? (gold ? goldRowFirst : standingsRowFirst) : {}), ...(index === ranking.length - 1 ? { borderBottom: 'none' } : {}) }} data-testid="final-standing-row" data-place={row.place}>
                <span style={placeNumber}>{row.place}</span>
                <span style={{ display: 'grid', minWidth: 0 }}>
                  <span style={strong}><TeamName name={row.teamName} /></span>
                  {originOf(row) !== null && <span style={small} data-testid="final-standing-origin">{originOf(row)}</span>}
                </span>
                {withValues && (
                  <>
                    <span style={valueCell} data-testid="final-standing-games" aria-label={row.tableValues === undefined ? undefined : t('finalStandings.valueLabel.games', { value: row.tableValues.games })}>{row.tableValues?.games}</span>
                    <span style={valueCell} data-testid="final-standing-diff" aria-label={row.tableValues === undefined ? undefined : t('finalStandings.valueLabel.goalDiff', { value: formatSigned(row.tableValues.goalDiff) })}>{row.tableValues === undefined ? null : formatSigned(row.tableValues.goalDiff)}</span>
                    <span style={pointsCell} data-testid="final-standing-points" aria-label={row.tableValues === undefined ? undefined : t('finalStandings.valueLabel.points', { value: row.tableValues.points })}>{row.tableValues?.points}</span>
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>
      {scorers !== undefined && <ScorerList scorers={scorers} provisional={provisional} incomplete={scorersIncomplete} />}
      {!provisional && (
        <p style={{ ...small, textAlign: 'center' }} data-testid="final-standings-saved">
          {day !== null && clock !== null ? t('finalStandings.savedAt', { date: day, time: clock }) : t('finalStandings.savedNoDate')}
        </p>
      )}
    </div>
  );
}
