/**
 * B-28a0 – Charakterisierung des Spielplan-PDFs von HEUTE (@BM-009), gegen die Fassade `exportScheduleToPDF`.
 *
 * Pflichttest echter Weg: echter Generator, echtes jsPDF, Text je Seite mitgeschnitten (Rückfall, siehe pdfText.ts).
 * Gegenbeispiel: `includeStandings: false` → keine Gruppentabelle.
 * Mutation (nach dem Commit, dann `git checkout`): in pdfExporter.ts Heim/Gast der Gruppenspiele vertauschen → Zeilen-Test rot.
 *
 * IST-Fälle: „IST @…“ = Bestand heute (grün). Das Ziel der Anforderung steht als `it.fails` daneben: läuft es
 * fehl, ist die Abweichung noch da. a3/a4 drehen die `it.fails` um (Ergebniszellen: B-28 C1).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  finalsMatches,
  hallencupSchedule,
  hallencupTournament,
  sideName,
} from './pdfFixture';
import { flatText, renderSchedulePdf } from './pdfText';

// jsPDF-Instanzen mitschreiben lassen (Rückfall-Mitschnitt, siehe pdfCapture.ts).
vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('jspdf')>();
  const { capturingJsPdf } = await import('./pdfCapture');
  return { ...mod, default: capturingJsPdf(mod.default), jsPDF: capturingJsPdf(mod.jsPDF) };
});

/** Regelzeilen im Kopf kommen aus dem Turnier (B-28a3-3b); der Bestand druckt sie mit dem Hallencup. */
/** Fester Zeitpunkt für Stand und Dateiname: 14.11.2026 15:07 (B-28 C3). */
const JETZT = new Date(2026, 10, 14, 15, 7);
const SCHEDULE_OPTIONS = { locale: 'de' as const, tournament: hallencupTournament(), now: JETZT };
/** Der Hinweis „Ergebnisse bitte nach Spielende eintragen“ entfällt mit der Meta-Box (B-28a3-3b, v7.2). */
const HINWEIS = 'Ergebnisse bitte nach Spielende eintragen';
describe('schedulePdf – Charakterisierung heute (B-28a0, @BM-009)', () => {
  it('Pflichttest: A4 hoch (210 × 297) und Dateiname mit Stand „Hallencup_Nord_Spielplan_2026-11-14_1507.pdf“', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);

    expect(pdf.pageWidth).toBeCloseTo(210, 1);
    expect(pdf.pageHeight).toBeCloseTo(297, 1);
    expect(pdf.filename).toBe('Hallencup_Nord_Spielplan_2026-11-14_1507.pdf');
  });

  it('Finalrunde: Rundenname „SPIEL UM PLATZ 3“ (Versalien) und beide Teams des Finales', async () => {
    const schedule = hallencupSchedule();
    const pdf = await renderSchedulePdf(schedule, undefined, SCHEDULE_OPTIONS);
    const text = flatText(pdf);
    const finale = finalsMatches(schedule).find(m => m.finalType === 'final');

    expect(finale).toBeDefined();
    expect(text).toContain('SPIEL UM PLATZ 3');
    if (finale) {
      // Die Herkunft („Sieger Halbfinale 1“) darf in der schmalen Zelle am Leerzeichen umbrechen (gleich breite Ziffern, T1):
      // dann stehen Anfang und Schluss in zwei aufeinanderfolgenden Stücken (oder in einem mit Zeilenumbruch)
      const flat = text.map(t => t.replace(/\s+/g, ' ').trim());
      for (const side of ['A', 'B'] as const) {
        const name = sideName(finale, side, schedule.allMatches);
        const gesetzt = flat.some((t, i) => t === name || `${t} ${flat[i + 1] ?? ''}` === name);
        expect(gesetzt, `„${name}“ steht im PDF`).toBe(true);
      }
    }
  });

  it('Gegenbeispiel: includeStandings false → keine Tabelle der Gruppe A', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, { ...SCHEDULE_OPTIONS, includeStandings: false });

    expect(flatText(pdf)).not.toContain('Gruppe A');
  });

  it('Die Hinweiszeile „Ergebnisse bitte nach Spielende eintragen“ entfällt (B-28a3-3b)', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);

    expect(pdf.pages[0]).not.toContain(HINWEIS);
  });
});

describe('IST-Abweichungen gegen Anforderung (B-28a0): Bestand grün, Ziel als it.fails', () => {
  it('@BM-010 @DR-044 jede Seite trägt „Hallencup Nord · Stand 14.11. 15:07“ und „Seite x von y“ (Nachweis am PDF in schedulePdf.fusszeile.test.ts)', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);
    const seite = /^Seite (\d+) von (\d+)$/;

    pdf.pages.forEach((page, i) => {
      expect(page, `Seite ${i + 1}`).toContain('Hallencup Nord · Stand 14.11. 15:07');
      const treffer = page.map(t => seite.exec(t)).find(m => m !== null);
      expect(treffer?.[1], `Seite ${i + 1}`).toBe(String(i + 1));
      expect(treffer?.[2], `Seite ${i + 1}`).toBe(String(pdf.pages.length));
    });
  });

  it('IST @BM-032: Platzierung bleibt auch bei ausgeschalteten Tabellen (Bestand)', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, { ...SCHEDULE_OPTIONS, includeStandings: false });

    // Überschrift des Blocks mit den Plätzen („Platzierung“); die Regelzeile heißt seit G72 „Wertung“
    expect(flatText(pdf).some(t => t === 'Platzierung')).toBe(true);
  });

  it.fails('@BM-032 C-KIDS-PDF Ziel: ohne Tabellen keine Platzierung', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, { ...SCHEDULE_OPTIONS, includeStandings: false });

    expect(flatText(pdf).some(t => t === 'Platzierung')).toBe(false);
  });
});
