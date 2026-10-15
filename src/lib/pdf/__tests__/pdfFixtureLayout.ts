/**
 * Gemeinsame Helfer der Seitentests des Spielplan-PDFs (B-28a3-2, Fixrunde): Fixtures mit 12 und 20 Spielen, hoch und
 * quer, und das Lesen des fertigen PDFs über `pdfjsLayout`.
 */
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { buildSchedulePdf } from '../schedulePdf';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { readLayout, type LayoutPage } from './pdfjsLayout';
import { translatorFor, type TestPdfOptions } from './pdfText';

/** Zehn Teams in zwei Gruppen à fünf: 20 Gruppenspiele. */
export const ZEHN_TEAMS: Team[] = [
  'FC Nord', 'SV Süd', 'DJK Berg', 'TuS Tal', 'SC Hügel',
  'TSV West', 'SC Ost', 'FC Mitte', 'SV Hof', 'TuS Weit',
].map((name, i) => ({ id: `team-${i}`, name, group: i < 5 ? 'A' : 'B' }));

export function zwanzigSchedule(): GeneratedSchedule {
  return generateFullSchedule(hallencupTournament({ teams: ZEHN_TEAMS, numberOfTeams: ZEHN_TEAMS.length }), 'de');
}

/** Zwölf Teams in zwei Gruppen à sechs: 30 Gruppenspiele. Sie laufen über mehr als eine Seite (B-28a3-3b, @DR-002). */
export function dreissigSchedule(): GeneratedSchedule {
  const names = ['FC Nord', 'SV Süd', 'DJK Berg', 'TuS Tal', 'SC Hügel', 'TSV West', 'SC Ost', 'FC Mitte', 'SV Hof', 'TuS Weit', 'SV Ahorn', 'FC Linde'];
  const teams: Team[] = names.map((name, i) => ({ id: `team-${i}`, name, group: i < 6 ? 'A' : 'B' }));
  return generateFullSchedule(hallencupTournament({ teams, numberOfTeams: teams.length }), 'de');
}

export interface PdfLesung {
  pages: LayoutPage[];
  width: number;
  height: number;
}

/** Seiten des fertigen PDFs, so wie `exportScheduleToPDF` sie speichern würde. */
export async function layoutOf(options: TestPdfOptions = {}, schedule: GeneratedSchedule = hallencupSchedule()): Promise<PdfLesung> {
  const { doc } = await buildSchedulePdf({
    schedule,
    standings: undefined,
    options: { locale: 'de', translate: translatorFor('de'), tournament: hallencupTournament(), ...options },
  });
  const pages = await readLayout(new Uint8Array(doc.output('arraybuffer')));
  return { pages, width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
}

export interface PdfFixture {
  name: string;
  options: TestPdfOptions;
  schedule: () => GeneratedSchedule;
}

/** Die vier Pflicht-Fixtures: 12 und 20 Spiele, jeweils hoch und quer. */
export const FIXTURES: PdfFixture[] = [
  { name: '12 Spiele, hoch', options: {}, schedule: hallencupSchedule },
  { name: '20 Spiele, hoch', options: {}, schedule: zwanzigSchedule },
  { name: '12 Spiele, quer', options: { orientation: 'landscape' }, schedule: hallencupSchedule },
  { name: '20 Spiele, quer', options: { orientation: 'landscape' }, schedule: zwanzigSchedule },
];

/** Titeltext ohne die laufende Abschnittsnummer („4 Halbfinale“ → „Halbfinale“, B-28 C3). */
export const ohneNummer = (text: string): string => text.trim().replace(/^\d+ /, '');

/** Alle Textstücke einer Seite, durch Leerzeichen verbunden. */
export function pageText(page: LayoutPage): string {
  return page.texts.map(t => t.str).join(' ');
}
