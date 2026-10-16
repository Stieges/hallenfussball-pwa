import { describe, it, expect } from 'vitest';
import type { Match, Team } from '../../../types/tournament';
import { sideLabel, replaceSides } from '../utils/matchSides';
import { vs, slots } from '../../../test/matchSlotFixtures';
import { testUuid } from '../../../test/testIds';
import { mapMatchFromSupabase, mapMatchUpdateToSupabase } from '../../../core/repositories/supabaseMappers';
import { matchSideTeamId, resolveSlot, teamSlot } from '../../../core/models/matchSlot';

const teams: Team[] = [
  { id: testUuid(1), name: 'A' },
  { id: testUuid(2), name: 'B' },
];
const match: Match = {
  id: 'm1',
  round: 1,
  field: 1,
  ...vs(testUuid(1), testUuid(2)),
};

describe('matchSides – Ein-Stellen-Regel Wizard', () => {
  it('sideLabel liest die Seiten über den Adapter', () => {
    expect(sideLabel(match, 'A', teams)).toBe('A');
    expect(sideLabel(match, 'B', teams)).toBe('B');
  });

  it('sideLabel zeigt unbekannte Teams als ID', () => {
    const unknown: Match = { ...match, ...vs(testUuid(9), testUuid(2)) };
    expect(sideLabel(unknown, 'A', teams)).toBe(testUuid(9));
  });

  it('replaceSides ersetzt nur die betroffene Seite', () => {
    const replaced = replaceSides(match, testUuid(1), testUuid(9));
    expect(matchSideTeamId(replaced, 'A')).toBe(testUuid(9));
    expect(matchSideTeamId(replaced, 'B')).toBe(testUuid(2));
  });

  it('@W5-010 resolvedFrom: nach manuellem Wechsel ist die Herkunft weg und das neue Team bleibt nach Cloud-Abbildung', () => {
    const resolvedMatch: Match = {
      id: 'm2',
      round: 1,
      field: 1,
      ...slots(
        resolveSlot({ kind: 'groupRank', group: 'A', rank: 1 }, testUuid(1)),
        teamSlot(testUuid(2))
      ),
    };
    const replaced = replaceSides(resolvedMatch, testUuid(1), testUuid(9));
    // A-36b: Ersatzteam (@W5-010) trägt das lokale Merkmal 'replaced' – die Herkunft gilt für es weiter (F1).
    expect(replaced.slotA).toEqual({ kind: 'team', teamId: testUuid(9), assignedBy: 'replaced' });
    expect(replaced.slotA).not.toHaveProperty('resolvedFrom');

    const update = mapMatchUpdateToSupabase(replaced);
    const row = {
      id: replaced.id,
      round: replaced.round,
      field: replaced.field,
      team_a_id: update.team_a_id ?? null,
      team_b_id: update.team_b_id ?? null,
      slot_a_source: update.slot_a_source ?? null,
      slot_b_source: update.slot_b_source ?? null,
    } as unknown as Parameters<typeof mapMatchFromSupabase>[0];
    const back = mapMatchFromSupabase(row);
    expect(matchSideTeamId(back, 'A')).toBe(testUuid(9));
    expect(back.slotA).toEqual({ kind: 'team', teamId: testUuid(9) });
  });
});
