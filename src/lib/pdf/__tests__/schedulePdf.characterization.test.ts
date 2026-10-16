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
import { getGroupShortCode } from '../../../utils/displayNames';
import {
  finalsMatches,
  groupMatches,
  hallencupSchedule,
  hallencupTournament,
  matchByNumber,
  sideName,
} from './pdfFixture';
import { flatText, renderSchedulePdf, rowFrom } from './pdfText';
import { mitStand } from './pdfScoreSupport';

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
/**
 * Gruppenzeile im Mitschnitt: Nr, Zeit, Feld, Gr, Heim, leere Ergebnis-Zelle, Doppelpunkt (aus der Ergebniszelle,
 * B-28 C1), Gast, leere Zelle „SR“. Ziffern und Kennzeichen folgen zwischen Doppelpunkt und Gast.
 */
const GRUPPEN_ZEILE = 9;

/** Plan und Turnier mit dem beendeten Spiel 11 (2:1), so wie der Dialog es einmischt. */
const beendetesSpiel11 = () =>
  mitStand(hallencupSchedule(), SCHEDULE_OPTIONS.tournament, { 11: { matchStatus: 'finished', scoreA: 2, scoreB: 1 } });

describe('schedulePdf – Charakterisierung heute (B-28a0, @BM-009)', () => {
  it('Pflichttest: A4 hoch (210 × 297) und Dateiname mit Stand „Hallencup_Nord_Spielplan_2026-11-14_1507.pdf“', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);

    expect(pdf.pageWidth).toBeCloseTo(210, 1);
    expect(pdf.pageHeight).toBeCloseTo(297, 1);
    expect(pdf.filename).toBe('Hallencup_Nord_Spielplan_2026-11-14_1507.pdf');
  });

  it('Kopf: Turniertitel und Altersklasse stehen auf Seite 1', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);

    expect(pdf.pages[0]).toContain('Hallencup Nord');
    expect(pdf.pages[0]).toContain('D-Junioren');
  });

  it('Angaben: Veranstalter, Halle, Termin, Modus und Spielzeit', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);
    const text = flatText(pdf);
    const alles = text.join(' ');

    // Angabentabelle (Daniel 15.10., v7.2): Bezeichnung und Wert als eigene Texte, Bezeichnungen ohne Doppelpunkt
    expect(text).toContain('Veranstalter');
    expect(text).toContain('SV Nord 1921 e. V.');
    expect(text).toContain('Halle');
    expect(alles).toContain('Sporthalle am Park');
    // Termin wie v7.2 in einer Zeile: Wochentag, Datum · Beginn · Ende voraussichtlich · Felder (B-28a3-4F, N2)
    expect(text).toContain('Termin');
    expect(text).not.toContain('Spieltag');
    expect(alles).toMatch(/Samstag, 14\.11\.2026 · Beginn 13:00 · Ende voraussichtlich \d{2}:\d{2} · 2 Felder/);
    expect(text).toContain('Modus');
    expect(text).toContain('Gruppen + Finalrunde');
    expect(text).toContain('Spielzeit');
    expect(text).toContain('10 Min. · Zeitstrafe 2 Min.');
  });

  it('Teilnehmer: Gruppen A und B, Kennungen A1–B4 in Zuteilungsreihenfolge, nicht alphabetisch (v7.2 gen.py:165–168, Daniel 15.10.)', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);
    const text = flatText(pdf);
    const alles = text.join(' ');

    expect(text).toContain('Gruppe A');
    expect(text).toContain('Gruppe B');
    const expected = [
      'A1 FC Nord',
      'A2 SV Süd',
      'A3 DJK Berg',
      'A4 TuS Tal',
      'B1 TSV West',
      'B2 SC Ost',
      'B3 FC Mitte',
      'B4 SV Hof',
    ];
    for (const line of expected) {
      expect(alles).toContain(line);
    }
  });

  it('Gruppenspiele: jede Zeile trägt Nr, Zeit, Feld, Gruppe, Heim, Ergebnis, Gast (zwölf Spiele)', async () => {
    const schedule = hallencupSchedule();
    const pdf = await renderSchedulePdf(schedule, undefined, SCHEDULE_OPTIONS);
    const text = flatText(pdf);
    const matches = groupMatches(schedule);

    expect(matches).toHaveLength(12);
    for (const m of matches) {
      const i = text.findIndex((t, idx) => t === String(m.matchNumber) && text[idx + 1] === m.time);
      expect(i, `Zeile Spiel ${m.matchNumber} fehlt`).toBeGreaterThanOrEqual(0);
      expect(text[i + 2]).toBe(String(m.field));
      expect(text[i + 3]).toBe(getGroupShortCode(m.group ?? '', schedule.tournament));
      expect(text[i + 4]).toBe(sideName(m, 'A'));
      expect(text[i + 5], `Ergebniszelle Spiel ${m.matchNumber}`).toBe('');
      expect(text[i + 6], `Doppelpunkt Spiel ${m.matchNumber}`).toBe(':');
      expect(text[i + 7]).toBe(sideName(m, 'B'));
    }
  });

  it('Gegenbeispiel Ergebnis: beendetes Spiel 11 druckt „2“ und „1“ nur mit eingeschaltetem Spielstand', async () => {
    const stand = beendetesSpiel11();
    const m = matchByNumber(stand.schedule, 11);

    const mit = flatText(await renderSchedulePdf(stand.schedule, undefined, { ...SCHEDULE_OPTIONS, tournament: stand.tournament, includeScores: true }));
    const i = mit.findIndex((t, idx) => t === '11' && mit[idx + 1] === m.time);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(mit.slice(i + 6, i + 9)).toEqual([':', '2', '1']);

    const ohne = flatText(await renderSchedulePdf(stand.schedule, undefined, { ...SCHEDULE_OPTIONS, tournament: stand.tournament, includeScores: false }));
    const j = ohne.findIndex((t, idx) => t === '11' && ohne[idx + 1] === m.time);
    expect(ohne.slice(j + 6, j + 8)).toEqual([':', sideName(m, 'B')]);
  });

  it('Finalrunde: Untertitel „Spiel um Platz 3“ und beide Teams des Finales', async () => {
    const schedule = hallencupSchedule();
    const pdf = await renderSchedulePdf(schedule, undefined, SCHEDULE_OPTIONS);
    const text = flatText(pdf);
    const finale = finalsMatches(schedule).find(m => m.finalType === 'final');

    expect(finale).toBeDefined();
    expect(text).toContain('Spiel um Platz 3');
    if (finale) {
      expect(text).toContain(sideName(finale, 'A', schedule.allMatches));
      expect(text).toContain(sideName(finale, 'B', schedule.allMatches));
    }
  });

  it('Tabellen bei includeStandings: „Tabelle – Gruppe A“ und „Tabelle – Gruppe B“ stehen im PDF', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, { ...SCHEDULE_OPTIONS, includeStandings: true });
    const text = flatText(pdf);

    expect(text).toContain('3 Tabelle – Gruppe A');
    expect(text).toContain('Tabelle – Gruppe B');
  });

  it('Gegenbeispiel: includeStandings false → keine Zeile „Tabelle – Gruppe A“', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, { ...SCHEDULE_OPTIONS, includeStandings: false });

    expect(flatText(pdf)).not.toContain('Tabelle – Gruppe A');
  });

  it('Platzierung steht immer am Ende, nach dem Finale', async () => {
    const schedule = hallencupSchedule();
    const pdf = await renderSchedulePdf(schedule, undefined, SCHEDULE_OPTIONS);
    const text = flatText(pdf);
    const finale = finalsMatches(schedule).find(m => m.finalType === 'final');

    const platz = text.lastIndexOf('5 Platzierung');
    expect(platz).toBeGreaterThan(-1);
    if (finale) {
      expect(platz).toBeGreaterThan(text.lastIndexOf(sideName(finale, 'B', schedule.allMatches)));
    }
  });

  it('Die Hinweiszeile „Ergebnisse bitte nach Spielende eintragen“ entfällt (B-28a3-3b)', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);

    expect(pdf.pages[0]).not.toContain(HINWEIS);
  });
});

describe('IST-Abweichungen gegen Anforderung (B-28a0): Bestand grün, Ziel als it.fails', () => {
  it('@BM-012: Spiel 12 steht in seiner Zeile als „läuft“, ohne Zwischenstand', async () => {
    const stand = mitStand(hallencupSchedule(), SCHEDULE_OPTIONS.tournament, { 12: { matchStatus: 'running', scoreA: 1, scoreB: 0 } });
    const pdf = await renderSchedulePdf(stand.schedule, undefined, { ...SCHEDULE_OPTIONS, tournament: stand.tournament, includeScores: true });
    const row = rowFrom(flatText(pdf), 12, matchByNumber(stand.schedule, 12).time, GRUPPEN_ZEILE);

    // leere Zelle, Doppelpunkt, Kennzeichen, dann der Gast: keine Ziffer dazwischen
    expect(row.slice(5, 8)).toEqual(['', ':', 'läuft']);
  });

  it('@BM-011 F3: ohne Schalter „Ergebnisse zeigen“ bleibt die Zelle von Spiel 11 leer', async () => {
    const stand = beendetesSpiel11();
    const pdf = await renderSchedulePdf(stand.schedule, undefined, { ...SCHEDULE_OPTIONS, tournament: stand.tournament, includeScores: false });
    const row = rowFrom(flatText(pdf), 11, matchByNumber(stand.schedule, 11).time, GRUPPEN_ZEILE);

    expect(row.slice(5, 7)).toEqual(['', ':']);
    expect(row[7]).toBe(sideName(matchByNumber(stand.schedule, 11), 'B'));
  });

  it('@BM-010 jede Seite trägt „Hallencup Nord · Stand 14.11. 15:07 · Seite x von y“ (gebaut in C3, Nachweis am PDF in schedulePdf.fusszeile.test.ts)', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);
    const zeile = /^Hallencup Nord · Stand \d{2}\.\d{2}\. \d{2}:\d{2} · Seite (\d+) von (\d+)$/;

    pdf.pages.forEach((page, i) => {
      const treffer = page.map(t => zeile.exec(t)).find(m => m !== null);
      expect(treffer?.[1], `Seite ${i + 1}`).toBe(String(i + 1));
      expect(treffer?.[2], `Seite ${i + 1}`).toBe(String(pdf.pages.length));
    });
  });

  it('IST @BM-032: Platzierung bleibt auch bei ausgeschalteten Tabellen (Bestand)', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, { ...SCHEDULE_OPTIONS, includeStandings: false });

    // Überschrift des Blocks mit den Plätzen („5 Platzierung“); die Regelzeile heißt seit G72 „Wertung“
    expect(flatText(pdf).some(t => /^\d+ Platzierung$/.test(t))).toBe(true);
  });

  it.fails('@BM-032 Ziel: ohne Tabellen keine Platzierung', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, { ...SCHEDULE_OPTIONS, includeStandings: false });

    expect(flatText(pdf).some(t => /^\d+ Platzierung$/.test(t))).toBe(false);
  });
});
