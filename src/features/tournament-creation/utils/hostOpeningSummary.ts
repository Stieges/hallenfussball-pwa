/**
 * Was Assistent, Übersicht und „Neuplanung prüfen“ zu den Mannschaften des Veranstalters zeigen
 * (@W4-034, @W4-033, @W4-048, @W4-050). Rein: liest nur Entwurf und erzeugten Plan, ändert nichts.
 */
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import { hostDuelNumber, hostFollowCount } from '../../../core/generators/hostSpacing';
import { hostOpeningInfo } from '../../../core/models/hostTeams';
import { DEFAULT_OPENING_MODE, type OpeningMode, type Team, type Tournament } from '../../../types/tournament';

/** Felder des Entwurfs, die die Zusammenfassung braucht. */
export type HostSummaryInput = Pick<Tournament, 'teams'> & Partial<Pick<Tournament, 'hostTeamIds' | 'openingMode' | 'groupSystem'>>;

export interface HostSummary {
  /** Wirksam markierte Mannschaften in Teamlisten-Reihenfolge. */
  teams: Team[];
  /** Die Wahl der Eröffnung wird angeboten (zwei Markierte in einer Gruppe, Runden-Spielplan). */
  openingChoice: boolean;
  /** Gewählte Art; ohne eigene Wahl die Vorgabe. */
  mode: OpeningMode;
  /** „Beide beginnen als Heim“ war gewählt, ging aber nicht auf; der Plan folgt der Vorgabe. */
  bothHomeFailed: boolean;
  /** Spielnummer des Vereinsduells (nur bei Wahl und erzeugtem Plan). */
  duelNumber?: number;
  /** Wie oft ein Spiel der einen Mannschaft direkt auf ein Spiel der anderen folgt (nur bei Wahl und erzeugtem Plan). */
  follows?: number;
}

/** Plan des Entwurfs; null, wenn er sich noch nicht erzeugen lässt. */
export function planForHostSummary(draft: Tournament): GeneratedSchedule | null {
  try {
    // wie `buildReplanPreview`: entfernte Teams spielen nicht mit, sonst nennen Übersicht und Vorschau verschiedene Nummern
    const teams = draft.teams.filter((team) => !team.isRemoved);
    return generateFullSchedule({ ...draft, teams, numberOfTeams: teams.length, matches: [] });
  } catch {
    return null;
  }
}

/** Undefined, wenn keine Mannschaft des Veranstalters markiert ist. */
export function hostSummary(input: HostSummaryInput, schedule: GeneratedSchedule | null): HostSummary | undefined {
  const active = input.teams.filter((team) => !team.isRemoved);
  const info = hostOpeningInfo({
    hostTeamIds: input.hostTeamIds, teams: active, roundsPlan: schedule?.roundsPlan === true, groupSystem: input.groupSystem,
  });
  if (info.hostTeamIds.length === 0) { return undefined; }
  const teams = info.hostTeamIds.map((id) => active.find((team) => team.id === id)).filter((team): team is Team => team !== undefined);
  const mode = input.openingMode ?? DEFAULT_OPENING_MODE;
  const summary: HostSummary = { teams, openingChoice: info.openingChoice, mode, bothHomeFailed: false };
  if (!info.openingChoice || !schedule) { return summary; }
  const [a, b] = info.hostTeamIds;
  summary.duelNumber = hostDuelNumber(schedule.allMatches, a, b);
  summary.follows = hostFollowCount(schedule.allMatches, a, b);
  summary.bothHomeFailed = schedule.scheduleNotices?.some((notice) => notice.kind === 'hostBothHomeNotPossible');
  return summary;
}

/** Markierung setzen oder lösen; ohne Dubletten, die Reihenfolge entscheidet die Teamliste (`effectiveHostTeamIds`). */
export function toggleHostTeam(hostTeamIds: readonly string[] | undefined, teamId: string, marked: boolean): string[] {
  const others = (hostTeamIds ?? []).filter((id) => id !== teamId);
  return marked ? [...others, teamId] : others;
}
