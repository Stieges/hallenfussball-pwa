/**
 * Test-Helfer für Spielseiten als Slot (A-03). Nur Testumgebung.
 *
 * `vs(a, b)` baut die beiden Seiten eines Spiels aus Team-IDs (UUIDs – Teamnamen und Kurz-IDs lehnt
 * `teamSlot` ab, wie im Produktivcode). Das Übergangsfeld `teamA/teamB` (Löschen in B-35) wird wie im
 * Produktivcode über `transitionalSides` aus den Slots abgeleitet.
 */
import type { Match } from '../types/tournament';
import { teamSlot, pendingSlot, transitionalSides } from '../core/models/matchSlot';
import type { MatchSlot, SlotSource, TeamId } from '../core/models/schemas/MatchSlotSchema';
import { testUuid } from './testIds';

export { testUuid };

type Sides = Pick<Match, 'teamA' | 'teamB' | 'slotA' | 'slotB'>;

/** Zwei besetzte Seiten aus Team-IDs. */
export function vs(teamIdA: string, teamIdB: string): Sides {
  return slots(teamSlot(teamIdA), teamSlot(teamIdB));
}

/** Zwei Seiten aus beliebigen Slots (Übergangsfeld `teamA/teamB` über `transitionalSides`). */
export function slots(slotA: MatchSlot, slotB: MatchSlot): Sides {
  return { ...transitionalSides(slotA, slotB), slotA, slotB };
}

export function groupRank(group: string, rank: number): MatchSlot {
  return pendingSlot({ kind: 'groupRank', group, rank });
}

export function resultOf(matchId: string, role: 'winner' | 'loser'): MatchSlot {
  const source: SlotSource = { kind: 'matchResult', matchId, role };
  return pendingSlot(source);
}

/**
 * Besetzte Seite aus einer Fixture-Kurz-ID wie `'team-1'` oder `'teamA'` (keine UUID – dafür `vs`/`teamSlot`).
 * Nur für Tests, die die ID als undurchsichtigen Text nutzen (Engine-/Hook-Tests). Platzhaltertexte
 * (`TBD`, `group-a-1st`, `semi1-winner`) ergeben eine offene Seite mit Dummy-Herkunft „Erster Gruppe A“ – die
 * echte Herkunft des Platzhalters wird NICHT abgeleitet; Tests, die die Herkunft prüfen, nutzen `groupRank`/`resultOf`.
 */
export function testTeamSlot(ref: string): MatchSlot {
  if (ref === 'TBD' || ref.includes('group-') || ref.endsWith('-winner') || ref.endsWith('-loser')) {
    return groupRank('A', 1);
  }
  return { kind: 'team', teamId: ref as TeamId };
}

/** Wie `vs`, aber für Kurz-IDs (siehe `testTeamSlot`). */
export function looseVs(refA: string, refB: string): Sides {
  return slots(testTeamSlot(refA), testTeamSlot(refB));
}
