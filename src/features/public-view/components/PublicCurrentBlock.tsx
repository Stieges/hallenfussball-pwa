/**
 * Kopfblock der Zuschauer-Seite (Paket Z2, @ZM-141): direkt unter dem Titel steht, was gerade läuft, sonst was als Nächstes
 * kommt, sonst was zuletzt beendet war – damit Mama Petra beim Öffnen per QR-Code ohne Scrollen das Geschehen sieht.
 *
 * Die Wahl trifft `currentBlockOf` aus der gemeinsamen Ansicht, gezeichnet wird mit `CurrentMatchCard` (dieselbe Karte wie im Spielplan der
 * Turnierleitung, @ZP-109): Abzeichen (@OB-065/@OB-066), Mannschaften mit Tore je Zeile (@OB-064), Restzeit beim Stand (`MatchClock`, @OB-067). Die Test-Kennungen tragen das Präfix `kopf`/`public-current`, damit dasselbe Spiel im Spielplan darunter
 * eindeutig bleibt.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { GeneratedSchedule } from '../../../core/generators';
import type { MatchView, TournamentView, ViewLocale } from '../../../core/view';
import type { Match, Tournament } from '../../../types/tournament';
import { getGroupShortCode } from '../../../utils/displayNames';
import { CurrentMatchCard } from '../../../components/schedule/CurrentMatchCard';
import { MatchStatusBadge } from '../../../components/ui/molecules/MatchStatusBadge';
import { MatchClock } from '../../../components/ui/molecules/MatchClock';
import { buildSideContext, matchHeading } from '../../../components/schedule/matchSides';
import { cardStatusOf } from '../../../components/schedule/matchResult';
import { useElapsedSeconds } from '../../../components/schedule/useTickingNow';
import { useSpectatorClocks } from '../../../components/schedule/useSpectatorClocks';
import { kastenOf } from '../../../components/schedule/currentBlockOf';
import { publicCurrentOf, type PublicCurrent } from '../publicCurrentOf';

export interface PublicCurrentBlockProps {
  view: TournamentView;
  schedule: GeneratedSchedule;
  tournament: Pick<Tournament, 'teams' | 'groups'>;
  /** Spiele mit den Ständen, die die Zielgruppe sehen darf (Uhr und Zeitstrafen) */
  currentMatches: readonly Match[];
  locale: ViewLocale;
}

const blockStyle: CSSProperties = { display: 'grid', gap: cssVars.spacing.sm, marginBottom: cssVars.spacing.lg };
const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.bold,
  color: cssVars.colors.textSecondary,
};
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
      <CurrentMatchCard
        key={mv.id}
        match={mv}
        scheduled={scheduled}
        sides={sides}
        clock={clock}
        kasten={kastenOf(mv, view)}
        ende={current.kind === 'last' ? { cup: mv.phase === 'final' } : undefined}
        head={<span data-testid={`public-current-meta-${mv.id}`}>{meta}</span>}
        headRight={<MatchStatusBadge model={mv.badge} size="card" testId={`public-current-badge-${mv.id}`} />}
        headVariant="strip"
        frame="active"
        showPlannedZero
        belowScore={clock !== null ? <MatchClock clock={clock} size="card" testId={`public-current-clock-${mv.id}`} /> : undefined}
        testIdPrefix="public-current"
        kind={current.kind}
      />
    );
  };

  return (
    <section style={blockStyle} data-testid="public-current" data-current-kind={current.kind} aria-labelledby="public-current-heading">
      <h2 id="public-current-heading" style={headingStyle}>{t(HEADING_KEY[current.kind])}</h2>
      {shown.map(card)}
    </section>
  );
}
