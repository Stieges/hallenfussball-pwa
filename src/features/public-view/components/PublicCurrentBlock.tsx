/**
 * Kopfblock der Zuschauer-Seite (Paket Z2, @ZM-141): direkt unter dem Titel steht, was gerade läuft, sonst was als Nächstes
 * kommt, sonst was zuletzt beendet war – damit Mama Petra beim Öffnen per QR-Code ohne Scrollen das Geschehen sieht.
 *
 * Die Wahl trifft `publicCurrentOf` aus der gemeinsamen Ansicht. Gezeichnet wird mit den Bausteinen der Spielkarte:
 * Abzeichen (@OB-065/@OB-066), Mannschaften untereinander mit Tore je Zeile (@OB-064, `TeamScoreRows`), Restzeit beim Stand
 * (`MatchClock`, @OB-067). Die Test-Kennungen tragen das Präfix `kopf`/`public-current`, damit dasselbe Spiel im Spielplan darunter
 * eindeutig bleibt.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { GeneratedSchedule } from '../../../core/generators';
import type { MatchView, TournamentView, ViewLocale } from '../../../core/view';
import type { Match, Tournament } from '../../../types/tournament';
import { getGroupShortCode } from '../../../utils/displayNames';
import { TeamScoreRows } from '../../../components/schedule/MatchCard/TeamScoreRows';
import { MatchStatusBadge } from '../../../components/ui/molecules/MatchStatusBadge';
import { MatchClock } from '../../../components/ui/molecules/MatchClock';
import { buildSideContext, matchHeading, sideDisplay } from '../../../components/schedule/matchSides';
import { cardStatusOf, resultFigures } from '../../../components/schedule/matchResult';
import { useElapsedSeconds } from '../../../components/schedule/useTickingNow';
import { useSpectatorClocks } from '../../../components/schedule/useSpectatorClocks';
import { publicCurrentOf, type PublicCurrent } from '../publicCurrentOf';

export interface PublicCurrentBlockProps {
  view: TournamentView;
  schedule: GeneratedSchedule;
  tournament: Pick<Tournament, 'teams' | 'groups'>;
  /** Spiele mit den Ständen, die die Zielgruppe sehen darf (Uhr und Zeitstrafen) */
  currentMatches: readonly Match[];
  locale: ViewLocale;
}

const noop = (): void => undefined;

const blockStyle: CSSProperties = { display: 'grid', gap: cssVars.spacing.sm, marginBottom: cssVars.spacing.lg };
const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.bold,
  color: cssVars.colors.textSecondary,
};
const cardStyle = (live: boolean): CSSProperties => ({
  background: cssVars.colors.surface,
  border: `${live ? cssVars.borderWidth.medium : cssVars.borderWidth.thin} solid ${live ? cssVars.colors.borderActive : cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.lg,
  overflow: 'hidden',
  minWidth: 0,
});
const headStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: cssVars.spacing.md,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
  borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  background: cssVars.colors.surfaceDark,
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textSecondary,
};
const bodyStyle: CSSProperties = { display: 'flex', padding: cssVars.spacing.sm };
const clockStyle: CSSProperties = { padding: `0 ${cssVars.spacing.sm} ${cssVars.spacing.sm}` };

/**
 * Kästen in Teamfarbe (Weste bei Leibchen, @ZM-158, @ZM-161) – nur mit sichtbaren Ergebnissen (Kindermodus: keine). Ein laufendes Spiel
 * zeigt sie nur bei eingeschaltetem Live-Stand (sonst „laufendes Spiel ohne Stand“, Zone 1 „Beim Öffnen“, @ZM-116), das nächste Spiel
 * mit 0 : 0 (@ZM-195), das zuletzt beendete mit Ring beim Sieger und Pokal in der Finalrunde (@ZM-158, @OB-064).
 */
function kastenOf(mv: MatchView, view: TournamentView): MatchView['boxes'] | undefined {
  const { results, liveScore } = view.rules;
  return results && (!mv.isLive || liveScore) ? mv.boxes : undefined;
}

const HEADING_KEY = { live: 'current.live', next: 'current.next', last: 'current.last' } as const;

export function PublicCurrentBlock({ view, schedule, tournament, currentMatches, locale }: PublicCurrentBlockProps): ReactElement | null {
  const { t } = useTranslation('publicView');
  const { t: tTournament } = useTranslation('tournament');
  const clockOf = useSpectatorClocks(view, useElapsedSeconds(view, currentMatches, undefined), currentMatches);
  const current: PublicCurrent | null = publicCurrentOf(view);
  if (current === null) {
    return null;
  }
  const shown: readonly MatchView[] = current.kind === 'live' ? current.matches : [current.match];
  const sides = buildSideContext({ teams: tournament.teams, groups: tournament.groups, matches: schedule.allMatches, view, locale }, schedule.allMatches);
  const showGroup = (tournament.groups?.length ?? 0) > 1;

  const card = (mv: MatchView): ReactElement | null => {
    const scheduled = schedule.allMatches.find((m) => m.id === mv.id);
    if (scheduled === undefined) {
      return null;
    }
    const heading = matchHeading(scheduled, sides);
    const place = heading ?? (showGroup && scheduled.group ? tTournament('matchCard.groupPrefix', { group: getGroupShortCode(scheduled.group, tournament) }) : undefined);
    const meta = [
      mv.matchNumber === undefined ? undefined : t('current.match', { number: mv.matchNumber }),
      tTournament('matchCard.field', { field: mv.field }),
      place,
    ].filter((part): part is string => part !== undefined).join(' · ');
    const status = cardStatusOf(mv);
    const clock = status === 'running' ? clockOf(mv.id) : null;
    return (
      <article key={mv.id} style={cardStyle(mv.isLive)} data-testid={`public-current-card-${mv.id}`} data-current-kind={current.kind}>
        <div style={headStyle}>
          <span data-testid={`public-current-meta-${mv.id}`}>{meta}</span>
          <MatchStatusBadge model={mv.badge} size="card" testId={`public-current-badge-${mv.id}`} />
        </div>
        <div style={bodyStyle}>
          <TeamScoreRows
            matchId={`kopf-${mv.id}`}
            homeTeam={sideDisplay(scheduled, 'A', sides)}
            awayTeam={sideDisplay(scheduled, 'B', sides)}
            result={resultFigures(mv.score, status)}
            status={status}
            onScoreClick={noop}
            disabled
            zeitstrafen={clock?.zeitstrafen}
            kasten={kastenOf(mv, view)}
            ende={current.kind === 'last' ? { cup: mv.phase === 'final' } : undefined}
          />
        </div>
        {clock !== null && <div style={clockStyle}><MatchClock clock={clock} size="card" testId={`public-current-clock-${mv.id}`} /></div>}
      </article>
    );
  };

  return (
    <section style={blockStyle} data-testid="public-current" data-current-kind={current.kind} aria-labelledby="public-current-heading">
      <h2 id="public-current-heading" style={headingStyle}>{t(HEADING_KEY[current.kind])}</h2>
      {shown.map(card)}
    </section>
  );
}
