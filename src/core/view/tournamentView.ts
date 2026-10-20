/**
 * Die gemeinsame Turnier-Ansicht (A-36b, Teilplan A-36 § 2.2/§ 2.4): EIN Baustein für Zuschauer-Seite, Monitor,
 * PDF und Verwaltung. Status, Seitentexte, Uhrzeit, Endstand und Sichtbarkeit kommen nur von hier.
 */
import type { Match } from '../../types/tournament';
import { DEFAULT_CLOCK_MODE } from '../match/clockDisplay';
import { serverRules } from '../match/client/serverRules';
import { normalizeKitColor, wornColors, type KitSide } from '../models/kit';
import { slotTeamId } from '../models/matchSlot';
import { resolveBoxColors } from '../models/scoreBoxColors';
import { parseSpectatorDisplay, type SpectatorDisplaySettings } from '../models/spectatorDisplay';
import { matchBadgeModel, type MatchBadgeEngineDetail } from './badge';
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
  SpectatorClockRules,
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

/**
 * Feinstatus nur, wo er stimmt (A2): Monitor und Zuschauer liefern nur `engineDetail` aus `live_state`. Ein liegengebliebenes
 * `liveState` überstimmt dort nie „Ende“ oder „ausgefallen“ – es gilt nur bei Cache-Status running/paused. Die Verwaltung
 * liefert zusätzlich `engineStatus` (Engine hat Vorrang, M4) und bleibt unverändert.
 */
function usableDetail(match: Match, input: TournamentViewInput): MatchBadgeEngineDetail | undefined {
  const detail = input.engineDetail?.(match.id);
  if (detail === undefined || input.engineStatus?.(match.id) !== undefined) {
    return detail;
  }
  return match.matchStatus === 'running' || (match.matchStatus as string | undefined) === 'paused' ? detail : undefined;
}

/** Abschnitte und Längen wie beim Anpfiff (`serverRules`, gleiche Eingabe wie die Engine), für die Restzeit ohne Feinstatus. */
function clockRulesOf(match: Match, input: TournamentViewInput): SpectatorClockRules {
  const rules = serverRules({
    durationMinutes: null, phase: match.phase ?? null, finalType: match.finalType ?? null,
    groupPhaseDuration: input.groupPhaseGameDuration ?? null, finalRoundDuration: input.finalRoundGameDuration ?? null,
    config: { gamePeriods: input.gamePeriods, halftimeBreak: input.halftimeBreak, matchCockpitSettings: input.matchCockpitSettings },
    finalsConfig: input.finalsConfig ?? null,
  });
  return { sections: rules.sections, sectionSeconds: rules.sectionSeconds, overtimeSeconds: rules.overtimeSeconds, clockMode: input.matchCockpitSettings?.clockMode ?? DEFAULT_CLOCK_MODE };
}

/**
 * Kastenfarben (Spielanzeige 2.1): getragene Farbe (`wornColors`, @W3-028) nach der Einstellung „Anzeige für Zuschauer“.
 * Streifen der Weste (Review A5): Trikotfarbe beim Anpfiff, bis D.1 die aktuelle Teamfarbe der Leibchen-Seite; erst wenn
 * beides fehlt, die Standardfarbe der Seite (D-3). D.1 setzt `match.kit?.shirt ??` davor (bis dahin Lücke @ZM-163).
 */
function boxesOf(match: Match, teams: TournamentViewInput['teams'], settings: SpectatorDisplaySettings): MatchView['boxes'] {
  const bibSide: KitSide | undefined = match.kit?.bibSide;
  const bibTeamId = bibSide === undefined ? undefined : slotTeamId(bibSide === 'a' ? match.slotA : match.slotB);
  const shirt = bibTeamId === undefined ? undefined : normalizeKitColor(teams.find((t) => t.id === bibTeamId)?.colors?.primary);
  const boxes = resolveBoxColors({
    worn: wornColors(match, teams),
    ...(bibSide === undefined ? {} : { bibSide }),
    ...(shirt === undefined ? {} : { shirt }),
    settings,
  });
  return { home: boxes.a, away: boxes.b };
}

function matchView(match: Match, input: TournamentViewInput, options: ViewOptions, rules: ViewRules, sides: SideContext, display: SpectatorDisplaySettings): MatchView {
  const blank = sides.edition === 'blank';
  // Vorlage: keine Ergebnisse, keine Zustände – jedes Spiel hat seine Felder zum Eintragen (@DR-005, @DR-019).
  const detail = blank ? undefined : usableDetail(match, input);
  const status = blank ? 'scheduled' : audienceStatus(viewStatus(match, detail?.status ?? input.engineStatus?.(match.id)), rules);
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
    badge: matchBadgeModel({ status, ...(detail === undefined ? {} : { engine: detail }), ...(kickoff === undefined ? {} : { kickoff }) }),
    ...(detail === undefined ? {} : { engine: detail }),
    ...(isLive(status) ? { clockRules: clockRulesOf(match, input) } : {}),
    home: sideView(match, 'A', sides),
    away: sideView(match, 'B', sides),
    boxes: boxesOf(match, input.teams, display),
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
  const sides: SideContext = { audience: options.audience, labels, locale: options.locale, rules, edition };
  const display = parseSpectatorDisplay(input.spectatorDisplay);
  const matches = input.matches.map((match) => matchView(match, input, options, rules, sides, display));
  return {
    rules,
    matches,
    byId: new Map(matches.map((m) => [m.id, m])),
    current: currentOf(matches),
    currentFor: (field: number) => currentOf(matches.filter((m) => m.field === field)),
    placement: placementView(input, rules, edition, matches),
  };
}
