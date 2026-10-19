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
  /** Harte Mindestpause in Zeitfenstern zwischen zwei Spielen eines Teams (minRestSlotsPerTeam). */
  minRestSlots: number;
  /** Beim Runden-Spielplan mit DFB-Ziel: Mindestzahl Spiele dazwischen, darf nicht unterschritten werden. */
  dfbTarget?: number | null;
  /** Zeitraster für die Meldung der zusätzlichen Dauer (@W4-045). */
  slotDurationMinutes: number;
  breakBetweenSlotsMinutes: number;
  /** Neu geplanter Plan ohne Rundenplan-Vorschlag, der mit einem Spiel der Gruppe beginnt (nur ohne Rundenplan). */
  replanOpenedBy?: (groupId: string) => Match[] | null;
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

/**
 * Zulässig nach @W4-043 und Kritik K-a5: längste Pause, Unterschied gespielter Spiele und Zeitfenster wachsen nicht;
 * eine längere Wartezeit am Ende ist hingenommen. Die Mindestpause prüft der Aufrufer hart.
 */
function notWorse(candidate: PlanQuality, reference: PlanQuality): boolean {
  return candidate.longestGap <= reference.longestGap && candidate.playedDiff <= reference.playedDiff
    && candidate.slotCount <= reference.slotCount;
}

/**
 * „So fair wie möglich“ (@W4-045, Rangfolge Controller 19.10.): wenigste Zeitfenster (die Dauer trifft alle Teams und
 * die Hallenzeit), dann kürzere längste Pause, Unterschied gespielter Spiele, Heim/Gast-Serie, Spreizung.
 */
function isFairer(a: PlanQuality, b: PlanQuality): boolean {
  const keys: Array<keyof PlanQuality> = ['slotCount', 'longestGap', 'playedDiff', 'sideStreak', 'spread'];
  for (const key of keys) {
    if (a[key] !== b[key]) { return a[key] < b[key]; }
  }
  return false;
}

interface Arranged {
  matches: Match[];
  roundPositionBySlot?: readonly number[];
}

/** Anstoßzeit je Zeitfenster aus dem gleichmäßigen Raster des Plans (auch für leere Zeitfenster). */
function slotTimes(matches: readonly Match[]): (slot: number) => Date | undefined {
  const timed = matches.filter((m) => m.scheduledTime !== undefined);
  const a = timed[0];
  const b = timed.find((m) => slotOf(m) !== slotOf(a));
  if (!a?.scheduledTime) { return () => undefined; }
  const start = new Date(a.scheduledTime).getTime();
  const step = b?.scheduledTime ? (new Date(b.scheduledTime).getTime() - start) / (slotOf(b) - slotOf(a)) : 0;
  return (slot) => new Date(start + (slot - slotOf(a)) * step);
}

/** Verschiebt Zeitfenster (`target` ist eine Permutation) samt Anstoßzeit und Rundenposition. */
function moveSlots(arranged: Arranged, target: (slot: number) => number): Arranged {
  const timeOf = slotTimes(arranged.matches);
  const matches = arranged.matches.map((match) => {
    const slot = target(slotOf(match));
    return slot === slotOf(match) ? match : { ...match, slot, round: slot + 1, scheduledTime: timeOf(slot) };
  });
  const old = arranged.roundPositionBySlot;
  if (!old) { return { matches }; }
  const positions: number[] = [];
  old.forEach((position, slot) => { positions[target(slot)] = position; });
  // Rundenpositionen wieder in Spielfolge nummerieren (Runde 2 = zweite gespielte Runde)
  const order = [...new Set(positions)];
  return { matches, roundPositionBySlot: positions.map((p) => order.indexOf(p)) };
}

/** Tauscht zwei Zeitfenster. */
function swapSlots(arranged: Arranged, a: number, b: number): Arranged {
  return moveSlots(arranged, (slot) => (slot === a ? b : slot === b ? a : slot));
}

/** Spielt den Plan rückwärts: alle Abstände bleiben gleich (@W4-043/@W4-045, ungleich große Gruppen). */
function reverseSlots(arranged: Arranged): Arranged {
  const last = Math.max(...arranged.matches.map(slotOf));
  return moveSlots(arranged, (slot) => last - slot);
}

/** Bringt ein Spiel der Gruppe `hostGroup` aus dem ersten Zeitfenster auf Feld 1 (Feldtausch), sonst null. */
function hostGroupToFront(arranged: Arranged, hostGroup: string): Arranged | null {
  const ordered = inPlayOrder(arranged.matches);
  const first = ordered[0];
  if (first.group === hostGroup) { return arranged; }
  const sameSlot = ordered.find((m) => slotOf(m) === slotOf(first) && m.group === hostGroup);
  if (!sameSlot) { return null; }
  return {
    ...arranged,
    matches: arranged.matches.map((m) => (m === first ? { ...m, field: sameSlot.field } : m === sameSlot ? { ...m, field: first.field } : m)),
  };
}

/** Tauscht zwei Spiele samt Zeitfenster, Feld und Anstoßzeit (nur außerhalb des Rundenplans, Runden blieben sonst nicht ganz). */
function exchangeMatches(arranged: Arranged, a: Match, b: Match): Arranged {
  const place = (m: Match): Pick<Match, 'slot' | 'round' | 'field' | 'scheduledTime'> =>
    ({ slot: m.slot, round: m.round, field: m.field, scheduledTime: m.scheduledTime });
  return {
    ...arranged,
    matches: arranged.matches.map((m) => (m === a ? { ...m, ...place(b) } : m === b ? { ...m, ...place(a) } : m)),
  };
}

/** Je Spiel des ersten Zeitfensters und je Spiel der Gruppe `hostGroup`: die beiden Spiele tauschen den Platz. */
function matchExchangesToFront(arranged: Arranged, hostGroup: string): Arranged[] {
  if (arranged.roundPositionBySlot) { return []; }
  const ordered = inPlayOrder(arranged.matches);
  const opening = ordered.filter((m) => slotOf(m) === slotOf(ordered[0]));
  const hostMatches = ordered.filter((m) => m.group === hostGroup);
  return opening.flatMap((a) => hostMatches.map((b) => exchangeMatches(arranged, a, b)));
}

/** Je Zeitfenster mit einem Spiel der Gruppe `hostGroup`: Tausch mit dem ersten Zeitfenster. */
function slotSwapsToFront(arranged: Arranged, hostGroup: string): Arranged[] {
  const firstSlot = slotOf(inPlayOrder(arranged.matches)[0]);
  const hostSlots = [...new Set(arranged.matches.filter((m) => m.group === hostGroup).map(slotOf))].sort((x, y) => x - y);
  return hostSlots.map((slot) => swapSlots(arranged, firstSlot, slot));
}

interface Opened {
  arranged: Arranged;
  /** Gesetzt, wenn die Eröffnung nur mit einer Verschlechterung ging (@W4-045): Kennzahlen vorher und nachher. */
  costs: { before: PlanQuality; after: PlanQuality } | null;
}

/**
 * Schritt 1: Spiel 1 kommt aus der Gruppe `hostGroup`. Reihenfolge: Feldtausch, Tausch gleich großer Gruppen, dann
 * Tausch eines Zeitfensters oder Spiels und Rückwärts-Spielen; erst wenn keine dieser Umstellungen ohne
 * Verschlechterung auskommt, die (teurere) Neuplanung mit dieser Gruppe zuerst. Geht es gar nicht ohne
 * Verschlechterung, die fairste Umstellung (@W4-045, `isFairer`). Die Mindestpause bleibt hart. Null nur, wenn keine
 * Umstellung die Mindestpause hält.
 */
function openWithGroup(
  arranged: Arranged, groups: Map<string, Team[]>, hostGroup: string, minGamesBetween: number,
  replanOpenedBy?: (groupId: string) => Match[] | null,
): Opened | null {
  const front = hostGroupToFront(arranged, hostGroup);
  if (front) { return { arranged: front, costs: null }; }
  const first = inPlayOrder(arranged.matches)[0];
  const openingGroup = first.group;
  const openingTeams = openingGroup !== undefined ? groups.get(openingGroup) : undefined;
  const hostTeams = groups.get(hostGroup) ?? [];
  if (openingGroup !== undefined && openingTeams?.length === hostTeams.length) {
    const rename = new Map<string, string>();
    openingTeams.forEach((team, i) => { rename.set(team.id, hostTeams[i].id); rename.set(hostTeams[i].id, team.id); });
    const regroup = new Map([[openingGroup, hostGroup], [hostGroup, openingGroup]]);
    return { arranged: { ...arranged, matches: renameTeams(arranged.matches, rename, regroup) }, costs: null };
  }
  const reference = measurePlanQuality(arranged.matches);
  const reversed = reverseSlots(arranged);
  const candidates: Arranged[] = [
    ...slotSwapsToFront(arranged, hostGroup), reversed, ...slotSwapsToFront(reversed, hostGroup),
    ...matchExchangesToFront(arranged, hostGroup), ...matchExchangesToFront(reversed, hostGroup),
  ];
  const best: { fairest: { arranged: Arranged; quality: PlanQuality } | null } = { fairest: null };
  /** Prüft einen Kandidaten; Rückgabe = ohne Verschlechterung, sofort nehmen. */
  const consider = (candidate: Arranged): Arranged | null => {
    const front = hostGroupToFront(candidate, hostGroup);
    if (!front) { return null; }
    const quality = measurePlanQuality(front.matches);
    if (quality.shortestGap - 1 < minGamesBetween) { return null; }
    if (notWorse(quality, reference)) { return front; }
    if (!best.fairest || isFairer(quality, best.fairest.quality)) { best.fairest = { arranged: front, quality }; }
    return null;
  };
  for (const candidate of candidates) {
    const free = consider(candidate);
    if (free) { return { arranged: free, costs: null }; }
  }
  const replanned = replanOpenedBy?.(hostGroup);
  if (replanned) {
    const free = consider({ matches: replanned });
    if (free) { return { arranged: free, costs: null }; }
  }
  const chosen = best.fairest;
  if (!chosen) { return null; }
  return { arranged: chosen.arranged, costs: { before: reference, after: chosen.quality } };
}

/** Meldung @W4-045: nennt jede Verschlechterung gegenüber dem Plan ohne Eröffnung, nur was wirklich wächst. */
function costsNotice(
  teamId: string, costs: { before: PlanQuality; after: PlanQuality }, matches: readonly Match[], input: HostOpeningInput,
): ScheduleNotice {
  const { before, after } = costs;
  const step = input.slotDurationMinutes + input.breakBetweenSlotsMinutes;
  const notice: Extract<ScheduleNotice, { kind: 'hostOpeningCosts' }> = { kind: 'hostOpeningCosts', teamId };
  if (after.slotCount > before.slotCount) {
    const lastStart = slotTimes(matches)(after.slotCount - 1);
    notice.duration = {
      slotsBefore: before.slotCount,
      slotsAfter: after.slotCount,
      extraMinutes: (after.slotCount - before.slotCount) * step,
      ...(lastStart ? { groupPhaseEndAfter: new Date(lastStart.getTime() + input.slotDurationMinutes * 60_000) } : {}),
    };
  }
  if (after.longestGap > before.longestGap) { notice.longestPause = { before: before.longestGap - 1, after: after.longestGap - 1 }; }
  if (after.playedDiff > before.playedDiff) { notice.playedDiff = { before: before.playedDiff, after: after.playedDiff }; }
  return notice;
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

  const minGamesBetween = Math.max(input.minRestSlots, input.dfbTarget ?? 0);
  const opened = openWithGroup({ matches: input.matches, roundPositionBySlot: input.roundPositionBySlot }, input.groups, hostGroup, minGamesBetween, input.replanOpenedBy);
  if (opened === null) {
    return { matches: input.matches, notices: [{ kind: 'hostOpeningNotPossible', teamId: primary }] };
  }
  let arranged = opened.arranged;
  const notices: ScheduleNotice[] = opened.costs ? [costsNotice(primary, opened.costs, arranged.matches, input)] : [];

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
  return { matches: renameTeams(arranged.matches, renameFor(groupTeamIds, wishes)), notices };
}
