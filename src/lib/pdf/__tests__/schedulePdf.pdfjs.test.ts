/**
 * Spielplan-PDF am gerenderten Dokument (B-28a2, Spur C): pdfjs liest die Bytes, nicht den Mitschnitt.
 * Nachweis: @BM-048 (Namen Zeichen für Zeichen), Review Focus 5, Sprache (`/Lang`), und der Abgleich
 * Mitschnitt ↔ pdfjs (jedes Textstück des Mitschnitts steht im PDF auf derselben Seite).
 */
import { describe, expect, it, vi } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { buildSchedulePdf } from '../schedulePdf';
import { HALLENCUP_TEAMS, hallencupTournament } from './pdfFixture';
import { extractPdfText, pdfLanguage, squash } from './pdfjsText';
import { flatText, renderSchedulePdf, translatorFor } from './pdfText';

// Mitschnitt für den Abgleich (siehe pdfCapture.ts).
vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('jspdf')>();
  const { capturingJsPdf } = await import('./pdfCapture');
  return { ...mod, default: capturingJsPdf(mod.default), jsPDF: capturingJsPdf(mod.jsPDF) };
});

function scheduleWithNames(names: string[]) {
  const teams: Team[] = HALLENCUP_TEAMS.map((team, i) => ({ ...team, name: names[i] ?? team.name }));
  return generateFullSchedule(hallencupTournament({ teams }), 'de');
}

/** Die Bytes, wie `exportScheduleToPDF` sie speichern würde. */
async function pdfBytes(schedule: ReturnType<typeof scheduleWithNames>, locale: 'de' | 'en' = 'de'): Promise<Uint8Array> {
  const { doc } = await buildSchedulePdf({
    schedule,
    standings: undefined,
    options: { locale, translate: translatorFor(locale) },
  });
  return new Uint8Array(doc.output('arraybuffer'));
}

function allText(pages: string[][]): string {
  return squash(pages.flat().join(''));
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const SPECIAL = ['Gençlerbirliği Nord', 'KS Łódź Süd', 'Fußball Düren 1907', 'Işıklar Ğazi', 'Źródło Ost'];
const LONG_50 = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';

/** Textstücke in Reihenfolge, leerer Leerraum entfernt. Abschnitte werden über Titel begrenzt. */
function tokensOf(pages: string[][]): string[] {
  return pages.flat().map(squash).filter(t => t !== '');
}

/** Stücke von `startToken` bis vor das erste Stück, das `endToken` gleicht (oder bis zum Ende). */
function section(tokens: string[], startToken: string, endToken?: string): string[] {
  const start = tokens.indexOf(startToken);
  if (start < 0) {throw new Error(`Abschnitt ${startToken} fehlt im PDF-Text`);}
  const end = endToken ? tokens.indexOf(endToken, start + 1) : -1;
  return tokens.slice(start, end < 0 ? undefined : end);
}

describe('@BM-048 aus dem PDF gelesen (pdfjs, ToUnicode)', () => {
  it.each(SPECIAL)('„%s“ steht je Ort einzeln: Teilnehmer, Spiele und Tabelle', async name => {
    const bytes = await pdfBytes(scheduleWithNames([name, ...HALLENCUP_TEAMS.slice(1).map(t => t.name)]));
    const tokens = tokensOf((await extractPdfText(bytes)).pages);
    const key = squash(name);
    // Teilnehmer: Zeile je Gruppe mit „n. Name“ (B-28a3-3b, kompakt); der Name steht in einem Stück.
    const participants = section(tokens, 'Teilnehmer', 'Gruppenphase');
    expect(participants.some(t => t.includes(key))).toBe(true);
    // Spiele: Zeile mit dem Namen als eigenes Stück in der Gruppenphase, vor der ersten Tabelle.
    const matches = section(tokens, 'Gruppenphase', 'Tabelle–GruppeA');
    expect(matches).toContain(key);
    // Tabelle Gruppe A: Name als eigenes Stück zwischen Titel und Gruppe B.
    const table = section(tokens, 'Tabelle–GruppeA', 'Tabelle–GruppeB');
    expect(table).toContain(key);
  });

  it('Gegenbeispiel: Namen ohne Sonderzeichen stehen unverändert', async () => {
    const pdf = await extractPdfText(await pdfBytes(generateFullSchedule(hallencupTournament(), 'de')));
    expect(allText(pdf.pages)).toContain(squash('FC Nord'));
  });
});

describe('@DR-014 Kyrillisch und Griechisch aus dem PDF gelesen', () => {
  it.each(['Динамо Север', 'Ολυμπιακός'])('„%s“ steht je Ort einzeln: Teilnehmer, Spiele und Tabelle', async name => {
    const bytes = await pdfBytes(scheduleWithNames([name, ...HALLENCUP_TEAMS.slice(1).map(t => t.name)]));
    const tokens = tokensOf((await extractPdfText(bytes)).pages);
    const key = squash(name);
    const participants = section(tokens, 'Teilnehmer', 'Gruppenphase');
    expect(participants.some(t => /^\d+\./.test(t) && t.endsWith(key))).toBe(true);
    const matches = section(tokens, 'Gruppenphase', 'Tabelle–GruppeA');
    expect(matches).toContain(key);
    const table = section(tokens, 'Tabelle–GruppeA', 'Tabelle–GruppeB');
    expect(table).toContain(key);
  });

  it('Gegenbeispiel DR-012: arabischer Name, das PDF entsteht trotzdem und ist lesbar', async () => {
    const bytes = await pdfBytes(scheduleWithNames(['الأهلي', ...HALLENCUP_TEAMS.slice(1).map(t => t.name)]));
    const pdf = await extractPdfText(bytes);
    expect(pdf.pages.length).toBeGreaterThan(0);
    expect(allText(pdf.pages)).toContain(squash('SV Süd'));
  });
});

describe('Review Focus 5: 50-Zeichen-Name aus dem PDF', () => {
  it('steht vollständig (Zeilenumbrüche in Zellen zählen nicht), ohne „…“', async () => {
    const pdf = await extractPdfText(await pdfBytes(scheduleWithNames([LONG_50, ...HALLENCUP_TEAMS.slice(1).map(t => t.name)])));
    const text = allText(pdf.pages);
    expect(occurrences(text, squash(LONG_50))).toBeGreaterThanOrEqual(3);
    expect(text).not.toContain('…');
  });
});

describe('Sprache: EN-Plan ohne deutsche Wörter', () => {
  it('kein deutscher Abschnittstitel, Phasen und Gruppen auf Englisch', async () => {
    const pdf = await extractPdfText(await pdfBytes(generateFullSchedule(hallencupTournament(), 'de'), 'en'));
    // Bekannte Ausnahme: Herkunftsplatzhalter der Finalspiele („Gruppe A - 2. Platz“) kommen aus dem Generator
    // und werden erst mit B-35 (`slotLabel`) übersetzt. Nur dieses Muster wird herausgenommen.
    const text = pdf.pages.flat().join(' ').replace(/Gruppe [A-Z] - \d\. Platz/g, '');
    // Negativliste: deutsche Wörter aus Titeln, Phasen und Gruppen.
    for (const word of ['Finalspiele', 'Halbfinale', 'Viertelfinale', 'Gruppe ', 'Gruppenphase', 'Teilnehmer', 'Tabelle', 'Platzierung', 'Spiel um Platz', 'Kein Datum']) {
      expect(text, word).not.toContain(word);
    }
    for (const word of ['Group stage', 'Group A', 'Teams', 'Standings', 'Final ranking', 'Finals']) {
      expect(text, word).toContain(word);
    }
  });
});

describe('Sprache des Dokuments', () => {
  it('/Lang entspricht der Sprache: de und en', async () => {
    const schedule = generateFullSchedule(hallencupTournament(), 'de');
    expect(pdfLanguage(await pdfBytes(schedule, 'de'))).toBe('de');
    expect(pdfLanguage(await pdfBytes(schedule, 'en'))).toBe('en');
  });

  it('EN-Lauf: englischer Abschnittstitel im gerenderten PDF, kein deutscher', async () => {
    const pdf = await extractPdfText(await pdfBytes(generateFullSchedule(hallencupTournament(), 'de'), 'en'));
    const text = pdf.pages.flat().join(' ');
    expect(text).toContain('Group stage');
    expect(text).not.toContain('Gruppenphase');
  });
});

describe('Abgleich Mitschnitt ↔ pdfjs', () => {
  it('jedes nicht-leere Textstück des Mitschnitts steht im PDF auf derselben Seite', async () => {
    const schedule = scheduleWithNames(['Gençlerbirliği Nord', 'KS Łódź Süd', ...HALLENCUP_TEAMS.slice(2).map(t => t.name)]);
    const captured = await renderSchedulePdf(schedule, undefined, {});
    const pdf = await extractPdfText(await pdfBytes(schedule));
    expect(pdf.pages).toHaveLength(captured.pages.length);
    captured.pages.forEach((page, i) => {
      const pdfPage = squash(pdf.pages[i].join(''));
      for (const piece of page) {
        const clean = squash(piece);
        if (clean === '') {continue;}
        expect(pdfPage, `Seite ${i + 1}: „${piece}“`).toContain(clean);
      }
    });
    expect(flatText(captured).length).toBeGreaterThan(0);
  });
});
