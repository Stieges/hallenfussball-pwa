/**
 * Eröffnung durch die Mannschaft des Veranstalters (@W4-027, @W4-033, @W4-041, @W4-042, @W4-043).
 *
 * Wirkt auf den fertigen Plan (Spike §6): Innerhalb einer Gruppe ist „jeder gegen jeden“ unter jeder Umbenennung
 * der Teams derselbe Plan – Pausen, Gleichstände und Heim/Gast-Folgen bleiben gleich. Die Eröffnung tauscht deshalb
 * nur Namen (und bei Bedarf Feld, gleich große Gruppen oder ein ganzes Zeitfenster), nie die Fairness:
 * 1. Spiel 1 (erstes Zeitfenster, Feld 1) muss aus der Gruppe der Veranstalter-Mannschaft sein: Feldtausch im selben
 *    Zeitfenster, Tausch gleich großer Gruppen, sonst Tausch eines Zeitfensters, wenn keine Kennzahl schlechter wird.
 * 2. Umbenennen in der Gruppe: die Heimmannschaft von Spiel 1 wird die Veranstalter-Mannschaft.
 * 3. Nur im Runden-Spielplan und bei zwei Markierten derselben Gruppe gilt die Wahl (@W4-033): „Vereinsduell
 *    eröffnet“ (Spiel 1 = beide) oder „Veranstalter gegen einen Gast“ (Duell in Runde 2).
 */
import type { Match, OpeningMode, Team } from '../../types/tournament';
import { requireTeamId, teamSlot } from '../models/matchSlot';
import { inPlayOrder, measurePlanQuality, type PlanQuality } from './planQuality';
import type { ScheduleNotice } from './scheduleTypes';

export interface HostOpeningInput {
  matches: Match[];
  groups: Map<string, Team[]>;
  hostTeamIds: readonly string[];
  openingMode: OpeningMode;
  /** Nur beim Runden-Spielplan: Position der Runde je Zeitfenster (Index = Zeitfenster). */
  roundPositionBySlot?: readonly number[];
}

export interface HostOpeningResult {
  matches: Match[];
  notices: ScheduleNotice[];
}

const slotOf = (match: Match): number => match.slot ?? match.round - 1;

function renameTeams(matches: Match[], rename: ReadonlyMap<string, string>, regroup?: ReadonlyMap<string, string>): Match[] {
  const mapId = (id: string): string => rename.get(id) ?? id;
  return matches.map((match) => ({
    ...match,
    slotA: teamSlot(mapId(requireTeamId(match.slotA))),
    slotB: teamSlot(mapId(requireTeamId(match.slotB))),
    group: match.group !== undefined ? regroup?.get(match.group) ?? match.group : undefined,
  }));
}

function mirrorHomeAway(matches: Match[]): Match[] {
  return matches.map((match) => ({ ...match, slotA: match.slotB, slotB: match.slotA }));
}

function notWorse(candidate: PlanQuality, reference: PlanQuality): boolean {
  return candidate.longestGap <= reference.longestGap && candidate.playedDiff <= reference.playedDiff
    && candidate.shortestGap >= reference.shortestGap && candidate.sideStreak <= reference.sideStreak
    && candidate.slotCount <= reference.slotCount;
}

interface Arranged {
  matches: Match[];
  roundPositionBySlot?: readonly number[];
}

/** Tauscht zwei Zeitfenster samt Anstoßzeit und Rundenposition. */
function swapSlots(arranged: Arranged, a: number, b: number): Arranged {
  const timeOf = (slot: number): Date | undefined => arranged.matches.find((m) => slotOf(m) === slot)?.scheduledTime;
  const target = (slot: number): number => (slot === a ? b : slot === b ? a : slot);
  const matches = arranged.matches.map((match) => {
    const slot = target(slotOf(match));
    return slot === slotOf(match) ? match : { ...match, slot, round: slot + 1, scheduledTime: timeOf(slot) };
  });
  const positions = arranged.roundPositionBySlot?.map((_, slot, all) => all[target(slot)]);
  return { matches, roundPositionBySlot: positions };
}

/** Schritt 1: Spiel 1 kommt aus der Gruppe `hostGroup`. Null, wenn das nicht ohne Verschlechterung geht. */
function openWithGroup(arranged: Arranged, groups: Map<string, Team[]>, hostGroup: string): Arranged | null {
  const first = inPlayOrder(arranged.matches)[0];
  if (first.group === hostGroup) { return arranged; }
  const sameSlot = inPlayOrder(arranged.matches).find((m) => slotOf(m) === slotOf(first) && m.group === hostGroup);
  if (sameSlot) {
    return {
      ...arranged,
      matches: arranged.matches.map((m) => (m === first ? { ...m, field: sameSlot.field } : m === sameSlot ? { ...m, field: first.field } : m)),
    };
  }
  const openingGroup = first.group;
  const openingTeams = openingGroup !== undefined ? groups.get(openingGroup) : undefined;
  const hostTeams = groups.get(hostGroup) ?? [];
  if (openingGroup !== undefined && openingTeams?.length === hostTeams.length) {
    const rename = new Map<string, string>();
    openingTeams.forEach((team, i) => { rename.set(team.id, hostTeams[i].id); rename.set(hostTeams[i].id, team.id); });
    const regroup = new Map([[openingGroup, hostGroup], [hostGroup, openingGroup]]);
    return { ...arranged, matches: renameTeams(arranged.matches, rename, regroup) };
  }
  const reference = measurePlanQuality(arranged.matches);
  const hostSlots = [...new Set(arranged.matches.filter((m) => m.group === hostGroup).map(slotOf))].sort((x, y) => x - y);
  for (const slot of hostSlots) {
    const swapped = swapSlots(arranged, slotOf(first), slot);
    if (inPlayOrder(swapped.matches)[0].group === hostGroup && notWorse(measurePlanQuality(swapped.matches), reference)) {
      return swapped;
    }
  }
  return null;
}

/** Umbenennung, die jede Vorgabe „Platz des Plan-Teams → echtes Team“ erfüllt (nacheinander per Tausch). */
function renameFor(teamIds: readonly string[], wishes: ReadonlyArray<readonly [string, string]>): Map<string, string> {
  const assigned = new Map(teamIds.map((id) => [id, id]));
  for (const [planTeam, realTeam] of wishes) {
    const holder = [...assigned].find(([, real]) => real === realTeam)?.[0];
    const current = assigned.get(planTeam);
    if (holder === undefined || current === undefined) { continue; }
    assigned.set(holder, current);
    assigned.set(planTeam, realTeam);
  }
  return assigned;
}

function opponentInRound(arranged: Arranged, teamId: string, roundPosition: number): string | undefined {
  const match = arranged.matches.find((m) => arranged.roundPositionBySlot?.[slotOf(m)] === roundPosition
    && (requireTeamId(m.slotA) === teamId || requireTeamId(m.slotB) === teamId));
  if (!match) { return undefined; }
  const home = requireTeamId(match.slotA);
  return home === teamId ? requireTeamId(match.slotB) : home;
}

export function applyHostOpening(input: HostOpeningInput): HostOpeningResult {
  const groupOf = new Map<string, string>();
  input.groups.forEach((teams, groupId) => { for (const team of teams) { groupOf.set(team.id, groupId); } });
  const hosts = [...new Set(input.hostTeamIds)].filter((id) => groupOf.has(id));
  if (hosts.length === 0 || input.matches.length === 0) { return { matches: input.matches, notices: [] }; }

  const pairMode = input.roundPositionBySlot !== undefined && hosts.length >= 2 && groupOf.get(hosts[0]) === groupOf.get(hosts[1]);
  const openingGroup = inPlayOrder(input.matches)[0].group;
  const primary = pairMode ? hosts[0] : hosts.find((id) => groupOf.get(id) === openingGroup) ?? hosts[0];
  const hostGroup = groupOf.get(primary) ?? '';

  let arranged = openWithGroup({ matches: input.matches, roundPositionBySlot: input.roundPositionBySlot }, input.groups, hostGroup);
  if (arranged === null) {
    return { matches: input.matches, notices: [{ kind: 'hostOpeningNotPossible', teamId: primary }] };
  }

  const groupTeamIds = (input.groups.get(hostGroup) ?? []).map((team) => team.id);
  let first = inPlayOrder(arranged.matches)[0];
  const wishes: Array<readonly [string, string]> = [[requireTeamId(first.slotA), primary]];
  if (pairMode && input.openingMode === 'club-derby') {
    wishes.push([requireTeamId(first.slotB), hosts[1]]);
  } else if (pairMode) {
    let partner = opponentInRound(arranged, requireTeamId(first.slotA), 1);
    if (partner === undefined) { // Heimteam von Spiel 1 hat in Runde 2 spielfrei: Seiten spiegeln (Fairness gleich)
      arranged = { ...arranged, matches: mirrorHomeAway(arranged.matches) };
      first = inPlayOrder(arranged.matches)[0];
      wishes[0] = [requireTeamId(first.slotA), primary];
      partner = opponentInRound(arranged, requireTeamId(first.slotA), 1);
    }
    if (partner !== undefined) { wishes.push([partner, hosts[1]]); }
  }
  return { matches: renameTeams(arranged.matches, renameFor(groupTeamIds, wishes)), notices: [] };
}
