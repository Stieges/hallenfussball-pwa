/**
 * Test-Helfer für Spielseiten als Slot (A-03). Nur Testumgebung.
 *
 * `vs(a, b)` baut die beiden Seiten eines Spiels aus Team-IDs (UUIDs – Teamnamen und Kurz-IDs lehnt
 * `teamSlot` ab, wie im Produktivcode). Das Übergangsfeld `teamA/teamB` (bis A-04b Pflicht) wird mit der
 * Team-ID parallel befüllt, wie es die Generatoren tun.
 */
import type { Match } from '../types/tournament';
import { teamSlot, pendingSlot } from '../core/models/matchSlot';
import type { MatchSlot, SlotSource, TeamId } from '../core/models/schemas/MatchSlotSchema';
import { testUuid } from './testIds';

export { testUuid };

type Sides = Pick<Match, 'teamA' | 'teamB' | 'slotA' | 'slotB'>;

/** Zwei besetzte Seiten aus Team-IDs. */
export function vs(teamIdA: string, teamIdB: string): Sides {
  return { teamA: teamIdA, teamB: teamIdB, slotA: teamSlot(teamIdA), slotB: teamSlot(teamIdB) };
}

/** Zwei Seiten aus beliebigen Slots (Übergangsfeld `teamA/teamB` = Team-ID bzw. der Text „TBD“). */
export function slots(slotA: MatchSlot, slotB: MatchSlot): Sides {
  const legacy = (slot: MatchSlot) => (slot.kind === 'team' ? slot.teamId : 'TBD');
  return { teamA: legacy(slotA), teamB: legacy(slotB), slotA, slotB };
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
 * (`TBD`, `group-a-1st`, `semi1-winner`) ergeben keinen Slot.
 */
export function testTeamSlot(ref: string): MatchSlot | undefined {
  if (ref === 'TBD' || ref.includes('group-') || ref.endsWith('-winner') || ref.endsWith('-loser')) {
    return undefined;
  }
  return { kind: 'team', teamId: ref as TeamId };
}

/** Wie `vs`, aber für Kurz-IDs (siehe `testTeamSlot`). */
export function looseVs(refA: string, refB: string): Sides {
  return { teamA: refA, teamB: refB, slotA: testTeamSlot(refA), slotB: testTeamSlot(refB) };
}
