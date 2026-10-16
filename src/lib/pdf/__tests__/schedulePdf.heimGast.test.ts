/**
 * B-28a3-3b Re-Review Punkt 7 (Daniel 15.10. „gespiegelt“): In allen Spieltabellen endet der Heim-Name am Ergebnis,
 * der Gast-Name beginnt am Ergebnis. Gelesen aus dem fertigen PDF (pdfjs). Szenarien: @BM-011, @BM-013.
 */
import { describe, expect, it } from 'vitest';
import { HALLENCUP_TEAMS, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { printColumns } from '../../../design-tokens/print';
import { layoutOf } from './pdfFixtureLayout';
import type { LayoutPage } from './pdfjsLayout';

const NAMEN = HALLENCUP_TEAMS.map(team => team.name);
const TOL = 0.5;

/** Je Spielzeile mit Ergebnis-Doppelpunkt: Kanten der Heim- und Gast-Namen. */
function kantenJeZeile(page: LayoutPage): { heim: number[]; gast: number[] } {
  const heim: number[] = [];
  const gast: number[] = [];
  const doppelpunkte = page.texts.filter(t => t.str.trim() === ':');
  for (const dp of doppelpunkte) {
    const zeile = page.texts.filter(t => Math.abs(t.y - dp.y) < 3 && NAMEN.includes(t.str.trim()));
    zeile.filter(t => t.x + t.w < dp.x).forEach(t => heim.push(t.x + t.w));
    zeile.filter(t => t.x > dp.x).forEach(t => gast.push(t.x));
  }
  return { heim, gast };
}

describe('Punkt 7: Heim endet am Ergebnis, Gast beginnt am Ergebnis', () => {
  it.each([
    ['hoch', {}],
    ['quer', { orientation: 'landscape' as const }],
  ])('Gruppenspiele %s: rechte Kante aller Heim-Namen gleich, linke Kante aller Gast-Namen gleich', async (_name, extra) => {
    const tournament = hallencupTournament();
    const { pages } = await layoutOf({ tournament, ...extra }, hallencupSchedule(tournament));
    const heim: number[] = [];
    const gast: number[] = [];
    pages.forEach(page => {
      const k = kantenJeZeile(page);
      heim.push(...k.heim);
      gast.push(...k.gast);
    });

    expect(heim.length, 'Heim-Namen gefunden').toBeGreaterThan(0);
    expect(gast.length, 'Gast-Namen gefunden').toBeGreaterThan(0);
    const hMin = Math.min(...heim);
    const hMax = Math.max(...heim);
    const gMin = Math.min(...gast);
    const gMax = Math.max(...gast);
    expect(hMax - hMin, 'rechte Kante Heim').toBeLessThanOrEqual(TOL);
    expect(gMax - gMin, 'linke Kante Gast').toBeLessThanOrEqual(TOL);
    // Nahe am Ergebnis: Heim endet und Gast beginnt innerhalb der Ergebnisspalte (Breite als Token)
    const ergebnisse = pages.flatMap(page => page.texts.filter(t => t.str.trim() === ':'));
    const mitte = Math.min(...ergebnisse.map(t => t.x));
    expect(mitte - hMax, 'Heim-Ende vor dem Ergebnis').toBeLessThan(printColumns.match.result);
    expect(gMin - mitte, 'Gast-Beginn nach dem Ergebnis').toBeLessThan(printColumns.match.result);
  });

  it('Gegenbeispiel-Form: Heim-Namen liegen links vom Gast-Namen einer Zeile (kein Tausch der Seiten)', async () => {
    const tournament = hallencupTournament();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const k = kantenJeZeile(pages[0]);
    expect(k.heim.length).toBeGreaterThan(0);
    expect(Math.max(...k.heim)).toBeLessThan(Math.min(...k.gast));
  });
});
