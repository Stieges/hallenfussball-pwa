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

describe('@BM-048 aus dem PDF gelesen (pdfjs, ToUnicode)', () => {
  it.each(SPECIAL)('„%s“ steht Zeichen für Zeichen in Teilnehmern, Spielen und Tabelle', async name => {
    const bytes = await pdfBytes(scheduleWithNames([name, ...HALLENCUP_TEAMS.slice(1).map(t => t.name)]));
    const pdf = await extractPdfText(bytes);
    // Teilnehmer, mindestens eine Spielzeile und die Tabelle: je ein Vorkommen.
    expect(occurrences(allText(pdf.pages), squash(name))).toBeGreaterThanOrEqual(3);
  });

  it('Gegenbeispiel: Namen ohne Sonderzeichen stehen unverändert', async () => {
    const pdf = await extractPdfText(await pdfBytes(generateFullSchedule(hallencupTournament(), 'de')));
    expect(allText(pdf.pages)).toContain(squash('FC Nord'));
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
