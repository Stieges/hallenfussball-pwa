/**
 * Gemeinsame Helfer der Kopf-Tests (B-28 C4): PDF mit Hinweisen bauen und lesen, QR-Fläche und Textrahmen messen.
 */
import QRCode from 'qrcode';
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import { printFont, printUnit } from '../../../design-tokens/print';
import type { Tournament } from '../../../types/tournament';
import { generateLiveUrl } from '../../../utils/shareUtils';
import { buildSchedulePdf, type PDFExportOptions } from '../schedulePdf';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { ohneNummer } from './pdfFixtureLayout';
import type { Box, LayoutPage, LayoutText } from './pdfjsLayout';
import { readLayout } from './pdfjsLayout';
import { translatorFor } from './pdfText';

export const TOL = 0.05;
/** Ursprung der App im Test: Node hat kein `window`, ohne ihn trüge der QR nur `/#/live/…` (Review C4). */
export const BASE_URL = 'https://hallenfussball.example';

export interface KopfPdf {
  pages: LayoutPage[];
  notes: string[];
  width: number;
}

/** PDF des Hallencups (oder eines eigenen Plans) mit Hinweisen und gelesenem Layout. */
export async function kopfPdf(
  options: Partial<PDFExportOptions> = {},
  tournament: Tournament = hallencupTournament(),
  schedule: GeneratedSchedule = hallencupSchedule(tournament),
): Promise<KopfPdf> {
  const { doc, notes } = await buildSchedulePdf({
    schedule,
    standings: undefined,
    options: { locale: 'de', translate: translatorFor('de'), tournament, viewerBaseUrl: BASE_URL, ...options },
  });
  return { pages: await readLayout(new Uint8Array(doc.output('arraybuffer'))), notes, width: doc.internal.pageSize.getWidth() };
}

export const scheduleOf = (tournament: Tournament): GeneratedSchedule => generateFullSchedule(tournament, 'de');

/** Unterkante des Kopfs auf Seite 1: Grundlinie der Überschrift „Teilnehmer“. */
export function headBottom(page: LayoutPage): number {
  return page.texts.find(t => ohneNummer(t.str) === 'Teilnehmer')?.y ?? Number.POSITIVE_INFINITY;
}

/** Schwarze Füllungen im Kopf von Seite 1: die Module des QR-Codes. */
export function qrRects(page: LayoutPage): Box[] {
  const bottom = headBottom(page);
  return page.rects.filter(r => r.fill === '#000000' && r.y + r.h <= bottom);
}

export function bboxOf(boxes: Box[]): Box {
  const x = Math.min(...boxes.map(b => b.x));
  const y = Math.min(...boxes.map(b => b.y));
  return { x, y, w: Math.max(...boxes.map(b => b.x + b.w)) - x, h: Math.max(...boxes.map(b => b.y + b.h)) - y };
}

/** Die gezeichnete Matrix, gelesen aus den Rechtecken (Abtastung in der Mitte jedes Moduls). */
export function drawnMatrix(page: LayoutPage, size: number): boolean[][] {
  const rects = qrRects(page);
  const box = bboxOf(rects);
  const module = box.w / size;
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      const cx = box.x + (c + 0.5) * module;
      const cy = box.y + (r + 0.5) * module;
      return rects.some(q => cx >= q.x && cx <= q.x + q.w && cy >= q.y && cy <= q.y + q.h);
    }),
  );
}

/** Erwartete Matrix der Zuschauer-Adresse. */
export function expectedMatrix(code: string): boolean[][] {
  const { modules } = QRCode.create(generateLiveUrl(code, BASE_URL));
  return Array.from({ length: modules.size }, (_, r) => Array.from({ length: modules.size }, (_, c) => Boolean(modules.get(r, c))));
}

/** Rahmen eines Textstücks: Oberkante über der Grundlinie, Unterkante mit Unterlänge. */
export function textBox(t: LayoutText): Box {
  const up = t.size * printFont.ascentEm * printUnit.mmPerPt;
  const down = t.size * printFont.descentEm * printUnit.mmPerPt;
  return { x: t.x, y: t.y - up, w: t.w, h: up + down };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w - TOL && b.x < a.x + a.w - TOL && a.y < b.y + b.h - TOL && b.y < a.y + a.h - TOL;
}

/** Titelzeilen von Seite 1: die Textstücke in Titelgröße (26 pt oder kleiner nur im Titelband, größer als Kopfangaben). */
export function titleLines(page: LayoutPage, minSize: number): LayoutText[] {
  return page.texts.filter(t => t.size >= minSize && t.y < headBottom(page) && t.str.trim() !== '' && ohneNummer(t.str) !== 'Teilnehmer');
}
