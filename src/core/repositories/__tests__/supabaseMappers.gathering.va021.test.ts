/**
 * A1 Veranstaltung (Record docs/anforderungen/2026-11-06_veranstaltung-mehrere-turniere.md, Umsetzungsvorgabe A1, GATE 2
 * Nr. 10): die Zuordnung eines Turniers zur Veranstaltung (`tournaments.gathering_id`) schreibt allein der Server.
 *
 * @VA-021 Z. 3 „Ollis Tablet, das F2 zuletzt vor der Zuordnung geladen hat, bearbeitet das Turnier ohne Netz und gleicht danach
 * ab → F2 gehört weiter zu Ollis Veranstaltung“: Das Speichern darf das Feld deshalb nie mitschicken – weder mit dem alten
 * Wert (NULL) noch mit einem gelesenen. Gelesen wird es (Startseite, Verweis auf der Turnierseite).
 * @VA-020 „Die Kopie eines Turniers gehört zu keiner Veranstaltung, das Original bleibt“ (Client-Teil; der Server setzt das
 * Feld beim Anlegen ohnehin auf NULL, belegt in scripts/gatherings-check.sh).
 */
import { describe, expect, it } from 'vitest';
import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { buildCopiedTournament } from '../../models/tournamentCopy';
import { TournamentSchema } from '../../models/schemas/TournamentSchema';
import { createTournamentRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';

const VERANSTALTUNG = testUuid(4711);
const OLLI = testUuid(1);

describe('@VA-021 Zuordnung zur Veranstaltung: lesen ja, schreiben nie', () => {
  const zugeordnet = mapTournamentFromSupabase(createTournamentRow({ gathering_id: VERANSTALTUNG }), [], []);

  it('der Mapper liest die Veranstaltung aus der Cloud', () => {
    expect(zugeordnet.gatheringId).toBe(VERANSTALTUNG);
  });

  it('ein Turnier ohne Veranstaltung trägt kein Feld (die Seite sieht aus wie bisher, @VA-013 Z. 4)', () => {
    const ohne = mapTournamentFromSupabase(createTournamentRow({ gathering_id: null }), [], []);
    expect(ohne).not.toHaveProperty('gatheringId');
  });

  it('@VA-021 Z. 3 Speichern gibt gathering_id nie aus – auch nicht, wenn das Gerät eine Zuordnung gelesen hat', () => {
    const { tournamentRow } = mapTournamentToSupabase(zugeordnet, OLLI);
    expect(tournamentRow).not.toHaveProperty('gathering_id');
  });

  it('@VA-021 Z. 3 auch ein altes Gerät ohne Zuordnung schickt kein gathering_id = NULL', () => {
    const alt = mapTournamentFromSupabase(createTournamentRow({ gathering_id: null }), [], []);
    const { tournamentRow } = mapTournamentToSupabase({ ...alt, gatheringId: undefined }, OLLI);
    expect(Object.keys(tournamentRow)).not.toContain('gathering_id');
  });

  it('die lokale Kopie behält das gelesene Feld (das Schema der lokalen Datenhaltung kennt es)', () => {
    expect(TournamentSchema.pick({ gatheringId: true }).parse({ gatheringId: VERANSTALTUNG })).toEqual({ gatheringId: VERANSTALTUNG });
  });
});

describe('@VA-020 Kopie eines Turniers einer Veranstaltung', () => {
  const original = mapTournamentFromSupabase(createTournamentRow({ gathering_id: VERANSTALTUNG }), [], []);
  let n = 5000;
  const kopie = buildCopiedTournament(original, {
    newId: testUuid(4800), title: 'F2-Junioren (Kopie)', now: '2026-11-06T10:00:00.000Z', makeId: () => testUuid(n++),
  });

  it('die Kopie gehört zu keiner Veranstaltung', () => {
    expect(kopie.gatheringId).toBeUndefined();
  });

  it('das Original bleibt in der Veranstaltung', () => {
    expect(original.gatheringId).toBe(VERANSTALTUNG);
  });
});
