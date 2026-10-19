/**
 * „Turnier kopieren“ (A-04a, V-TEAM V14): neue Team- und Spiel-IDs, Spielseiten über `copySlot`.
 *
 * Ein Slot darf nie auf alte Team- oder Spiel-IDs zeigen: direkt besetzte Seiten bekommen die neue Team-ID,
 * aufgelöste Seiten werden wieder offen (die Kopie hat keine Ergebnisse), Verweise auf Vorgängerspiele
 * zeigen auf die neuen Spiel-IDs. Framework-frei.
 */
import type { Match, Team, Tournament } from '../../types/tournament';
import { copySlot, copySource } from './matchSlot';
import { matchOrigins } from './matchOrigin';

/** Ergebnis-, Abschluss-, Timer- und Überspringen-Felder, die eine Kopie nie übernimmt (C-KOPIE-ERGEBNISSE, @W5-025). */
const MATCH_CLEARED = {
  // Kein Ergebnis heißt kein Wert, nicht 0:0: `isTournamentCompleted` liest jede Zahl als Ergebnis (C-COPY-DASH).
  scoreA: undefined,
  scoreB: undefined,
  finishedAt: undefined,
  correctionHistory: undefined,
  timerStartTime: undefined,
  timerPausedAt: undefined,
  timerElapsedSeconds: undefined,
  overtimeScoreA: undefined,
  overtimeScoreB: undefined,
  penaltyScoreA: undefined,
  penaltyScoreB: undefined,
  decidedBy: undefined,
  skippedReason: undefined,
  skippedAt: undefined,
  liveState: undefined,
} as const;

export interface CopiedContent {
  teams: Team[];
  matches: Match[];
}

/**
 * Kopie von Teams und Spielen mit frischen IDs aus `makeId` (muss UUIDs liefern).
 * Ein Spiel ohne `slotA/slotB` (Altdaten) wird nicht geraten, sondern lehnt die Kopie ab.
 */
export function copyTeamsAndMatches(
  source: { teams: readonly Team[]; matches: readonly Match[] },
  makeId: () => string,
): CopiedContent {
  const teamIdMap = new Map<string, string>(source.teams.map((team) => [team.id, makeId()]));
  const matchIdMap = new Map<string, string>(source.matches.map((match) => [match.id, makeId()]));

  const teams = source.teams.map((team) => ({ ...team, id: teamIdMap.get(team.id) ?? team.id }));
  const matches = source.matches.map((match): Match => {
    const slotA = copySlot(match.slotA, teamIdMap, matchIdMap);
    const slotB = copySlot(match.slotB, teamIdMap, matchIdMap);
    // A-36a: Herkunft des Platzes mit neuen Spiel-IDs (nie auf das Original zeigen).
    const { originA, originB, ...rest } = match;
    return {
      ...rest,
      id: matchIdMap.get(match.id) ?? match.id,
      slotA,
      slotB,
      ...matchOrigins({
        originA: originA && copySource(originA, matchIdMap),
        originB: originB && copySource(originB, matchIdMap),
      }),
      matchStatus: 'scheduled',
      events: [],
      ...MATCH_CLEARED,
    };
  });
  return { teams, matches };
}

/** Schlüssel einer Zuordnung `Spiel-ID → Wert` auf die neuen Spiel-IDs umhängen; unbekannte Schlüssel entfallen. */
function remapByMatchId(
  assignments: Record<string, number> | undefined,
  matchIdMap: ReadonlyMap<string, string>,
): Record<string, number> | undefined {
  if (!assignments) { return undefined; }
  const remapped: Record<string, number> = {};
  for (const [oldId, value] of Object.entries(assignments)) {
    const newId = matchIdMap.get(oldId);
    if (newId !== undefined) { remapped[newId] = value; }
  }
  return remapped;
}

/**
 * Das kopierte Turnier – EINE Funktion für beide Einstiege (Dashboard „Kopieren“ und Admin Center „Duplizieren“),
 * @W5-024 bis @W5-027: Teams, Gruppen, Spielplan und Regeln bleiben, alles andere wird neu.
 *
 * - Neue Turnier-, Team- und Spiel-IDs (UUIDs aus `makeId`; C-COPY-AC-ID), Spielseiten über `copySlot`.
 * - Alle Spiele geplant ohne Ergebnis, Tor, Karte, Abschluss-, Timer- und Überspringen-Felder; das Turnier ist weder
 *   abgeschlossen noch abgebrochen (C-KOPIE-ERGEBNISSE, C-COPY-DASH, C-COPY-AC-FELDER).
 * - Keine Freigabe: nicht öffentlich, kein Freigabe-Code (der eigene Code entsteht bei der Freigabe der Kopie, serverseitig).
 *   Ein festgelegtes Original ergibt eine festgelegte (spielbereite), aber nicht öffentliche Kopie; ein Entwurf bleibt Entwurf.
 * - Keine Bildschirme: `monitors` entfällt („Monitore übernehmen“ holt sie). Helfer hängen an der Turnier-ID und kommen nie mit.
 */
export function buildCopiedTournament(
  tournament: Tournament,
  options: { newId: string; title: string; now: string; makeId: () => string },
): Tournament {
  const { teams, matches } = copyTeamsAndMatches(tournament, options.makeId);
  const matchIdMap = new Map(tournament.matches.map((match, index) => [match.id, matches[index].id]));
  const released = tournament.status === 'published';
  const refereeConfig = tournament.refereeConfig && {
    ...tournament.refereeConfig,
    manualAssignments: remapByMatchId(tournament.refereeConfig.manualAssignments, matchIdMap),
  };
  return {
    ...tournament,
    id: options.newId,
    title: options.title,
    status: released ? 'published' : 'draft',
    createdAt: options.now,
    updatedAt: options.now,
    lastVisitedStep: released ? tournament.lastVisitedStep : 1,
    teams,
    matches,
    fieldAssignments: remapByMatchId(tournament.fieldAssignments, matchIdMap),
    refereeConfig,
    // Keine Freigabe (@W5-024)
    isPublic: false,
    shareCode: undefined,
    shareCodeCreatedAt: undefined,
    publishedAt: released ? options.now : undefined,
    // Nicht abgeschlossen (@W5-025)
    manuallyCompleted: undefined,
    completedAt: undefined,
    cancelledAt: undefined,
    cancelledReason: undefined,
    statsSnapshot: undefined,
    dashboardStatus: undefined,
    deletedAt: undefined,
    // Neue Zeile in der Datenhaltung: Versionen des Originals gelten nicht
    version: undefined,
    changeRevision: undefined,
    // Keine Bildschirme (@W5-026)
    monitors: undefined,
  };
}
