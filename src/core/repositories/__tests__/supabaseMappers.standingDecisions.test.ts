/**
 * Paket TB, Task TB-3: Entscheidungen über Gleichstände reisen im `tournaments.config`-JSONB (keine Migration, R-TB-3).
 * Hin- und Rückweg über eine echte JSON-Grenze; Zod lehnt unbekannte Felder einer Entscheidung ab.
 */
import { describe, expect, it } from 'vitest';
import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { StandingDecisionSchema } from '../../models/schemas/StandingDecisionSchema';
import { TournamentSchema } from '../../models/schemas/TournamentSchema';
import { createTournamentRow, type TournamentRow } from '../../../../tests/factories/supabase';
import type { StandingDecision } from '../../../types/tournament';
import { testUuid } from '../../../test/testIds';
import { DATA, league } from '../../standings/__tests__/fixtures';

const ENTSCHEIDUNG: StandingDecision = {
  id: 'e-1', groupId: '', teamIds: [testUuid(7), testUuid(8)], order: [testUuid(8), testUuid(7)], kind: 'shootout',
  shootout: { winner: 4, loser: 3 }, basis: '{"points":[3,1,0]}',
};

function roundTrip(raw: object) {
  const config = JSON.parse(JSON.stringify(raw)) as TournamentRow['config'];
  const tournament = mapTournamentFromSupabase(createTournamentRow({ config }), [], []);
  const { tournamentRow } = mapTournamentToSupabase(tournament, 'user-1');
  const wire = JSON.parse(JSON.stringify(tournamentRow)) as Pick<TournamentRow, 'config'>;
  return { tournament, wire, back: mapTournamentFromSupabase(createTournamentRow({ config: wire.config }), [], []) };
}

describe('TB-3 Entscheidungen im config (Mapper, Zod)', () => {
  it('Cloud-Zeile → Turnier → Zeile: die Entscheidung bleibt gleich', () => {
    const { tournament, wire, back } = roundTrip({ standingDecisions: [ENTSCHEIDUNG] });
    expect(tournament.standingDecisions).toEqual([ENTSCHEIDUNG]);
    expect((wire.config as { standingDecisions?: unknown }).standingDecisions).toEqual([ENTSCHEIDUNG]);
    expect(back.standingDecisions).toEqual([ENTSCHEIDUNG]);
    // Gegenbeispiel: ohne Entscheidungen bleibt das Feld leer (nichts erfunden).
    expect(roundTrip({}).back.standingDecisions).toBeUndefined();
  });

  it('Zod lehnt unbekannte Felder ab; eine fehlerhafte Entscheidung fällt beim Lesen weg, die übrigen bleiben', () => {
    expect(StandingDecisionSchema.safeParse(ENTSCHEIDUNG).success).toBe(true);
    expect(StandingDecisionSchema.safeParse({ ...ENTSCHEIDUNG, spielerName: 'Max' }).success).toBe(false);
    expect(StandingDecisionSchema.safeParse({ ...ENTSCHEIDUNG, kind: 'los' }).success).toBe(false);
    // TB-3': Person, Zeit und Grund gehören nicht mehr ins config (@W2A-072) – Altwerte fallen weg
    // (`supabaseMappers.ausspielPlaetze.test.ts`).

    const { tournament } = roundTrip({ standingDecisions: [{ ...ENTSCHEIDUNG, id: 'kaputt', extra: 1 }, ENTSCHEIDUNG] });
    expect(tournament.standingDecisions?.map((d) => d.id)).toEqual(['e-1']);
    // Turnier-Schema: Entscheidungen werden geprüft, unbekannte Felder darin abgelehnt.
    const turnier = { ...league('RKMUNO', DATA.ET_055).tournament, sportId: 'football-indoor' };
    // Review TB-A Auflage 9: je Eintrag filtern – ein fehlerhafter Eintrag nimmt die gültigen nicht mit.
    const parsed = TournamentSchema.safeParse({ ...turnier, standingDecisions: [{ ...ENTSCHEIDUNG, id: 'kaputt', extra: 1 }, ENTSCHEIDUNG] });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.standingDecisions).toEqual([ENTSCHEIDUNG]);
    expect(TournamentSchema.safeParse({ ...turnier, standingDecisions: 'kein Feld' }).data?.standingDecisions).toBeUndefined();
    expect(TournamentSchema.safeParse({ ...turnier, standingDecisions: [ENTSCHEIDUNG] }).data?.standingDecisions).toEqual([ENTSCHEIDUNG]);
  });
});
