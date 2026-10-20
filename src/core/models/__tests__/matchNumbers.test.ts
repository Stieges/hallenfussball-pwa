/**
 * Spielnummer: stabil, eindeutig, in Spielplan-Reihenfolge (Befunde C-SPIELNUMMER-FEHLT, C-FINALRUNDE-REIHENFOLGE).
 *
 * Aus den Szenarien, nicht am Code abgelesen:
 * - @SL-049 (Record Spiel leiten, „Spielnummern gelten wörtlich“): nach Spiel 11 (15:00, Feld 1) steht Spiel 13
 *   (15:15, Feld 1) bereit; Spiel 12 liegt um 15:00 auf Feld 2. Die Nummer folgt der Uhrzeit, dann dem Feld.
 * - @TM-142 (Record Turniermodi): Halbfinale 1 und Halbfinale 2 sind zwei verschiedene Spiele.
 * - Rückfallregel (Altdaten ohne Nummer, `match_number` NULL): Zählung in Spielplan-Reihenfolge, nie nach der ID.
 */
import { describe, it, expect } from 'vitest';
import { ensureMatchNumbers } from '../matchNumbers';

interface PlanMatch {
  id: string;
  round: number;
  field: number;
  slot?: number;
  scheduledTime?: Date;
  matchNumber?: number;
}

const at = (hhmm: string): Date => new Date(`2026-11-28T${hhmm}:00`);

/** „Hallencup Süd“ wie im Record Spiel leiten: zwei Felder, alle 15 Minuten ein Zeitfenster, Halbfinale 1 um 16:15. */
const PLAN: ReadonlyArray<{ nummer: number; zeit: string; feld: number }> = [
  { nummer: 1, zeit: '13:45', feld: 1 }, { nummer: 2, zeit: '13:45', feld: 2 },
  { nummer: 3, zeit: '14:00', feld: 1 }, { nummer: 4, zeit: '14:00', feld: 2 },
  { nummer: 5, zeit: '14:15', feld: 1 }, { nummer: 6, zeit: '14:15', feld: 2 },
  { nummer: 7, zeit: '14:30', feld: 1 }, { nummer: 8, zeit: '14:30', feld: 2 },
  { nummer: 9, zeit: '14:45', feld: 1 }, { nummer: 10, zeit: '14:45', feld: 2 },
  { nummer: 11, zeit: '15:00', feld: 1 }, { nummer: 12, zeit: '15:00', feld: 2 },
  { nummer: 13, zeit: '15:15', feld: 1 }, { nummer: 14, zeit: '15:15', feld: 2 },
  { nummer: 15, zeit: '15:30', feld: 1 }, { nummer: 16, zeit: '16:15', feld: 1 },
];

/** IDs absichtlich gegenläufig zur Spielplan-Reihenfolge („zufällig“): Spiel 1 hat die „größte“ ID. */
const idOf = (nummer: number): string => `id-${String(100 - nummer).padStart(3, '0')}`;

function planOhneNummern(): PlanMatch[] {
  const matches = PLAN.map(({ nummer, zeit, feld }) => ({ id: idOf(nummer), round: 1, field: feld, scheduledTime: at(zeit) }));
  // vertauschte Reihenfolge wie aus einer Datenbank-Abfrage, die nach einer leeren Spalte sortiert
  return [...matches.slice(7), ...matches.slice(0, 7)].reverse();
}

const nummerVon = (matches: readonly PlanMatch[], nummer: number): number | undefined =>
  matches.find((m) => m.id === idOf(nummer))?.matchNumber;

describe('Spielnummer ohne gespeicherte Nummer (Rückfallregel)', () => {
  it('@SL-049 C-SPIELNUMMER-FEHLT: Spiel 11 (15:00, Feld 1), Spiel 12 (15:00, Feld 2) und Spiel 13 (15:15, Feld 1) tragen ihre Nummer', () => {
    const numbered = ensureMatchNumbers(planOhneNummern());

    expect(nummerVon(numbered, 11)).toBe(11);
    expect(nummerVon(numbered, 12)).toBe(12);
    expect(nummerVon(numbered, 13)).toBe(13);
    for (const { nummer } of PLAN) {
      expect(nummerVon(numbered, nummer), `Spiel ${nummer}`).toBe(nummer);
    }
  });

  it('@SL-049 C-SPIELNUMMER-FEHLT: die Reihenfolge der Liste ändert nichts – jede Eingabe-Reihenfolge ergibt dieselben Nummern', () => {
    const vorwaerts = ensureMatchNumbers([...planOhneNummern()].reverse());
    const rueckwaerts = ensureMatchNumbers(planOhneNummern());

    expect(new Map(vorwaerts.map((m) => [m.id, m.matchNumber]))).toEqual(new Map(rueckwaerts.map((m) => [m.id, m.matchNumber])));
  });

  it('@TM-142 C-FINALRUNDE-REIHENFOLGE: Halbfinale 1 (Feld 1) und Halbfinale 2 (Feld 2) zur selben Zeit bekommen verschiedene Nummern, Feld 1 zuerst – unabhängig von der ID', () => {
    for (const [idHf1, idHf2] of [['aaa', 'zzz'], ['zzz', 'aaa']]) {
      const numbered = ensureMatchNumbers<PlanMatch>([
        { id: idHf2, round: 7, field: 2, scheduledTime: at('15:35') },
        { id: 'gruppe', round: 1, field: 1, scheduledTime: at('15:05') },
        { id: idHf1, round: 7, field: 1, scheduledTime: at('15:35') },
      ]);
      const nr = (id: string) => numbered.find((m) => m.id === id)?.matchNumber;

      expect(nr('gruppe')).toBe(1);
      expect(nr(idHf1), `Halbfinale 1 mit ID ${idHf1}`).toBe(2);
      expect(nr(idHf2), `Halbfinale 2 mit ID ${idHf2}`).toBe(3);
    }
  });

  it('ohne Anstoßzeit zählt der Platz im Raster (Slot), dann das Feld', () => {
    const numbered = ensureMatchNumbers<PlanMatch>([
      { id: 'c', round: 2, field: 1, slot: 1 },
      { id: 'b', round: 1, field: 2, slot: 0 },
      { id: 'a', round: 1, field: 1, slot: 0 },
    ]);

    expect(numbered.map((m) => [m.id, m.matchNumber])).toEqual([['c', 3], ['b', 2], ['a', 1]]);
  });
});

describe('Gegenbeispiele: gespeicherte Nummern', () => {
  it('Gegenbeispiel: vollständige, eindeutige Nummern bleiben, auch wenn ein Spiel später verschoben wurde (stabil)', () => {
    const plan = PLAN.map(({ nummer, zeit, feld }) => ({ id: idOf(nummer), round: 1, field: feld, scheduledTime: at(zeit), matchNumber: nummer }));
    // Spiel 3 wurde von 14:00 auf 15:45 verschoben – es bleibt Spiel 3
    const verschoben = plan.map((m) => (m.matchNumber === 3 ? { ...m, scheduledTime: at('15:45') } : m));

    const numbered = ensureMatchNumbers(verschoben);

    expect(numbered.map((m) => m.matchNumber)).toEqual(verschoben.map((m) => m.matchNumber));
    expect(nummerVon(numbered, 3)).toBe(3);
  });

  it('C-FINALRUNDE-REIHENFOLGE: zwei Spiele mit derselben Nummer („Spiel 7“ zweimal) werden in Spielplan-Reihenfolge neu gezählt', () => {
    const numbered = ensureMatchNumbers<PlanMatch>([
      { id: 'hf2', round: 7, field: 2, scheduledTime: at('15:35'), matchNumber: 7 },
      { id: 'hf1', round: 7, field: 1, scheduledTime: at('15:35'), matchNumber: 7 },
      { id: 'gruppe', round: 1, field: 1, scheduledTime: at('15:05'), matchNumber: 6 },
    ]);

    expect(Object.fromEntries(numbered.map((m) => [m.id, m.matchNumber]))).toEqual({ gruppe: 1, hf1: 2, hf2: 3 });
  });

  it('fehlt nur bei einem Spiel die Nummer, wird der ganze Plan in Spielplan-Reihenfolge gezählt (eindeutig, keine Lücke)', () => {
    const numbered = ensureMatchNumbers<PlanMatch>([
      { id: 'x', round: 1, field: 1, scheduledTime: at('14:00'), matchNumber: 1 },
      { id: 'y', round: 1, field: 1, scheduledTime: at('13:45') },
    ]);

    expect(Object.fromEntries(numbered.map((m) => [m.id, m.matchNumber]))).toEqual({ y: 1, x: 2 });
  });

  it('ein leerer Plan bleibt leer', () => {
    expect(ensureMatchNumbers([])).toEqual([]);
  });
});
