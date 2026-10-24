/**
 * GA4 A-13a „Gruppe abschließen“ – Regeln für Abschluss und Zustand, rein (kein React, keine Daten-Schreibwege).
 * Plan `task-GA4-plan-v2.md` § 5 A-13a, Nachtrag 2026-10-21 (vier Zustandswörter, Zusatzmarken).
 *
 * - Zustand je Gruppe und Phase (@TM-059): offen, läuft, bereit zum Abschluss, abgeschlossen; „Besetzung prüfen“ und
 *   „noch nicht gesendet“ sind Zusatzmarken, die das Zustandswort nie ersetzen.
 * - Vorschlag „Gruppe abschließen“ für fertige Gruppen ohne gültigen Abschluss, auch Jeder gegen jeden (@TM-044, @TM-058).
 * - Vorbereitung des Abschlusses: offene Spiele (@TM-054), offene Gleichstände (@TM-043, @TM-048, @TM-049, @TM-060) oder
 *   bereit mit Rangfolge, gültigen Entscheidungen (@W2A-058) und Stand für den Vergleich am Server (R-GA4v2-3).
 *   Die Blöcke kommen UNVERÄNDERT aus `groupTieView` (Paket TB-B); eine zweite Pflicht-Regel gibt es hier nicht.
 * - Erneuter Abschluss nach einer Korrektur (`stale`): offene Blöcke mit Folgespiel gehen über `openRanks` auf ihre
 *   Herkunft zurück (R-GA4v2-4, @TM-145).
 *
 * Gruppe eines Spiels ausschließlich über `groupKeyOf` (R-GA4v2-7): Jeder gegen jeden ist Gruppe '' (Spiele `'all'`).
 * Ein Spiel ist entschieden wie am Server (`complete_group`, Schritt 2): Status `finished` oder `skipped` (@W2A-055).
 * Zusätzlich verlangt die App bei `finished` einen Stand – nie lockerer als der Server, nur strenger.
 */
import type { ForfeitAbsent, Match, StandingDecision, Tournament } from '../../types/tournament';
import { groupKeyOf } from '../models/standingsGroups';
import { matchSideTeamId } from '../models/matchSlot';
import { activeCompletion, everCompleted, groupClosedFromCompletions } from '../standings/groupCompletions';
import { groupTieView, type OpenTieBlock } from '../standings/tieViews';
import { blockMayShare, effectivePlacementsToPlayOut, followUpRanks, mandatoryReason } from '../standings/playOutPlaces';
import { rankTournamentGroup, type TableTournament } from '../standings/tournamentTable';

export type CompletionTournament = Pick<Tournament, 'teams' | 'matches' | 'groupCompletions'> & TableTournament;

/** Zustand einer Gruppe: `finished` = alle Spiele entschieden, nicht abgeschlossen; `stale` = abgeschlossen, danach geändert. */
export type GroupState = 'open' | 'running' | 'finished' | 'completed' | 'stale';

/** Die vier Zustandswörter der Oberfläche (Nachtrag 2026-10-21): offen, läuft, bereit zum Abschluss, abgeschlossen. */
export type GroupStateWord = 'open' | 'running' | 'ready' | 'completed';

/** Zusatzmarken: „Besetzung prüfen“ (`checkSlots`), „noch nicht gesendet“ (`notSent`). */
export type GroupStateFlag = 'checkSlots' | 'notSent';

export interface GroupStateLabel {
  word: GroupStateWord;
  flags: GroupStateFlag[];
}

/** Zustand einer Phase (Gruppenphase, Finalrunde); nie „bereit zum Abschluss“ (@TM-059). */
export type PhaseState = Extract<GroupStateWord, 'open' | 'running' | 'completed'>;

/** Stand eines Gruppenspiels wie `match_engine.group_state` (Fassung 2.1): fehlende Werte fehlen, nie `null`. */
export interface ExpectedMatchState {
  id: string;
  ta?: string;
  tb?: string;
  a?: number;
  b?: number;
  s: string;
  f?: ForfeitAbsent;
}

export type GroupCompletionPreparation =
  | { code: 'UNKNOWN_GROUP' }
  | { code: 'OPEN_MATCHES'; open: number }
  | { code: 'DECISION_REQUIRED'; blocks: OpenTieBlock[] }
  | {
    code: 'READY';
    ranking: string[];
    openRanks: number[];
    tieDecisions: StandingDecision[];
    expectedState: ExpectedMatchState[];
  };

const NOT_STARTED: readonly string[] = ['scheduled', 'waiting'];

/** Status wie am Server (`coalesce(match_status, 'scheduled')`); der Laufzeitwert `paused` bleibt erhalten. */
const statusOf = (match: Match): string => match.matchStatus ?? 'scheduled';

const isDecided = (match: Match): boolean => {
  const status = statusOf(match);
  return status === 'skipped' || (status === 'finished' && match.scoreA !== undefined && match.scoreB !== undefined);
};

const isStarted = (match: Match): boolean => !NOT_STARTED.includes(statusOf(match));

/** Phase eines Spiels: Finalrunde = `isFinal`, sonst Gruppenphase. */
const isFinalMatch = (match: Match): boolean => match.isFinal === true;

/** Gruppenspiele von `groupId` (ohne Finalrunde), Gruppe über `groupKeyOf`. */
export function groupMatches(tournament: Pick<Tournament, 'matches'>, groupId: string): Match[] {
  return tournament.matches.filter((m) => !isFinalMatch(m) && groupKeyOf(m.group) === groupId);
}

/** Gruppenspiele, die noch nicht entschieden sind (@TM-054): laufend, angesetzt oder ohne Stand. */
export function undecidedMatches(tournament: Pick<Tournament, 'matches'>, groupId: string): Match[] {
  return groupMatches(tournament, groupId).filter((m) => !isDecided(m));
}

/** Alle Gruppen mit mindestens einem Gruppenspiel, sortiert (Jeder gegen jeden: `['']`). */
export function groupIds(tournament: Pick<Tournament, 'matches'>): string[] {
  return [...new Set(tournament.matches.filter((m) => !isFinalMatch(m)).map((m) => groupKeyOf(m.group)))].sort();
}

const byId = (x: { id: string }, y: { id: string }): number => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);

/**
 * Stand der Gruppe für den Vergleich am Server (R-GA4v2-3, Auflage 7): je Gruppenspiel Teams, Tore, Status,
 * Nichtantritt – ohne Version, nach Spiel-ID sortiert. Zwilling `match_engine.group_state`, Gleichlauf `group-state.json`.
 */
export function expectedState(tournament: Pick<Tournament, 'matches'>, groupId: string): ExpectedMatchState[] {
  return groupMatches(tournament, groupId)
    .map((m): ExpectedMatchState => {
      const ta = matchSideTeamId(m, 'A');
      const tb = matchSideTeamId(m, 'B');
      return {
        id: m.id,
        ...(ta !== undefined ? { ta } : {}),
        ...(tb !== undefined ? { tb } : {}),
        ...(m.scoreA !== undefined ? { a: m.scoreA } : {}),
        ...(m.scoreB !== undefined ? { b: m.scoreB } : {}),
        s: statusOf(m),
        ...(m.forfeitAbsent !== undefined ? { f: m.forfeitAbsent } : {}),
      };
    })
    .sort(byId);
}

export { activeCompletion, everCompleted, groupClosedFromCompletions };

/** Zustand einer Gruppe (@TM-059). Ein Abschluss bleibt bestehen, bis die Gruppe wieder geöffnet wird. */
export function groupState(tournament: Pick<Tournament, 'matches' | 'groupCompletions'>, groupId: string): GroupState {
  const completion = activeCompletion(tournament, groupId);
  if (completion !== undefined) {
    return completion.stale ? 'stale' : 'completed';
  }
  const matches = groupMatches(tournament, groupId);
  if (matches.length > 0 && matches.every(isDecided)) {
    return 'finished';
  }
  return matches.some(isStarted) ? 'running' : 'open';
}

/** Zustandswort und Zusatzmarken einer Gruppe (Nachtrag 2026-10-21); `unsent` kommt aus der Warteschlange (A-15c). */
export function groupStateLabel(state: GroupState, options: { unsent?: boolean } = {}): GroupStateLabel {
  const word: GroupStateWord = state === 'finished' ? 'ready' : state === 'stale' ? 'completed' : state;
  const flags: GroupStateFlag[] = [];
  if (state === 'stale') {
    flags.push('checkSlots');
  }
  if (options.unsent === true) {
    flags.push('notSent');
  }
  return { word, flags };
}

/**
 * Zustand einer Phase (@TM-059). Gruppenphase: abgeschlossen, wenn jede Gruppe abgeschlossen ist. Finalrunde:
 * abgeschlossen, wenn jedes Spiel entschieden ist (auch „nicht ausgetragen“). Sonst läuft sie, sobald ein Spiel der
 * Phase angepfiffen oder entschieden ist. Ohne Spiele der Phase: offen.
 */
export function phaseState(tournament: Pick<Tournament, 'matches' | 'groupCompletions'>, phase: 'groups' | 'finals'): PhaseState {
  if (phase === 'groups') {
    const groups = groupIds(tournament);
    if (groups.length > 0 && groups.every((g) => activeCompletion(tournament, g) !== undefined)) {
      return 'completed';
    }
    return tournament.matches.some((m) => !isFinalMatch(m) && isStarted(m)) ? 'running' : 'open';
  }
  const finals = tournament.matches.filter(isFinalMatch);
  if (finals.length > 0 && finals.every((m) => ['finished', 'skipped'].includes(statusOf(m)))) {
    return 'completed';
  }
  return finals.some(isStarted) ? 'running' : 'open';
}

/** Zeitpunkt, zu dem die Gruppe fertig wurde (letzter Abpfiff bzw. „nicht ausgetragen“), soweit bekannt. */
const finishedAtOf = (tournament: Pick<Tournament, 'matches'>, groupId: string): string | undefined =>
  groupMatches(tournament, groupId)
    .map((m) => m.finishedAt ?? m.skippedAt)
    .filter((at): at is string => at !== undefined)
    .sort()
    .at(-1);

/**
 * Vorschlag „Gruppe abschließen“ (@TM-044, @TM-058): fertige Gruppen ohne geltenden Abschluss, auch wieder geöffnete.
 * Reihenfolge: zuerst fertig gewordene Gruppe zuerst (Nachtrag 2026-10-21 Punkt 4), ohne Zeitpunkt danach, dann nach Gruppe.
 */
export function proposeGroupCompletion(tournament: Pick<Tournament, 'matches' | 'groupCompletions'>): string[] {
  const ready = groupIds(tournament).filter((g) => groupState(tournament, g) === 'finished');
  const at = new Map(ready.map((g) => [g, finishedAtOf(tournament, g)]));
  return ready.sort((x, y) => {
    const ax = at.get(x);
    const ay = at.get(y);
    if (ax !== ay) {
      return ax === undefined ? 1 : ay === undefined ? -1 : ax < ay ? -1 : 1;
    }
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

/** Team-IDs der entfernten Teams (`isRemoved`): sie zählen im Abschluss nicht mit (@TM-149, Server: `NOT is_removed`). */
const removedTeamIds = (tournament: CompletionTournament): Set<string> =>
  new Set(tournament.teams.filter((team) => team.isRemoved === true).map((team) => team.id));

/**
 * Rangfolge der Gruppe ohne entfernte Teams (@TM-149): Platz 1 bis n über die übrigen Teams. Der Server vergleicht nur mit den
 * Teams ohne `is_removed` und meldete sonst `RANKING_MISMATCH` (Befund C-RANKING-ENTFERNTE-TEAMS).
 */
export function activeRanking(tournament: CompletionTournament, groupId: string): string[] {
  const removed = removedTeamIds(tournament);
  return rankTournamentGroup(tournament, groupId).rows.map((r) => r.team.id).filter((teamId) => !removed.has(teamId));
}

/**
 * Offene Blöcke der Gruppe ohne entfernte Teams (@TM-149): Blöcke aus `groupTieView`, ohne die entfernten Mitglieder;
 * bleibt weniger als ein Paar, entfällt der Block. Platz und Pflicht-Grund folgen der Rangfolge ohne entfernte Teams.
 */
function openBlocks(tournament: CompletionTournament, groupId: string): OpenTieBlock[] {
  const { open } = groupTieView(tournament, groupId);
  const removed = removedTeamIds(tournament);
  if (removed.size === 0) {
    return open;
  }
  const ranking = activeRanking(tournament, groupId);
  const places = effectivePlacementsToPlayOut(tournament);
  const followUps = followUpRanks(tournament.matches, groupId);
  return open.flatMap((block) => {
    const teamIds = block.teamIds.filter((teamId) => !removed.has(teamId));
    if (teamIds.length < 2) {
      return [];
    }
    const place = Math.min(...teamIds.map((teamId) => ranking.indexOf(teamId))) + 1;
    const shape = { place, size: teamIds.length };
    const mandatory = mandatoryReason(places, followUps, shape);
    return [{ groupId: block.groupId, teamIds, ...shape, mayShare: blockMayShare(places, followUps, shape), ...(mandatory !== undefined ? { mandatory } : {}) }];
  });
}

function ready(tournament: CompletionTournament, groupId: string, openRanks: number[]): GroupCompletionPreparation {
  return {
    code: 'READY',
    ranking: activeRanking(tournament, groupId),
    openRanks,
    tieDecisions: groupTieView(tournament, groupId).decided.map((d) => d.decision),
    expectedState: expectedState(tournament, groupId),
  };
}

/** Offene Spiele der Gruppe oder `undefined`, wenn die Gruppe Spiele hat und alle entschieden sind. */
function blockedByMatches(tournament: CompletionTournament, groupId: string): GroupCompletionPreparation | undefined {
  const matches = groupMatches(tournament, groupId);
  if (matches.length === 0) {
    return { code: 'UNKNOWN_GROUP' };
  }
  const open = matches.filter((m) => !isDecided(m)).length;
  return open > 0 ? { code: 'OPEN_MATCHES', open } : undefined;
}

/**
 * Abschluss vorbereiten (@TM-046, @TM-054, @TM-049): offene Spiele → `OPEN_MATCHES`; offene Gleichstände →
 * `DECISION_REQUIRED` mit den Blöcken aus `groupTieView` (Pflicht-Grund `mandatory`, „akzeptieren erlaubt“ `mayShare`);
 * sonst `READY` mit Rangfolge, gültigen Entscheidungen der Gruppe und Stand. Ändert nichts am Turnier.
 */
export function prepareGroupCompletion(tournament: CompletionTournament, groupId: string): GroupCompletionPreparation {
  const blocked = blockedByMatches(tournament, groupId);
  if (blocked !== undefined) {
    return blocked;
  }
  const open = openBlocks(tournament, groupId);
  if (open.length > 0) {
    return { code: 'DECISION_REQUIRED', blocks: open };
  }
  return ready(tournament, groupId, []);
}

/**
 * Wer schließt erneut ab? `manual` = die Turnierleitung tippt „Erneut abschließen“ (@TM-151): jeder offene Pflicht-Block, auch
 * einer mit Folgespiel, verlangt zuerst die Entscheidung. `auto` = der Auslöser nach einer angenommenen Korrektur (A-15b,
 * @TM-071, @TM-145): Plätze offener Blöcke mit Folgespiel gehen über `openRanks` auf ihre Herkunft zurück.
 */
export type RecompletionTrigger = 'manual' | 'auto';

/**
 * Erneuter Abschluss einer nach dem Abschluss geänderten Gruppe (`stale`, R-GA4v2-4, @TM-145, @TM-150, @TM-151). Ein offener Block,
 * dessen Pflicht nur aus der Einstellung „auszuspielende Plätze“ kommt (kein Folgespiel, z. B. der Turniersieger im Nikolaus),
 * wird nie still festgelegt: `DECISION_REQUIRED` – „Besetzung prüfen“ bleibt stehen, bis die Turnierleitung entschieden hat
 * (@TM-150). Blöcke mit Folgespiel: bei `manual` ebenfalls `DECISION_REQUIRED` (@TM-151), bei `auto` über `openRanks` zurück auf
 * die Herkunft. Ein offener Block ohne Pflicht (Annahme erlaubt) hält den Abschluss nicht auf. Für eine Gruppe, die nicht
 * `stale` ist, gilt `prepareGroupCompletion`.
 */
export function prepareRecompletion(tournament: CompletionTournament, groupId: string, trigger: RecompletionTrigger): GroupCompletionPreparation {
  if (groupState(tournament, groupId) !== 'stale') {
    return prepareGroupCompletion(tournament, groupId);
  }
  const blocked = blockedByMatches(tournament, groupId);
  if (blocked !== undefined) {
    return blocked;
  }
  const open = openBlocks(tournament, groupId);
  const required = open.filter((block) => block.mandatory?.kind === 'setting' || (trigger === 'manual' && block.mandatory?.kind === 'followUp'));
  if (required.length > 0) {
    return { code: 'DECISION_REQUIRED', blocks: required };
  }
  const openRanks = open
    .filter((block) => block.mandatory?.kind === 'followUp')
    .flatMap((block) => Array.from({ length: block.size }, (_, i) => block.place + i));
  return ready(tournament, groupId, [...new Set(openRanks)].sort((x, y) => x - y));
}
