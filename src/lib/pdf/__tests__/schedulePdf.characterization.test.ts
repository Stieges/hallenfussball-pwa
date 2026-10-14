/**
 * B-28a0 – Charakterisierung des Spielplan-PDFs von HEUTE (@BM-009), gegen die Fassade `exportScheduleToPDF`.
 *
 * Pflichttest echter Weg: echter Generator, echtes jsPDF, Text je Seite mitgeschnitten (Rückfall, siehe pdfText.ts).
 * Gegenbeispiel: `includeStandings: false` → keine Gruppentabelle.
 * Mutation (nach dem Commit, dann `git checkout`): in pdfExporter.ts Heim/Gast der Gruppenspiele vertauschen → Zeilen-Test rot.
 *
 * IST-Fälle: „IST @…“ = Bestand heute (grün). Das Ziel der Anforderung steht als `it.fails` daneben: läuft es
 * fehl, ist die Abweichung noch da. a3/a4 drehen die `it.fails` um.
 */
import { describe, it, expect, vi } from 'vitest';
import { getGroupShortCode } from '../../../utils/displayNames';
import {
  finalsMatches,
  groupMatches,
  hallencupSchedule,
  matchByNumber,
  sideName,
  withMatchScore,
} from './pdfFixture';
import { flatText, renderSchedulePdf } from './pdfText';

// jsPDF-Instanzen mitschreiben lassen (Rückfall-Mitschnitt, siehe pdfCapture.ts).
vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('jspdf')>();
  const { capturingJsPdf } = await import('./pdfCapture');
  return { ...mod, default: capturingJsPdf(mod.default), jsPDF: capturingJsPdf(mod.jsPDF) };
});

const SCHEDULE_OPTIONS = { locale: 'de' as const };
const HINWEIS = 'Ergebnisse bitte nach Spielende eintragen';

describe('schedulePdf – Charakterisierung heute (B-28a0, @BM-009)', () => {
  it('Pflichttest: A4 hoch (210 × 297) und Dateiname „Hallencup_Nord_Spielplan.pdf“', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);

    expect(pdf.pageWidth).toBeCloseTo(210, 1);
    expect(pdf.pageHeight).toBeCloseTo(297, 1);
    expect(pdf.filename).toBe('Hallencup_Nord_Spielplan.pdf');
  });

  it('Kopf: Turniertitel und Altersklasse stehen auf Seite 1', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);

    expect(pdf.pages[0]).toContain('Hallencup Nord');
    expect(pdf.pages[0]).toContain('D-Junioren');
  });

  it('Angaben: Veranstalter, Halle, Spieltag, Zeit, Modus und Spielzeit', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);
    const text = flatText(pdf);

    expect(text).toContain('Veranstalter:');
    expect(text).toContain('SV Nord 1921 e. V.');
    expect(text).toContain('Halle:');
    expect(text).toContain('Sporthalle am Park');
    expect(text).toContain('Spieltag:');
    expect(text).toContain('14.11.2026');
    expect(text).toContain('Zeit:');
    expect(text.some(t => /^13:00 - \d{2}:\d{2}$/.test(t))).toBe(true);
    expect(text).toContain('Modus:');
    expect(text).toContain('Gruppen + Finals');
    expect(text).toContain('Spielzeit:');
    expect(text).toContain('10 Min.');
  });

  it('Teilnehmer: Gruppen A und B, Teams alphabetisch in jeder Gruppe, durchlaufend nummeriert 1–8', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);
    const text = flatText(pdf);

    expect(text).toContain('Gruppe A');
    expect(text).toContain('Gruppe B');
    const expected = [
      '1. DJK Berg',
      '2. FC Nord',
      '3. SV Süd',
      '4. TuS Tal',
      '5. FC Mitte',
      '6. SC Ost',
      '7. SV Hof',
      '8. TSV West',
    ];
    for (const line of expected) {
      expect(text).toContain(line);
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
      expect(text[i + 6]).toBe(sideName(m, 'B'));
    }
  });

  it('Gegenbeispiel Ergebnis: beendetes Spiel 11 druckt „2 : 1“ nur mit eingeschaltetem Spielstand', async () => {
    const schedule = withMatchScore(hallencupSchedule(), 11, { scoreA: 2, scoreB: 1 });
    const m = matchByNumber(schedule, 11);

    const mit = flatText(await renderSchedulePdf(schedule, undefined, { ...SCHEDULE_OPTIONS, includeScores: true }));
    const i = mit.findIndex((t, idx) => t === '11' && mit[idx + 1] === m.time);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(mit[i + 5]).toBe('2 : 1');

    const ohne = flatText(await renderSchedulePdf(schedule, undefined, { ...SCHEDULE_OPTIONS, includeScores: false }));
    expect(ohne).not.toContain('2 : 1');
  });

  it('Finalrunde: Untertitel „Spiel um Platz 3“ und beide Teams des Finales', async () => {
    const schedule = hallencupSchedule();
    const pdf = await renderSchedulePdf(schedule, undefined, SCHEDULE_OPTIONS);
    const text = flatText(pdf);
    const finale = finalsMatches(schedule).find(m => m.finalType === 'final');

    expect(finale).toBeDefined();
    expect(text).toContain('Spiel um Platz 3');
    if (finale) {
      expect(text).toContain(sideName(finale, 'A'));
      expect(text).toContain(sideName(finale, 'B'));
    }
  });

  it('Tabellen bei includeStandings: „Tabelle – Gruppe A“ und „Tabelle – Gruppe B“ stehen im PDF', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, { ...SCHEDULE_OPTIONS, includeStandings: true });
    const text = flatText(pdf);

    expect(text).toContain('Tabelle – Gruppe A');
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

    const platz = text.lastIndexOf('Platzierung');
    expect(platz).toBeGreaterThan(-1);
    if (finale) {
      expect(platz).toBeGreaterThan(text.lastIndexOf(sideName(finale, 'B')));
    }
  });

  it('Hinweiszeile „Ergebnisse bitte nach Spielende eintragen“ steht auf Seite 1', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);

    expect(pdf.pages[0]).toContain(HINWEIS);
  });
});

describe('IST-Abweichungen gegen Anforderung (B-28a0): Bestand grün, Ziel als it.fails', () => {
  it('IST @BM-012: laufendes Spiel druckt 1 : 0 (Bestand)', async () => {
    const schedule = withMatchScore(hallencupSchedule(), 12, { scoreA: 1, scoreB: 0 });
    const pdf = await renderSchedulePdf(schedule, undefined, { ...SCHEDULE_OPTIONS, includeScores: true });

    expect(flatText(pdf)).toContain('1 : 0');
  });

  it.fails('@BM-012 Ziel: laufendes Spiel ohne Zwischenstand, Zeile „läuft“', async () => {
    const schedule = withMatchScore(hallencupSchedule(), 12, { scoreA: 1, scoreB: 0 });
    const pdf = await renderSchedulePdf(schedule, undefined, { ...SCHEDULE_OPTIONS, includeScores: true });
    const text = flatText(pdf);

    expect(text).toContain('läuft');
    expect(text).not.toContain('1 : 0');
  });

  it('IST @BM-011: beendetes Spiel erscheint nur mit Schalter „Mit Spielstand“ (Bestand)', async () => {
    const schedule = withMatchScore(hallencupSchedule(), 11, { scoreA: 2, scoreB: 1 });
    const pdf = await renderSchedulePdf(schedule, undefined, { ...SCHEDULE_OPTIONS, includeScores: false });

    expect(flatText(pdf)).not.toContain('2 : 1');
  });

  it.fails('@BM-011 Ziel: beendetes Spiel 11 druckt „2 : 1“ auch ohne Schalter', async () => {
    const schedule = withMatchScore(hallencupSchedule(), 11, { scoreA: 2, scoreB: 1 });
    const pdf = await renderSchedulePdf(schedule, undefined, { ...SCHEDULE_OPTIONS, includeScores: false });

    expect(flatText(pdf)).toContain('2 : 1');
  });

  it('IST @BM-010: keine Seitenzahl und kein Stand auf den Seiten (Bestand)', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);
    const text = flatText(pdf);

    expect(text.some(t => t.startsWith('Seite '))).toBe(false);
    expect(text.some(t => t.includes('Stand '))).toBe(false);
  });

  it.fails('@BM-010 Ziel: jede Seite trägt „Stand … · Seite x von y“', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, SCHEDULE_OPTIONS);

    for (const page of pdf.pages) {
      expect(page.some(t => t.includes('Seite ') && t.includes(' von '))).toBe(true);
    }
  });

  it('IST @BM-032: Platzierung bleibt auch bei ausgeschalteten Tabellen (Bestand)', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, { ...SCHEDULE_OPTIONS, includeStandings: false });

    expect(flatText(pdf)).toContain('Platzierung');
  });

  it.fails('@BM-032 Ziel: ohne Tabellen keine Platzierung', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, { ...SCHEDULE_OPTIONS, includeStandings: false });

    expect(flatText(pdf)).not.toContain('Platzierung');
  });
});
