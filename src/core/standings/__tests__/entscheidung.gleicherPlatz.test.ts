/**
 * Paket TB, Task TB-3: „gleichen Platz lassen“ (Daniel F4 Variante C, Regel `sharedPlaceAllowed`) – nur bei einem Platz
 * ohne Folgespiel und nicht bei Platz 1, Grund Pflicht. Record `2026-09-27_wizard-regelinhalte` (@W2A-063, @W2A-064,
 * @W2A-065); Tabellenteil von @ET-020 und @ET-029 (`2026-10-01_endstand-und-torschuetzen`, Endstand folgt in TB-4).
 * Daten gegengerechnet (Referenzrechnung, Report TB-3).
 */
import { describe, expect, it } from 'vitest';
import { calculateStandings } from '../../../utils/calculations';
import { sharedPlaceAllowed } from '../decisions';
import type { Standing, Tournament } from '../../../types/tournament';
import { DATA, id, type Key } from './fixtures';
import { jgj, lage048, MemoryRepo, OLLI, shared, shootout } from './decisionTestKit';

/** @W2A-063: Mitte 9, Nord 9, Ufer 8, West 5, Waging blau und Petting als einzige je 4 Punkte, gleich auf 5 und 6. */
const DATEN_063 = 'M–N 1:1; M–U 1:1; M–W 1:1; M–X 3:0; M–P 3:0; N–U 1:1; N–W 1:1; N–X 1:0; N–P 1:0; U–W 2:1; U–X 2:0; P–U 1:0; W–P 2:0; X–W 1:0; X–P 1:1';
/** @W2A-064 Zeile 1 / @ET-027: Mitte und Nord gleich auf Platz 1 (direkt 2:2). */
const DATEN_PLATZ_1 = 'M–N 2:2; M–W 1:0; M–O 1:0; M–U 1:0; M–B 1:0; N–W 1:0; N–O 1:0; N–U 1:0; N–B 1:0; W–O 1:0; W–U 1:0; W–B 1:0; O–U 1:0; O–B 1:0; U–B 1:0';
/** @ET-029: Mitte allein auf 1, Nord und Ufer gleich auf 2 und 3. */
const DATEN_029 = 'M–N 1:0; M–U 1:0; M–W 1:0; M–O 1:0; M–B 1:0; N–U 1:1; N–W 1:0; N–O 1:0; N–B 1:0; U–W 1:0; U–O 1:0; U–B 1:0; W–O 1:0; W–B 1:0; O–B 1:0';

const table = (t: Tournament, group?: string): Standing[] => calculateStandings(t.teams, t.matches, t, group);
const row = (rows: Standing[], key: Key): Standing => {
  const found = rows.find((r) => r.team.id === id(key));
  if (found === undefined) { throw new Error(`Team ${key} fehlt`); }
  return found;
};

describe('TB-3 „gleichen Platz lassen“ (Variante C)', () => {
  it('@W2A-063 Platz 5/6 ohne Folgespiel: erlaubt; mit Grund stehen beide ohne Markierung auf Platz 5, Wahl mit Grund, Person, Zeit', async () => {
    const repo = new MemoryRepo(jgj('MNUWXP', DATEN_063));
    const vorher = table(repo.tournament);
    expect([row(vorher, 'X').place, row(vorher, 'P').place]).toEqual([5, 5]);
    expect([row(vorher, 'X').decisionNeeded, row(vorher, 'P').decisionNeeded]).toEqual([true, true]);
    expect(sharedPlaceAllowed(repo.tournament, '', { place: 5, size: 2 })).toBe(true);

    const result = await repo.service().decide(repo.tournament.id, shared(['X', 'P'], 'Hallenzeit zu Ende'), OLLI);
    expect(result.ok).toBe(true);
    const rows = table(repo.tournament);
    expect([row(rows, 'X').place, row(rows, 'P').place]).toEqual([5, 5]);
    expect([row(rows, 'X').decisionNeeded, row(rows, 'P').decisionNeeded]).toEqual([false, false]);
    expect(row(rows, 'X').decision).toMatchObject({ kind: 'shared', reason: 'Hallenzeit zu Ende', decidedBy: { name: 'Olli' }, decidedAt: '2026-12-06T14:32:00.000Z' });
    // Gegenbeispiel: ohne „gleichen Platz lassen“ bleibt der Block markiert, nichts wird still geteilt.
    expect(row(table({ ...repo.tournament, standingDecisions: [] }), 'X').decisionNeeded).toBe(true);
    // Das Strafstoßschießen bleibt daneben möglich (Normalweg).
    const zweite = new MemoryRepo(jgj('MNUWXP', DATEN_063));
    expect((await zweite.service().decide(zweite.tournament.id, shootout('P', 'X', 5, 4), OLLI)).ok).toBe(true);
    expect([row(table(zweite.tournament), 'P').place, row(table(zweite.tournament), 'X').place]).toEqual([5, 6]);
  });

  it.each([
    { lage: 'Jeder gegen jeden, SG Mitte und FC Nord gleich auf Platz 1 und 2', bau: () => jgj('MNWOUB', DATEN_PLATZ_1), paar: ['M', 'N'] as Key[], gruppe: '', block: { place: 1, size: 2 } },
    { lage: '@W2A-048: SV Süd und TSV West gleich auf 2 und 3, „Zweiter Gruppe A“ ist Herkunft in Halbfinale 2', bau: lage048, paar: ['S', 'W'] as Key[], gruppe: 'A', block: { place: 2, size: 2 } },
  ])('@W2A-064 nur das Strafstoßschießen, kein „gleichen Platz lassen“: $lage', async ({ bau, paar, gruppe, block }) => {
    const repo = new MemoryRepo(bau());
    const rows = table(repo.tournament, gruppe === '' ? undefined : gruppe);
    expect(paar.map((k) => row(rows, k).decisionNeeded)).toEqual([true, true]);
    expect(paar.map((k) => row(rows, k).place)).toEqual([block.place, block.place]);
    expect(sharedPlaceAllowed(repo.tournament, gruppe, block)).toBe(false);

    const result = await repo.service().decide(repo.tournament.id, shared(paar, 'Hallenzeit zu Ende', gruppe), OLLI);
    expect(result).toEqual({ ok: false, code: 'SHARED_PLACE_NOT_ALLOWED' });
    expect(repo.writes).toBe(0);
    // Gegenbeispiel: das Strafstoßschießen nimmt die App an.
    expect((await repo.service().decide(repo.tournament.id, shootout(paar[1], paar[0], 4, 3, gruppe), OLLI)).ok).toBe(true);
  });

  it('@W2A-065 ohne Grund lässt die App den gleichen Platz nicht stehen', async () => {
    const repo = new MemoryRepo(jgj('MNUWXP', DATEN_063));
    for (const reason of [undefined, '', '   ']) {
      expect(await repo.service().decide(repo.tournament.id, shared(['X', 'P'], reason), OLLI)).toEqual({ ok: false, code: 'REASON_REQUIRED' });
    }
    expect(repo.writes).toBe(0);
    expect(row(table(repo.tournament), 'X').decisionNeeded).toBe(true);
    // Gegenbeispiel: mit Grund angenommen.
    expect((await repo.service().decide(repo.tournament.id, shared(['X', 'P'], 'Hallenzeit zu Ende'), OLLI)).ok).toBe(true);
  });

  it('@ET-020:teil drei Teams auf Platz 2 bis 4 lassen den gleichen Platz: alle auf 2, das nächste Team auf 5 (Tabelle)', async () => {
    const repo = new MemoryRepo(jgj('WOUMNB', DATA.W2A_044));
    expect((await repo.service().decide(repo.tournament.id, shared(['U', 'W', 'O'], 'Hallenzeit zu Ende'), OLLI)).ok).toBe(true);
    const rows = table(repo.tournament);
    expect(['U', 'W', 'O'].map((k) => row(rows, k as Key).place)).toEqual([2, 2, 2]);
    expect(row(rows, 'B').place).toBe(5);
    expect(rows.some((r) => r.decisionNeeded === true)).toBe(false);
  });

  it('@ET-029:teil Nord und Ufer lassen den gleichen Platz 2: beide auf 2, das nächste Team auf 4, kein Strafstoßschießen erzwungen', async () => {
    const repo = new MemoryRepo(jgj('MNUWOB', DATEN_029));
    expect(sharedPlaceAllowed(repo.tournament, '', { place: 2, size: 2 })).toBe(true);
    expect((await repo.service().decide(repo.tournament.id, shared(['N', 'U'], 'Hallenzeit zu Ende'), OLLI)).ok).toBe(true);
    const rows = table(repo.tournament);
    expect([row(rows, 'M').place, row(rows, 'N').place, row(rows, 'U').place, row(rows, 'W').place]).toEqual([1, 2, 2, 4]);
    expect(row(rows, 'U').decision).toMatchObject({ kind: 'shared', reason: 'Hallenzeit zu Ende', decidedBy: { name: 'Olli' } });
  });
});
