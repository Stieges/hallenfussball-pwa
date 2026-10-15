/**
 * Aushang A4 hoch mit Zuschauer-QR (B-28 C7, @BM-001, @BM-006, @BM-007, @BM-008, @BM-043, @ZM-060, @DR-010, @DR-022):
 * oben die Grafiken (nur wenn es welche gibt), der Turniername (vollständig, höchstens zwei Zeilen, bei Bedarf kleinere
 * Schrift), der Zuschauer-QR als Vektor (Kante mindestens 120 mm), darunter die Kurzadresse zum Abtippen, Aufruf und
 * Anleitung. Bei englischer App-Sprache stehen Aufruf und Anleitung zweisprachig in zwei Spalten (EN, DE). Nur Schwarz auf
 * Papier, kein Sponsor-Text, kein Stand. Nicht geteilt: kein Aushang, sondern die Fehlerart `notShared`.
 */
import type jsPDF from 'jspdf';
import { printColors, printUnit } from '../../design-tokens/print';
import { printNotice } from '../../design-tokens/print-notice';
import { qrModules, shortViewerAddress, viewerUrl } from '../qr/publicQr';
import { unrenderableChars } from './fonts';
import { noticePdfFilename } from './filename';
import { ascentMm, descentMm, pageGeometry } from './layout';
import { buildNoticeTexts, noticeShowsResults, type NoticeTexts } from './noticeTexts';
import { openDocument, renderContext, type PdfInput, type RenderContext } from './pdfInput';
import { drawLogo, usableLogo } from './render/headerGraphics';
import { drawQrSymbol, qrSide } from './render/qrCode';
import type { PdfLocale } from './translations';

/** Ergebnis: das fertige Dokument oder die Fehlerart. Nicht geteilt: kein Aushang (Hinweis im Dialog, C8). */
export type NoticeBuild =
  | { ok: true; doc: jsPDF; notes: string[]; filename: string }
  | { ok: false; reason: 'notShared' };

/** Zeilenabstand einer Schrift in mm. */
const advanceOf = (pt: number): number => pt * printNotice.lineEm * printUnit.mmPerPt;

/** Schreibt umbrochene Zeilen mittig um `cx`, Oberkante des Blocks bei `top`. Rückgabe: Unterkante der letzten Zeile. */
function centered(ctx: RenderContext, text: string, cx: number, width: number, top: number, pt: number, style: 'normal' | 'bold'): number {
  const { doc } = ctx;
  doc.setFont(ctx.font, style);
  doc.setFontSize(pt);
  const lines = doc.splitTextToSize(text, width) as string[];
  lines.forEach((line, i) => doc.text(line, cx, top + ascentMm(pt) + i * advanceOf(pt), { align: 'center' }));
  return top + ascentMm(pt) + (lines.length - 1) * advanceOf(pt) + descentMm(pt);
}

/** Turniername: größte Schrift, bei der er in höchstens zwei Zeilen passt; nie gekürzt (bleibt er darüber, gilt die kleinste). */
function titleFit(ctx: RenderContext, title: string, width: number): { lines: string[]; pt: number } {
  ctx.doc.setFont(ctx.font, 'bold');
  for (let pt: number = printNotice.titlePt; ; pt -= printNotice.titleStepPt) {
    ctx.doc.setFontSize(pt);
    const lines = ctx.doc.splitTextToSize(title, width) as string[];
    if (lines.length <= printNotice.titleMaxLines || pt - printNotice.titleStepPt < printNotice.titleMinPt) {
      return { lines, pt };
    }
  }
}

/** Kurzadresse: eine Zeile in der größten Schrift, die in die Breite passt. */
function addressFit(ctx: RenderContext, address: string, width: number): number {
  ctx.doc.setFont(ctx.font, 'bold');
  for (let pt: number = printNotice.addressPt; ; pt -= printNotice.titleStepPt) {
    ctx.doc.setFontSize(pt);
    if (ctx.doc.getTextWidth(address) <= width || pt - printNotice.titleStepPt < printNotice.addressMinPt) {
      return pt;
    }
  }
}

/** Aufruf und Anleitung einer Sprache in einer Spalte. Rückgabe: Unterkante. */
function column(ctx: RenderContext, texts: NoticeTexts, cx: number, width: number, top: number, bilingual: boolean): number {
  const callPt = bilingual ? printNotice.callBilingualPt : printNotice.callPt;
  const stepPt = bilingual ? printNotice.stepBilingualPt : printNotice.stepPt;
  let y = centered(ctx, texts.call, cx, width, top, callPt, 'bold') + printNotice.callGap;
  for (const step of texts.steps) {
    y = centered(ctx, step, cx, width, y, stepPt, 'normal') + printNotice.stepGap;
  }
  return y;
}

/** Baut den Aushang, ohne ihn zu speichern. */
export async function buildNoticePdf(input: PdfInput): Promise<NoticeBuild> {
  const url = viewerUrl(input.tournament, input.viewerBaseUrl);
  if (url === null) {
    return { ok: false, reason: 'notShared' };
  }
  const title = input.schedule.tournament.title;
  const opened = await openDocument({ ...input, orientation: 'portrait' });
  const ctx = renderContext(opened, pageGeometry('a4', 'portrait'));
  const { doc, geo, t } = ctx;
  const center = geo.left + geo.contentWidth / 2;
  const right = geo.left + geo.contentWidth;
  doc.setTextColor(...printColors.ink);
  doc.setDrawColor(...printColors.ink);

  // Hinweise vor dem Speichern: Grafik unbrauchbar, Zeichen, die als „?“ erscheinen (@DR-012, @DR-023)
  const logoLeft = usableLogo(input.graphics.left);
  const logoRight = usableLogo(input.graphics.right);
  const notes = [
    ...(opened.mode.fallback ? [t.fontFallbackNote] : []),
    ...(unrenderableChars(title, opened.mode.covers).length > 0 ? [t.unrenderableField(t.tournamentTitle, title)] : []),
    ...(input.graphics.left && !logoLeft ? [t.logoUnusable('left')] : []),
    ...(input.graphics.right && !logoRight ? [t.logoUnusable('right')] : []),
  ];

  // Grafiken: eine Zeile oben, nur wenn es eine gibt (keine Lücke); links und rechts bündig
  let y = geo.top;
  if (logoLeft || logoRight) {
    if (logoLeft) {
      drawLogo(doc, logoLeft, geo.left, y);
    }
    if (logoRight) {
      drawLogo(doc, logoRight, right - logoRight.w, y);
    }
    y += Math.max(logoLeft?.h ?? 0, logoRight?.h ?? 0) + printNotice.blockGap;
  }

  // Turniername, mittig, ganze Breite
  const fit = titleFit(ctx, title, geo.contentWidth);
  doc.setFont(ctx.font, 'bold');
  doc.setFontSize(fit.pt);
  fit.lines.forEach((line, i) => doc.text(line, center, y + ascentMm(fit.pt) + i * advanceOf(fit.pt), { align: 'center' }));
  y += ascentMm(fit.pt) + (fit.lines.length - 1) * advanceOf(fit.pt) + descentMm(fit.pt);

  // QR: Vektor, mittig; die Ruhezone ist der Abstand zum Titel
  const modules = qrModules(url);
  const side = qrSide(modules.length, printNotice.qrEdge);
  drawQrSymbol(doc, modules, printNotice.qrEdge, center - side / 2, y);
  y += side;

  // Kurzadresse zum Abtippen (führt zur selben Adresse wie der QR)
  const address = shortViewerAddress(url);
  const showsResults = noticeShowsResults(input.tournament);
  y = centered(ctx, buildNoticeTexts(input.translate, showsResults).addressLabel, center, geo.contentWidth, y, printNotice.addressLabelPt, 'normal');
  const addressPt = addressFit(ctx, address, geo.contentWidth);
  y = centered(ctx, address, center, geo.contentWidth, y, addressPt, 'bold') + printNotice.addressGap;

  // Aufruf und Anleitung: App-Sprache; bei Englisch zusätzlich Deutsch, zwei Spalten (@DR-022)
  const languages: PdfLocale[] = input.locale === 'en' ? ['en', 'de'] : [input.locale];
  const width = (geo.contentWidth - (languages.length - 1) * printNotice.columnGap) / languages.length;
  languages.forEach((language, i) => {
    const translate = language === input.locale ? input.translate : input.translateIn(language);
    const cx = geo.left + i * (width + printNotice.columnGap) + width / 2;
    column(ctx, buildNoticeTexts(translate, showsResults), cx, width, y, languages.length > 1);
  });

  return { ok: true, doc, notes, filename: noticePdfFilename(title) };
}
