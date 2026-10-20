/**
 * Paket TB, Task TB-3/TB-3': „Ergebnis so akzeptieren“ (Daniel 2026-10-20, ersetzt „gleichen Platz lassen“ aus Variante C)
 * – ohne Grund, ein Tipp; erlaubt, wenn kein Platz des Blocks ausgespielt werden muss und keiner in ein weiteres Spiel
 * führt (`sharedPlaceAllowed`, Regeln und Grundriss in `ausspielPlaetze.test.ts`). Tabellenteil von @ET-020 und @ET-029
 * (`2026-10-01_endstand-und-torschuetzen`, Endstand in TB-4); Voreinstellung „nur Platz 1“. @W2A-065 (Pflicht-Grund)
 * entfällt (Daniel B4d). Daten gegengerechnet (Referenzrechnung, Report TB-3).
 */
import { describe, expect, it } from 'vitest';
import { calculateStandings } from '../../../utils/calculations';
import { sharedPlaceAllowed } from '../decisions';
import type { Standing, Tournament } from '../../../types/tournament';
import { DATA, id, type Key } from './fixtures';
import { jgj, MemoryRepo, shared } from './decisionTestKit';

/** @ET-029: Mitte allein auf 1, Nord und Ufer gleich auf 2 und 3. */
const DATEN_029 = 'M–N 1:0; M–U 1:0; M–W 1:0; M–O 1:0; M–B 1:0; N–U 1:1; N–W 1:0; N–O 1:0; N–B 1:0; U–W 1:0; U–O 1:0; U–B 1:0; W–O 1:0; W–B 1:0; O–B 1:0';

const table = (t: Tournament): Standing[] => calculateStandings(t.teams, t.matches, t);
const row = (rows: Standing[], key: Key): Standing => {
  const found = rows.find((r) => r.team.id === id(key));
  if (found === undefined) { throw new Error(`Team ${key} fehlt`); }
  return found;
};

describe('TB-3 „Ergebnis so akzeptieren“ in der Tabelle', () => {
  it('@ET-020:teil drei Teams auf Platz 2 bis 4 akzeptieren das Ergebnis: alle auf 2, das nächste Team auf 5 (Tabelle)', async () => {
    const repo = new MemoryRepo(jgj('WOUMNB', DATA.W2A_044));
    expect((await repo.service().decide(repo.tournament.id, shared(['U', 'W', 'O']))).ok).toBe(true);
    const rows = table(repo.tournament);
    expect(['U', 'W', 'O'].map((k) => row(rows, k as Key).place)).toEqual([2, 2, 2]);
    expect(row(rows, 'B').place).toBe(5);
    expect(rows.some((r) => r.decisionNeeded === true)).toBe(false);
  });

  it('@ET-029:teil Nord und Ufer akzeptieren das Ergebnis auf Platz 2: beide auf 2, das nächste Team auf 4, ohne Strafstoßschießen und ohne Grund', async () => {
    const repo = new MemoryRepo(jgj('MNUWOB', DATEN_029));
    expect(sharedPlaceAllowed(repo.tournament, '', { place: 2, size: 2 })).toBe(true);
    expect((await repo.service().decide(repo.tournament.id, shared(['N', 'U']))).ok).toBe(true);
    const rows = table(repo.tournament);
    expect([row(rows, 'M').place, row(rows, 'N').place, row(rows, 'U').place, row(rows, 'W').place]).toEqual([1, 2, 2, 4]);
    expect(row(rows, 'U').decision).toMatchObject({ kind: 'shared' });
    expect(row(rows, 'U').decision).not.toHaveProperty('reason');
  });
});
