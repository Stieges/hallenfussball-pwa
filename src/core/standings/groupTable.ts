/**
 * Gruppentabelle nach BFV Teil 3 § 20 (13) für private Hallenturniere (Paket TB, Plan v2 § 3.1, R-TB-1).
 *
 * Algorithmus „Blöcke“ (Lesart 1, Daniel 2026-10-20, endgültig): Start ist ein Block mit allen Teams. Je aktivem
 * Kriterium der eingestellten Reihenfolge wird jeder Block mit mehr als einem Team nach dem Schlüssel aufgeteilt.
 * „Direkter Vergleich“ = Sondertabelle über den AKTUELLEN Block (bei 2 Teams ihr Spiel). Teilblöcke laufen mit dem
 * NÄCHSTEN Kriterium weiter – der direkte Vergleich wird nie erneut auf eine Teilmenge angewendet (das wäre Teil 2 d,
 * Futsal). Was nach dem letzten Kriterium gleich bleibt, ist ein offener Block: gemeinsame Platzziffer mit Sprung
 * (2, 2, 4), Reihenfolge = Eingabereihenfolge (stabil). Markiert („Entscheidung nötig“) wird er nur je Gruppe und erst,
 * wenn alle Gruppenspiele entschieden sind („nicht ausgetragen“ zählt als entschieden). Gruppenübergreifend
 * (`crossGroup`, Endstand) gibt es weder direkten Vergleich noch Markierung (R-TB-6).
 *
 * Entscheidungen der Turnierleitung (`decisions.ts`) gelten nur für einen offenen Block im Modus `group`, wenn Block und
 * Grundlage gleich sind: Strafstoßschießen/Reihenfolge ordnen den Block, „Ergebnis so akzeptieren“ schließt ihn mit
 * gemeinsamer Platzziffer – aber nur, solange kein Platz des Blocks ausgespielt werden muss (Einstellung, Herkünfte;
 * erneut geprüft beim Anwenden, @W2A-068, @W2A-069). Passen mehrere, gilt die neueste. Ungültige, verfallene oder
 * durch eine neuere verdrängte Entscheidungen stehen in `staleDecisionIds`.
 *
 * Rein, ohne React.
 */
import type { Match, PlacementCriterion, PointSystem, Standing, StandingDecision, Team } from '../../types/tournament';
import { isGroupMatchDecided, matchOutcome } from './countsForStandings';
import { miniTable, miniTableKey } from './headToHead';
import { decisionBasis, findValidDecision } from './decisions';
import { blockMayShare } from './playOutPlaces';

export type StandingsMode = 'group' | 'crossGroup';

export interface RankGroupInput {
  /** Gruppenbuchstabe, `OVERALL_GROUP` ('') bei Jeder gegen jeden. */
  groupId: string;
  /** Teams der Tabelle in Eingabereihenfolge. */
  teams: readonly Team[];
  /** Alle Spiele dieser Tabelle, gleich welcher Status (für „alle Gruppenspiele entschieden“). */
  matches: readonly Match[];
  pointSystem: PointSystem;
  placementLogic: readonly PlacementCriterion[];
  decisions: readonly StandingDecision[];
  mode: StandingsMode;
  /** Plätze, die bei Gleichstand ausgespielt werden müssen (Einstellung, `effectivePlacementsToPlayOut`). */
  placesToPlayOut: readonly number[];
  /** Gruppenplätze dieser Gruppe, die in ein weiteres Spiel führen (`followUpRanks` über alle Spiele des Turniers). */
  followUpRanks: readonly number[];
}

export interface GroupTableRow extends Standing {
  place: number;
  decisionNeeded: boolean;
}

export interface GroupTableResult {
  groupId: string;
  rows: GroupTableRow[];
  allGroupMatchesDecided: boolean;
  /** Offene Blöcke (nach allen Kriterien gleich, ohne gültige Entscheidung); nur im Modus `group`. */
  openTies: string[][];
  staleDecisionIds: string[];
}

type Key = readonly number[];

function emptyStanding(team: Team): Standing {
  return { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
}

/** Gesamttabelle aller gezählten Spiele zwischen Teams dieser Tabelle. */
function overallStandings(teams: readonly Team[], matches: readonly Match[], pointSystem: PointSystem): Standing[] {
  const standings = teams.map(emptyStanding);
  const byId = new Map(standings.map((s) => [s.team.id, s]));
  for (const match of matches) {
    const outcome = matchOutcome(match, pointSystem);
    const a = outcome === null ? undefined : byId.get(outcome[0].teamId);
    const b = outcome === null ? undefined : byId.get(outcome[1].teamId);
    if (outcome === null || a === undefined || b === undefined) {
      continue;
    }
    for (const [standing, side] of [[a, outcome[0]], [b, outcome[1]]] as const) {
      standing.played++;
      standing.goalsFor += side.goalsFor;
      standing.goalsAgainst += side.goalsAgainst;
      standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
      standing.points += side.points;
      if (side.result === 'won') { standing.won++; } else if (side.result === 'lost') { standing.lost++; } else { standing.drawn++; }
    }
  }
  return standings;
}

/** Schlüssel je Team für ein Kriterium (größer = besser); `null` = Kriterium wirkt hier nicht. */
function keyOf(criterionId: string, block: readonly Standing[], input: RankGroupInput): ((s: Standing) => Key) | null {
  switch (criterionId) {
    case 'points': return (s) => [s.points];
    case 'goalDifference': return (s) => [s.goalDifference];
    case 'goalsFor': return (s) => [s.goalsFor];
    case 'goalsAgainst': return (s) => [-s.goalsAgainst];
    case 'wins': return (s) => [s.won];
    case 'directComparison': {
      if (input.mode === 'crossGroup') {
        return null;
      }
      const mini = miniTable(block.map((s) => s.team.id), input.matches, input.pointSystem);
      return (s) => miniTableKey(mini.get(s.team.id));
    }
    default: return null;
  }
}

function compareKeysDesc(a: Key, b: Key): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** Teilt einen Block nach dem Schlüssel in Teilblöcke (bester zuerst); innerhalb eines Teilblocks Eingabereihenfolge. */
function splitBlock(block: Standing[], key: (s: Standing) => Key): Standing[][] {
  const groups: Array<{ key: Key; members: Standing[] }> = [];
  for (const standing of block) {
    const k = key(standing);
    const existing = groups.find((g) => compareKeysDesc(g.key, k) === 0);
    if (existing === undefined) {
      groups.push({ key: k, members: [standing] });
    } else {
      existing.members.push(standing);
    }
  }
  return groups.sort((a, b) => compareKeysDesc(a.key, b.key)).map((g) => g.members);
}

/** Zeilen eines Blocks mit gültiger Entscheidung: geordnet (Strafstoßschießen/Reihenfolge) oder gemeinsam (`shared`). */
function decidedRows(block: readonly Standing[], decision: StandingDecision, place: number): GroupTableRow[] {
  if (decision.kind === 'shared') {
    const tieBlock = block.map((s) => s.team.id);
    return block.map((s) => ({ ...s, place, decisionNeeded: false, tieBlock: [...tieBlock], decision }));
  }
  const rank = (s: Standing): number => decision.order.indexOf(s.team.id);
  return [...block].sort((a, b) => rank(a) - rank(b))
    .map((s, i) => ({ ...s, place: place + i, decisionNeeded: false, decision }));
}

/** Rechnet die Tabelle einer Gruppe (bzw. gruppenübergreifend) nach der eingestellten Reihenfolge. */
export function rankGroup(input: RankGroupInput): GroupTableResult {
  const standings = overallStandings(input.teams, input.matches, input.pointSystem);
  let blocks: Standing[][] = standings.length > 0 ? [standings] : [];
  for (const criterion of input.placementLogic.filter((c) => c.enabled)) {
    blocks = blocks.flatMap((block) => {
      const key = block.length > 1 ? keyOf(criterion.id, block, input) : null;
      return key === null ? [block] : splitBlock(block, key);
    });
  }

  // Ohne Spiele ist nichts entschieden (sonst stünden vor dem ersten Spiel alle Teams „gleichauf“).
  const allGroupMatchesDecided = input.matches.length > 0 && input.matches.every(isGroupMatchDecided);
  const rows: GroupTableRow[] = [];
  const openTies: string[][] = [];
  const applied = new Set<string>();
  for (const block of blocks) {
    const place = rows.length + 1;
    if (block.length > 1 && input.mode === 'group') {
      const ids = block.map((s) => s.team.id);
      // Nicht mehr erlaubte Annahmen scheiden VOR der Suche aus, sonst verdeckten sie ein späteres Strafstoßschießen;
      // von den gültigen gilt die neueste (Review TB-3' B1, gilt nach Vorschlag).
      const mayShare = blockMayShare(input.placesToPlayOut, input.followUpRanks, { place, size: block.length });
      const candidates = input.decisions.filter((d) => d.kind !== 'shared' || mayShare).reverse();
      const decision = findValidDecision(candidates, input.groupId, ids, decisionBasis(input, ids));
      if (decision !== undefined) {
        applied.add(decision.id);
        rows.push(...decidedRows(block, decision, place));
        continue;
      }
    }
    const open = block.length > 1;
    const tieBlock = open ? block.map((s) => s.team.id) : undefined;
    if (open && input.mode === 'group') {
      openTies.push(block.map((s) => s.team.id));
    }
    for (const standing of block) {
      rows.push({
        ...standing,
        place,
        decisionNeeded: open && input.mode === 'group' && allGroupMatchesDecided,
        ...(tieBlock !== undefined ? { tieBlock: [...tieBlock] } : {}),
      });
    }
  }
  const staleDecisionIds = input.mode === 'group'
    ? input.decisions.filter((d) => d.groupId === input.groupId && !applied.has(d.id)).map((d) => d.id)
    : [];
  return { groupId: input.groupId, rows, allGroupMatchesDecided, openTies, staleDecisionIds };
}
