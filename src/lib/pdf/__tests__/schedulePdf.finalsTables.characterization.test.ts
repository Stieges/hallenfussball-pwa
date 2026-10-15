/**
 * B-28a0 Fixrunde 1 – Finalrunde, Gruppentabellen und Platzierung gegen HEUTE (@BM-009), gegen die Fassade
 * `exportScheduleToPDF`. Standings werden direkt gebaut (`HALLENCUP_STANDINGS`), nicht über `calculations.ts` (B-40).
 *
 * Nachweise (Mutationen in pdfExporter.ts, danach `git checkout`):
 * - M1 Finalrunde Heim/Gast vertauscht → Test „Finalrunde: jede Zeile …“ rot.
 * - M2 Teamname in der Gruppentabelle leer → Test „Gruppentabellen …“ rot.
 * - M3 Ergebniszelle ohne Doppelpunkt → Zeilen-Tests (Gruppe und Finalrunde) rot.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  finalsMatches,
  hallencupSchedule,
  HALLENCUP_STANDINGS,
  sideName,
} from './pdfFixture';
import { containsSequence, flatText, renderSchedulePdf, rowFrom } from './pdfText';

vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('jspdf')>();
  const { capturingJsPdf } = await import('./pdfCapture');
  return { ...mod, default: capturingJsPdf(mod.default), jsPDF: capturingJsPdf(mod.jsPDF) };
});

const OPTIONS = { locale: 'de' as const, includeStandings: true };
/** Finalzeile im Mitschnitt: Nr, Zeit, Feld, Heim, leere Ergebnis-Zelle, Doppelpunkt, kleine Felder (Doppelpunkt), Gast. */
const FINAL_ZEILE = 12;

/** Gruppentabelle A: Berg und Nord mit 6 Pkt., Berg vor Nord durch Tordifferenz +3 gegen +1. */
const TABELLE_A = [
  '1', 'DJK Berg', '3', '2', '1', '5:2', '+3', '6',
  '2', 'FC Nord', '3', '2', '1', '4:3', '+1', '6',
  '3', 'SV Süd', '3', '1', '1', '1', '3:4', '-1', '4',
  '4', 'TuS Tal', '3', '3', '1:4', '-3',
];

/** Gruppentabelle B: West 9 Pkt. mit +6, Ost 4 Pkt. mit 0 (Diff leer), Mitte -2, Hof -4. */
const TABELLE_B = [
  '1', 'TSV West', '3', '3', '7:1', '+6', '9',
  '2', 'SC Ost', '3', '1', '1', '1', '3:3', '4',
  '3', 'FC Mitte', '3', '1', '2', '3:5', '-2', '3',
  '4', 'SV Hof', '3', '1', '2', '2:6', '-4', '1',
];

/**
 * Platzierung gesamt: Punkte, dann Tordifferenz, dann Tore. Die Platz-Spalte bleibt leer bis a4-4 (B-28a3-4F F5,
 * @DR-009), die Zeilen beginnen also mit dem Teamnamen.
 */
const PLATZIERUNG = [
  'TSV West', '3', '3', '7:1', '+6', '9',
  'DJK Berg', '3', '2', '1', '5:2', '+3', '6',
  'FC Nord', '3', '2', '1', '4:3', '+1', '6',
  'SC Ost', '3', '1', '1', '1', '3:3', '4',
  'SV Süd', '3', '1', '1', '1', '3:4', '-1', '4',
  'FC Mitte', '3', '1', '2', '3:5', '-2', '3',
  'SV Hof', '3', '1', '2', '2:6', '-4', '1',
  'TuS Tal', '3', '3', '1:4', '-3',
];

describe('Finalrunde gegen HEUTE (B-28a0 Fixrunde 1, @BM-009)', () => {
  it('Finalrunde: jede Zeile trägt Nr, Zeit, Feld, Heim, leere Ergebniszelle, Gast in Spielseiten-Reihenfolge', async () => {
    const schedule = hallencupSchedule();
    const text = flatText(await renderSchedulePdf(schedule, undefined, OPTIONS));
    const finals = finalsMatches(schedule);

    expect(finals).toHaveLength(4);
    for (const m of finals) {
      const zeile = rowFrom(text, m.matchNumber, m.time, FINAL_ZEILE);
      expect(zeile[2], `Feld Spiel ${m.matchNumber}`).toBe(String(m.field));
      expect(zeile[3], `Heim Spiel ${m.matchNumber}`).toBe(sideName(m, 'A'));
      expect(zeile[4], `Ergebniszelle Spiel ${m.matchNumber}`).toBe('');
      expect(zeile[5], `Doppelpunkt Spiel ${m.matchNumber}`).toBe(':');
      expect(zeile.indexOf(sideName(m, 'B')), `Gast Spiel ${m.matchNumber} nach dem Ergebnis`).toBeGreaterThan(5);
    }
  });

  it('Finalrunde: Zeilen in Spielnummern-Reihenfolge, „Spiel um Platz 3“ steht über seiner Zeile', async () => {
    const schedule = hallencupSchedule();
    const text = flatText(await renderSchedulePdf(schedule, undefined, OPTIONS));
    const finals = [...finalsMatches(schedule)].sort((a, b) => a.matchNumber - b.matchNumber);

    const positionen = finals.map(m => text.findIndex((t, i) => t === String(m.matchNumber) && text[i + 1] === m.time));
    for (let i = 1; i < positionen.length; i++) {
      expect(positionen[i], `Spiel ${finals[i]?.matchNumber} nach Spiel ${finals[i - 1]?.matchNumber}`).toBeGreaterThan(positionen[i - 1] ?? -1);
    }

    const platz3 = finals.find(m => m.finalType === 'thirdPlace');
    expect(platz3).toBeDefined();
    if (platz3) {
      const untertitel = text.indexOf('Spiel um Platz 3');
      const zeile = positionen[finals.indexOf(platz3)] ?? -1;
      expect(untertitel).toBeGreaterThan(-1);
      expect(untertitel).toBeLessThan(zeile);
    }
  });
});

describe('Gruppentabellen und Platzierung mit echten Standings (B-28a0 Fixrunde 1, @BM-009)', () => {
  it('Gruppentabellen: Teamnamen, Sp/S/U/N, Tore, Diff und Pkt je Zeile in Rang-Reihenfolge', async () => {
    const text = flatText(await renderSchedulePdf(hallencupSchedule(), HALLENCUP_STANDINGS, OPTIONS));

    expect(containsSequence(text, TABELLE_A), 'Tabelle Gruppe A').toBe(true);
    expect(containsSequence(text, TABELLE_B), 'Tabelle Gruppe B').toBe(true);
  });

  it('Platzierung gesamt: alle acht Teams nach Punkten, Tordifferenz, Toren sortiert', async () => {
    const text = flatText(await renderSchedulePdf(hallencupSchedule(), HALLENCUP_STANDINGS, OPTIONS));

    expect(containsSequence(text, PLATZIERUNG)).toBe(true);
  });

  it('Gegenbeispiel: ohne Tabellen steht die Platzierung trotzdem mit allen Teams', async () => {
    const text = flatText(await renderSchedulePdf(hallencupSchedule(), HALLENCUP_STANDINGS, { ...OPTIONS, includeStandings: false }));

    expect(text).not.toContain('Tabelle – Gruppe A');
    expect(containsSequence(text, PLATZIERUNG)).toBe(true);
  });
});
