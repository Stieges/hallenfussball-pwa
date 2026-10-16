/**
 * Die gemeinsame Turnier-Ansicht (A-36b, Teilplan A-36 § 2.2/§ 2.4): EIN Baustein für Zuschauer-Seite, Monitor,
 * PDF und Verwaltung. Status, Seitentexte, Uhrzeit, Endstand und Sichtbarkeit kommen nur von hier.
 */
import type { Match } from '../../types/tournament';
import { matchFinalScore } from './finalScore';
import { matchLabelText, type SlotLabelContext } from './originText';
import { placementView } from './placement';
import { sideView, type SideContext } from './sides';
import { isLive, isUpcoming, viewStatus } from './status';
import { clockKey, kickoffLocal, TOURNAMENT_TIME_ZONE, toTournamentLocal } from './time';
import { viewRules } from './visibility';
import type {
  CurrentView,
  LocalClock,
  MatchView,
  TournamentView,
  TournamentViewInput,
  ViewMatchStatus,
  ViewOptions,
  ViewRules,
} from './types';

function byKickoff(a: MatchView, b: MatchView): number {
  const key = clockKey(a.kickoff).localeCompare(clockKey(b.kickoff));
  return key !== 0 ? key : (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
}

/** Läuft / als Nächstes / zuletzt beendet (@ZM-141); ausgefallen und unterbrochen nie „nächstes Spiel“ (@ZM-041/104). */
export function currentOf(matches: readonly MatchView[]): CurrentView {
  const sorted = [...matches].sort(byKickoff);
  const finished = sorted.filter((m) => m.status === 'finished' || m.status === 'awarded');
  const next = sorted.find((m) => m.isUpcoming);
  const lastFinished = finished[finished.length - 1];
  return {
    live: sorted.filter((m) => m.isLive),
    ...(next === undefined ? {} : { next }),
    ...(lastFinished === undefined ? {} : { lastFinished }),
  };
}

/** Status für die Zielgruppe: ohne Kennzeichen „gewertet“ erscheint ein gewertetes Spiel als beendet (@ZM-104). */
function audienceStatus(status: ViewMatchStatus, rules: ViewRules): ViewMatchStatus {
  return status === 'awarded' && !rules.awardedMark ? 'finished' : status;
}

function scoreFor(match: Match, status: ViewMatchStatus, rules: ViewRules): MatchView['score'] {
  const done = status === 'finished' || status === 'awarded';
  const live = isLive(status);
  if (!(done && rules.results) && !(live && rules.liveScore)) {
    return undefined;
  }
  // Der fachliche Status (Engine vor Cache) bestimmt, ob es ein End- oder ein Zwischenstand ist.
  return matchFinalScore({ ...match, matchStatus: done ? 'finished' : 'running' }) ?? undefined;
}

function correctedAtFor(match: Match, input: TournamentViewInput, options: ViewOptions, rules: ViewRules): LocalClock | undefined {
  if (!rules.correctedMark) {
    return undefined;
  }
  if (options.audience !== 'organizer') {
    return input.correctedAtPublic?.(match.id);
  }
  const last = match.correctionHistory?.[match.correctionHistory.length - 1];
  const instant = last === undefined ? undefined : new Date(last.timestamp);
  return instant === undefined || Number.isNaN(instant.getTime()) ? undefined : toTournamentLocal(instant, TOURNAMENT_TIME_ZONE);
}

function matchView(match: Match, input: TournamentViewInput, options: ViewOptions, rules: ViewRules, sides: SideContext): MatchView {
  const blank = sides.edition === 'blank';
  // Vorlage: keine Ergebnisse, keine Zustände – jedes Spiel hat seine Felder zum Eintragen (@DR-005, @DR-019).
  const status = blank ? 'scheduled' : audienceStatus(viewStatus(match, input.engineStatus?.(match.id)), rules);
  const kickoff = kickoffLocal(input.date, match.scheduledTime);
  const score = blank ? undefined : scoreFor(match, status, rules);
  const correctedAt = blank ? undefined : correctedAtFor(match, input, options, rules);
  const final = match.isFinal === true;
  return {
    id: match.id,
    ...(match.matchNumber === undefined ? {} : { matchNumber: match.matchNumber }),
    field: match.field,
    ...(kickoff === undefined ? {} : { kickoff }),
    kickoffTentative: final && status === 'scheduled',
    phase: final ? 'final' : 'groupStage',
    ...(match.group === undefined ? {} : { group: match.group }),
    ...(match.label === undefined || match.label === '' ? {} : { labelText: matchLabelText(match.label, options.locale) }),
    status,
    isLive: isLive(status),
    isUpcoming: isUpcoming(status),
    ...(score === undefined ? {} : { score }),
    ...(correctedAt === undefined ? {} : { correctedAt }),
    home: sideView(match, 'A', sides),
    away: sideView(match, 'B', sides),
  };
}

export function buildTournamentView(input: TournamentViewInput, options: ViewOptions): TournamentView {
  const rules = viewRules(input, options.audience, options.medium, options.viewerPdf);
  const edition = options.edition ?? 'plan';
  const labels: SlotLabelContext = {
    teams: input.teams,
    matches: input.matches,
    ...(input.groups === undefined ? {} : { groups: input.groups }),
    locale: options.locale,
  };
  const sides: SideContext = { labels, locale: options.locale, rules, edition };
  const matches = input.matches.map((match) => matchView(match, input, options, rules, sides));
  return {
    rules,
    matches,
    byId: new Map(matches.map((m) => [m.id, m])),
    current: currentOf(matches),
    currentFor: (field: number) => currentOf(matches.filter((m) => m.field === field)),
    placement: placementView(input, rules, edition, matches),
  };
}
