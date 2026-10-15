/**
 * Gemeinsame Helfer der Aushang-Tests (B-28 C7): Aushang bauen und über pdfjs lesen, QR-Fläche messen. Die
 * Aushang-Fixtures (`NOTICE_FIXTURES`) laufen auch durch die gemeinsamen Rand- und Schwarz-Weiß-Prüfungen (@DR-017).
 */
import { printFont, printUnit } from '../../../design-tokens/print';
import type { Tournament } from '../../../types/tournament';
import { buildNoticePdf, type NoticeBuild } from '../notice';
import { toPdfInput } from '../pdfInput';
import type { PDFExportOptions } from '../pdfOptions';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { readLayout, type Box, type LayoutPage, type LayoutText } from './pdfjsLayout';
import { fixtureLogo } from './pdfLogoFixture';
import { translatorFor } from './pdfText';

export const NOTICE_BASE_URL = 'https://hallenfussball.example';
export const NOTICE_TOL = 0.05;
export const SHARE_CODE = 'ABC123';
/** Genau 60 Zeichen (@BM-021); ein Test prüft die Länge. */
export const SIXTY = 'Internationaler Hallenfussball Wintercups Nordheim Sued 2026';
/** Der Name aus @BM-007, wörtlich. */
export const BM007_NAME = 'Hallen-Kreismeisterschaft der D-Junioren Nordheim-Süd 2026';

export interface NoticePdf {
  page: LayoutPage;
  pages: LayoutPage[];
  build: NoticeBuild;
  width: number;
  height: number;
}

/** Geteiltes Hallencup-Turnier mit den Überschreibungen; Optionen wie beim Spielplan. */
export function sharedTournament(overrides: Partial<Tournament> = {}): Tournament {
  return hallencupTournament({ isPublic: true, shareCode: SHARE_CODE, ...overrides });
}

export async function noticePdf(
  tournamentOverrides: Partial<Tournament> = {},
  options: Partial<PDFExportOptions> = {},
): Promise<NoticePdf> {
  const tournament = sharedTournament(tournamentOverrides);
  const locale = options.locale ?? 'de';
  const input = toPdfInput({
    schedule: hallencupSchedule(tournament),
    standings: undefined,
    options: { locale, translate: translatorFor(locale), tournament, viewerBaseUrl: NOTICE_BASE_URL, ...options },
  });
  const build = await buildNoticePdf(input);
  if (!build.ok) {
    throw new Error(`Aushang nicht gebaut: ${build.reason}`);
  }
  const pages = await readLayout(new Uint8Array(build.doc.output('arraybuffer')));
  return { page: pages[0], pages, build, width: build.doc.internal.pageSize.getWidth(), height: build.doc.internal.pageSize.getHeight() };
}

/** Alle schwarzen Füllungen der Seite: das sind die Module des QR (Aushang trägt sonst keine Fläche). */
export function qrBox(page: LayoutPage): Box {
  const x = Math.min(...page.rects.map(r => r.x));
  const y = Math.min(...page.rects.map(r => r.y));
  return { x, y, w: Math.max(...page.rects.map(r => r.x + r.w)) - x, h: Math.max(...page.rects.map(r => r.y + r.h)) - y };
}

/** Die gezeichnete Matrix, Zelle für Zelle in der Mitte jedes Moduls abgetastet. */
export function drawnNoticeMatrix(page: LayoutPage, size: number): boolean[][] {
  const box = qrBox(page);
  const module = box.w / size;
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      const cx = box.x + (c + 0.5) * module;
      const cy = box.y + (r + 0.5) * module;
      return page.rects.some(q => cx >= q.x && cx <= q.x + q.w && cy >= q.y && cy <= q.y + q.h);
    }),
  );
}

/** Rahmen eines Textstücks: Oberkante über der Grundlinie, Unterkante mit Unterlänge. */
export function noticeTextBox(t: LayoutText): Box {
  const up = t.size * printFont.ascentEm * printUnit.mmPerPt;
  const down = t.size * printFont.descentEm * printUnit.mmPerPt;
  return { x: t.x, y: t.y - up, w: t.w, h: up + down };
}

export const allText = (page: LayoutPage): string => page.texts.map(t => t.str).join(' ');

/** Die Aushang-Fixtures für die gemeinsamen Rand- und Farbprüfungen (@DR-017). */
export interface NoticeFixture {
  name: string;
  tournament: Partial<Tournament>;
  options: Partial<PDFExportOptions>;
}
export const NOTICE_FIXTURES: NoticeFixture[] = [
  { name: 'Aushang, deutsch', tournament: {}, options: {} },
  { name: 'Aushang, Kindermodus', tournament: { isKidsTournament: true }, options: {} },
  { name: 'Aushang, englisch', tournament: {}, options: { locale: 'en' } },
  { name: 'Aushang, 60-Zeichen-Titel', tournament: { title: SIXTY }, options: {} },
  { name: 'Aushang, @BM-007-Name mit zwei Grafiken', tournament: { title: BM007_NAME }, options: { logoLeft: fixtureLogo(2), logoRight: fixtureLogo(1) } },
  { name: 'Aushang, ungünstigster Fall: 60 Zeichen, englisch, zwei Grafiken', tournament: { title: SIXTY }, options: { locale: 'en', logoLeft: fixtureLogo(2), logoRight: fixtureLogo(1) } },
];
