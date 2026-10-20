/**
 * Paket TB, Task TB-4: Endstand nach Gruppenplatz aus der Tabellenrechnung je Gruppe (mit Entscheidungen) und mit der
 * gruppenübergreifenden Gesamtwertung (`overallStandings`); geteilter Gruppenplatz nach „gleichen Platz lassen“
 * (Daniel F4 Variante C): @ET-020 (2, 2, 2, 5), @ET-029 (2, 2, 4), @ET-021 (5, 6, 6, 8), @W2A-063 (5, 5), dazu @ET-055
 * (Entscheidung steht im Endstand), @ET-027 (Platz 1 allein), @W2A-049 (Endstand). Daten: Plan v2 Abschnitt 6.
 */
import { describe, expect, it } from 'vitest';
import { DATA } from '../../core/standings/__tests__/fixtures';
import { jgj, MemoryRepo, OLLI, order, shootout } from '../../core/standings/__tests__/decisionTestKit';
import {
  DATEN_029, DATEN_063, endstand, ET021_GRUPPE_A, ET021_GRUPPE_B, mitGleichemPlatz, plaetze, zweiGruppen, zweiGruppenWaging,
} from '../../core/standings/__tests__/tb4Kit';

const DATEN_PLATZ_1 = 'M–N 2:2; M–W 1:0; M–O 1:0; M–U 1:0; M–B 1:0; N–W 1:0; N–O 1:0; N–U 1:0; N–B 1:0; W–O 1:0; W–U 1:0; W–B 1:0; O–U 1:0; O–B 1:0; U–B 1:0';

describe('TB-4 Endstand: geteilter Gruppenplatz (Variante C)', () => {
  it('@ET-020 Ufer, West und Ost lassen den gleichen Platz 2 bis 4: alle auf Platz 2, das nächste Team auf Platz 5', async () => {
    const t = await mitGleichemPlatz(jgj('WOUMNB', DATA.W2A_044), ['U', 'W', 'O']);
    expect(plaetze(endstand(t), 'M', 'U', 'W', 'O', 'B', 'N')).toEqual([1, 2, 2, 2, 5, 6]);
    // Gegenbeispiel: ohne „gleichen Platz lassen“ bleibt der Block offen und der Endstand teilt nicht still.
    expect(plaetze(endstand(jgj('WOUMNB', DATA.W2A_044)), 'M', 'W', 'O', 'U', 'B', 'N')).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('@ET-029 Nord und Ufer lassen den gleichen Platz 2: beide auf Platz 2, das nächste Team auf Platz 4', async () => {
    const t = await mitGleichemPlatz(jgj('MNUWOB', DATEN_029), ['N', 'U']);
    expect(plaetze(endstand(t), 'M', 'N', 'U', 'W', 'O', 'B')).toEqual([1, 2, 2, 4, 5, 6]);
    expect(plaetze(endstand(jgj('MNUWOB', DATEN_029)), 'M', 'N', 'U', 'W')).toEqual([1, 2, 3, 4]);
  });

  it('@W2A-063 Waging blau und Petting lassen den gleichen Platz 5: beide auf Platz 5 (Endstand)', async () => {
    const t = await mitGleichemPlatz(jgj('MNUWXP', DATEN_063), ['X', 'P']);
    expect(plaetze(endstand(t), 'X', 'P')).toEqual([5, 5]);
    // Gegenbeispiel: das Strafstoßschießen (Normalweg) trennt die beiden.
    const repo = new MemoryRepo(jgj('MNUWXP', DATEN_063));
    expect((await repo.service().decide(repo.tournament.id, shootout('X', 'P', 5, 4), OLLI)).ok).toBe(true);
    expect(plaetze(endstand(repo.tournament), 'X', 'P')).toEqual([5, 6]);
  });

  it('@ET-021 West und Ost lassen in Gruppe A den gleichen Platz 3 und 4: Endstand 5. Ufer, 6. West, 6. Ost, 8. Tal', async () => {
    const t = await mitGleichemPlatz(zweiGruppen('NSWO', ET021_GRUPPE_A, 'MBUT', ET021_GRUPPE_B), ['W', 'O'], 'A');
    expect(plaetze(endstand(t), 'U', 'W', 'O', 'T')).toEqual([5, 6, 6, 8]);
    // Gegenbeispiel: ohne „gleichen Platz lassen“ teilt der Endstand nicht still (6, 7).
    const offen = zweiGruppen('NSWO', ET021_GRUPPE_A, 'MBUT', ET021_GRUPPE_B);
    expect(plaetze(endstand(offen), 'U', 'W', 'O', 'T')).toEqual([5, 6, 7, 8]);
  });
});

describe('TB-4 Endstand: Reihenfolge aus der Tabelle je Gruppe', () => {
  it('@ET-055 nach dem Strafstoßschießen 4:3 für Kammer steht Kammer im Endstand vor Waging rot', async () => {
    const repo = new MemoryRepo(jgj('RKMUNO', DATA.ET_055));
    expect((await repo.service().decide(repo.tournament.id, shootout('K', 'R', 4, 3), OLLI)).ok).toBe(true);
    expect(plaetze(endstand(repo.tournament), 'K', 'R')).toEqual([3, 4]);
    // Gegenbeispiel: ohne Eintrag steht Waging rot in Eingabereihenfolge vorn (offener Block, nicht geteilt).
    expect(plaetze(endstand(jgj('RKMUNO', DATA.ET_055)), 'R', 'K')).toEqual([3, 4]);
  });

  it('@W2A-044 Reihenfolge der Turnierleitung (Ufer, West, Ost, Grund Strafstoßschießen) steht im Endstand auf 2, 3, 4 – kein geteilter Platz', async () => {
    const repo = new MemoryRepo(jgj('WOUMNB', DATA.W2A_044));
    expect((await repo.service().decide(repo.tournament.id, order(['U', 'W', 'O'], 'Strafstoßschießen'), OLLI)).ok).toBe(true);
    expect(plaetze(endstand(repo.tournament), 'M', 'U', 'W', 'O', 'B', 'N')).toEqual([1, 2, 3, 4, 5, 6]);
    // Gegenbeispiel: eine andere Reihenfolge ordnet den Endstand anders.
    const anders = new MemoryRepo(jgj('WOUMNB', DATA.W2A_044));
    expect((await anders.service().decide(anders.tournament.id, order(['O', 'U', 'W'], 'Strafstoßschießen'), OLLI)).ok).toBe(true);
    expect(plaetze(endstand(anders.tournament), 'O', 'U', 'W')).toEqual([2, 3, 4]);
  });

  it('@ET-027 Jeder gegen jeden: nach dem Strafstoßschießen 3:2 steht SG Mitte allein auf Platz 1, FC Nord auf Platz 2', async () => {
    const repo = new MemoryRepo(jgj('MNWOUB', DATEN_PLATZ_1));
    expect((await repo.service().decide(repo.tournament.id, shootout('M', 'N', 3, 2), OLLI)).ok).toBe(true);
    expect(plaetze(endstand(repo.tournament), 'M', 'N')).toEqual([1, 2]);
  });

  it('@W2A-049 Endstand Jeder gegen jeden: Kammer vor Waging rot; Gegenbeispiel: nach Tordifferenz stünde Waging rot vorn', () => {
    expect(plaetze(endstand(jgj('RKMUNO', DATA.ET_056)), 'K', 'R')).toEqual([1, 2]);
  });

  it('@W2A-049 Endstand mit zwei Gruppen: Gruppenplatz zuerst, bei gleichem Gruppenplatz die Gesamtwertung (Waging blau +3 vor Kammer +1)', () => {
    const ranks = endstand(zweiGruppenWaging(DATA.ET_056));
    expect(plaetze(ranks, 'X', 'K', 'R', 'P')).toEqual([1, 2, 3, 4]);
  });
});
