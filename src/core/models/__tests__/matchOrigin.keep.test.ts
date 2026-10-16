/**
 * A-36a (MVP-Bauplan § 23, Brief Schritt 3): Herkunft des Platzes bleibt am Spiel.
 *
 * - Mapper-Rundlauf `mapMatchToSupabase → mapMatchFromSupabase` und lokale Ablage (Zod) erhalten sie.
 * - Automatisches Besetzen (`resolvePlayoffPairings`) und „Neu besetzen“ (`assignTeamToSide`) lassen sie
 *   unverändert – die Herkunft gehört zum PLATZ, nicht zum Team (@BM-014, Regel „Neu besetzen“
 *   Turniermodi Z.106/128, Szenario L2 folgt per Record-Nachzug).
 * - Die Turnier-Kopie lässt sie auf die NEUEN Spiel-IDs zeigen.
 * - Ungültige Herkunft aus der Cloud: `originA` fehlt, Meldung über `captureFeatureError` (Bereich sync),
 *   das Spiel selbst bleibt stehen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureFeatureError = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/sentry', () => ({ captureFeatureError }));

import type { Match, Team, Tournament } from '../../../types/tournament';
import { resolvePlayoffPairings } from '../../generators';
import { assignTeamToSide } from '../matchAssignment';
import { copyTeamsAndMatches } from '../tournamentCopy';
import { MatchSchema } from '../schemas/TournamentSchema';
import { mapMatchFromSupabase, mapMatchToSupabase } from '../../repositories/supabaseMappers';
import { createMockTournament } from '../../../test/factories';
import { slots, testUuid, vs } from '../../../test/matchSlotFixtures';
import { pendingSlot } from '../matchSlot';
import type { SlotSource } from '../schemas/MatchSlotSchema';
import { createMatchRow } from '../../../../tests/factories/supabase';

const [A1, A2, B1, B2, WEST] = [1, 2, 3, 4, 5].map(testUuid);
const SEMI1 = testUuid(201);
const SEMI2 = testUuid(202);
const FINAL = testUuid(203);

const teams: Team[] = [
  { id: A1, name: 'FC Nord', group: 'A' },
  { id: A2, name: 'SV Ost', group: 'A' },
  { id: B1, name: 'TSV Süd', group: 'B' },
  { id: B2, name: 'SC Mitte', group: 'B' },
  { id: WEST, name: 'TSV West' },
];

const groupMatch = (id: string, a: string, b: string, group: string, score: [number, number]): Match => ({
  id, round: 1, field: 1, group, isFinal: false, ...vs(a, b), scoreA: score[0], scoreB: score[1],
});

const groupRank = (group: string, rank: number): SlotSource => ({ kind: 'groupRank', group, rank });
const resultOf = (matchId: string, role: 'winner' | 'loser'): SlotSource => ({ kind: 'matchResult', matchId, role });

/** Finalspiel wie der Generator: offener Slot und Herkunft des Platzes aus derselben Definition. */
function finalMatch(id: string, label: string, a: SlotSource, b: SlotSource): Match {
  return { id, round: 2, field: 1, isFinal: true, label, ...slots(pendingSlot(a), pendingSlot(b)), originA: a, originB: b };
}

function hallencup(): Tournament {
  return createMockTournament({
    teams,
    groupSystem: 'groupsAndFinals',
    numberOfFields: 2,
    matches: [
      groupMatch(testUuid(301), A1, A2, 'A', [2, 1]),
      groupMatch(testUuid(302), B1, B2, 'B', [3, 0]),
      finalMatch(SEMI1, '1. Halbfinale', groupRank('A', 1), groupRank('B', 2)),
      finalMatch(SEMI2, '2. Halbfinale', groupRank('B', 1), groupRank('A', 2)),
      finalMatch(FINAL, 'Finale', resultOf(SEMI1, 'winner'), resultOf(SEMI2, 'winner')),
    ],
  });
}

const byId = (t: { matches: Match[] }, id: string): Match => {
  const match = t.matches.find((m) => m.id === id);
  if (!match) {
    throw new Error(`Spiel ${id} fehlt`);
  }
  return match;
};

beforeEach(() => {
  captureFeatureError.mockClear();
});

describe('A-36a Herkunft des Platzes bleibt nach dem Besetzen', () => {
  it('@BM-014 automatisches Besetzen (F-HF): HF1-Heim ist FC Nord, originA bleibt „Erster Gruppe A“', () => {
    const t = hallencup();
    const result = resolvePlayoffPairings(t);

    expect(result.wasResolved).toBe(true);
    const hf1 = byId(t, SEMI1);
    expect(hf1.slotA).toEqual({ kind: 'team', teamId: A1, resolvedFrom: groupRank('A', 1) });
    expect(hf1.originA).toEqual(groupRank('A', 1));
    expect(hf1.originB).toEqual(groupRank('B', 2));
  });

  it('@BM-014 Turniermodi Z.106 „Neu besetzen“ (F-NEU): TSV West auf HF2-Heim, originA bleibt „Erster Gruppe B“', () => {
    const hf2 = byId(hallencup(), SEMI2);
    const reassigned = assignTeamToSide(hf2, 'A', WEST);

    expect(reassigned.slotA).toEqual({ kind: 'team', teamId: WEST });
    expect(reassigned.originA).toEqual(groupRank('B', 1));
    expect(reassigned.originB).toEqual(groupRank('A', 2));
  });
});

describe('A-36a Herkunft des Platzes in Ablage, Cloud-Zeile und Kopie', () => {
  it('@DR-005 Mapper-Rundlauf mapMatchToSupabase → mapMatchFromSupabase erhält originA/originB', () => {
    const final = byId(hallencup(), FINAL);
    const row = createMatchRow({ ...mapMatchToSupabase(final, 'tournament-1') });

    const back = mapMatchFromSupabase(row);

    expect(back.originA).toEqual(resultOf(SEMI1, 'winner'));
    expect(back.originB).toEqual(resultOf(SEMI2, 'winner'));
    expect(captureFeatureError).not.toHaveBeenCalled();
  });

  it('@DR-005 auch nach Neu-Besetzen (slot_a_source NULL) liefert die Cloud-Zeile die Herkunft des Platzes', () => {
    const reassigned = assignTeamToSide(byId(hallencup(), SEMI1), 'A', WEST);
    const row = createMatchRow({ ...mapMatchToSupabase(reassigned, 'tournament-1') });

    expect(row.slot_a_source).toBeNull();
    expect(mapMatchFromSupabase(row).originA).toEqual(groupRank('A', 1));
  });

  it('Gegenbeispiel: Gruppenspiel-Zeile ohne origin_* liefert kein originA (kein Schlüssel)', () => {
    const back = mapMatchFromSupabase(createMatchRow({ id: testUuid(301), team_a_id: A1, team_b_id: A2 }));
    expect('originA' in back).toBe(false);
    expect('originB' in back).toBe(false);
  });

  it('Fehlerpolitik: ungültige Herkunft aus der Cloud → originA fehlt, Meldung im Bereich sync, Spiel bleibt', () => {
    const row = createMatchRow({
      id: SEMI1,
      slot_a_source: groupRank('A', 1),
      slot_b_source: groupRank('B', 2),
      ...{ origin_a: { kind: 'groupRank', group: 'A', rank: 0 }, origin_b: groupRank('B', 2) },
    });

    const back = mapMatchFromSupabase(row);

    expect(back.id).toBe(SEMI1);
    expect(back.slotA).toEqual({ kind: 'pending', source: groupRank('A', 1) });
    expect('originA' in back).toBe(false);
    expect(back.originB).toEqual(groupRank('B', 2));
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
    expect(captureFeatureError.mock.calls[0][1]).toBe('sync');
  });

  it('@DR-005 lokale Ablage: MatchSchema (Zod) behält originA/originB', () => {
    const parsed = MatchSchema.parse(byId(hallencup(), FINAL));
    expect(parsed.originA).toEqual(resultOf(SEMI1, 'winner'));
    expect(parsed.originB).toEqual(resultOf(SEMI2, 'winner'));
  });

  it('@DR-005 Turnier-Kopie: originA des Finales zeigt auf die NEUE Spiel-ID des Halbfinales', () => {
    const source = hallencup();
    let n = 900;
    const copy = copyTeamsAndMatches(source, () => testUuid(++n));
    const sourceIndex = source.matches.findIndex((m) => m.id === SEMI1);
    const newSemi1 = copy.matches[sourceIndex].id;
    const newFinal = copy.matches[source.matches.findIndex((m) => m.id === FINAL)];

    expect(newSemi1).not.toBe(SEMI1);
    expect(newFinal.originA).toEqual(resultOf(newSemi1, 'winner'));
    expect(copy.matches[sourceIndex].originA).toEqual(groupRank('A', 1));
    expect('originA' in copy.matches[0]).toBe(false);
  });
});
