/**
 * Die Handzettel-Tokens halten die Abstandsregel @DR-034 schon in sich (PDF-Paket V1): Wer einen Wert ändert, sieht hier,
 * welche Regel er bricht. Die Messung am fertigen PDF macht T7a/T7b.
 */
import { describe, expect, it } from 'vitest';
import { printAccent } from '../print';
import { printHourRule, printMatchRow, printRowPad, printWriteLine } from '../print-sheet';

describe('Handzettel-Tokens (@DR-034, @DR-033, @DR-037)', () => {
  it('@DR-034 Linie über dem Zeilenboden hat ≥ 3 mm zur Zebra-Kante darunter und ≥ 4 mm (± Toleranz) zum Trenner der Folgezeile', () => {
    expect(printWriteLine.aboveRowBottom).toBeGreaterThanOrEqual(printWriteLine.minGapToFill);
    expect(printWriteLine.aboveRowBottom + printHourRule.inset + printHourRule.stroke / 2).toBeGreaterThanOrEqual(printWriteLine.minGapToStroke - printWriteLine.tolerance);
  });

  it('@DR-034 kleinste Zeile: ≥ 4 mm von der Linie zum Stundentrenner, der in der Zeile liegt', () => {
    const abstandZumTrenner = printMatchRow.minHeight - printWriteLine.aboveRowBottom - printHourRule.inset - printHourRule.stroke / 2;

    expect(abstandZumTrenner).toBeGreaterThanOrEqual(printWriteLine.minGapToStroke - printWriteLine.tolerance);
    expect(printMatchRow.minHeight - printWriteLine.aboveRowBottom).toBeGreaterThanOrEqual(printWriteLine.minGapToFill);
  });

  it('@DR-033 Zeilenabstand nie unter 1,15, „eng“ verringert nur das Polster', () => {
    expect(printMatchRow.lineHeight).toBeGreaterThanOrEqual(1.15);
    expect(printRowPad.tight).toBeLessThan(printRowPad.normal);
    expect(printMatchRow.maxHeight).toBeGreaterThan(printMatchRow.minHeight);
  });

  it('@DR-037 Namenslinie mindestens 50 mm; Platzierungslinien liegen ≥ 4 mm auseinander', () => {
    expect(printWriteLine.nameMin).toBeGreaterThanOrEqual(50);
    expect(printWriteLine.rankRowHeight).toBeGreaterThanOrEqual(printWriteLine.minGapToStroke);
  });

  it('@DR-001 Grauwert-Abstand Akzentlinie ↔ Zebra: 60 lässt den schwächsten Fall der NOTIZ (Gelb 138 ↔ 222) zu', () => {
    expect(printAccent.zebraMaxGray - 138).toBeGreaterThanOrEqual(printAccent.minGrayGap);
  });
});
