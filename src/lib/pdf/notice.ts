/**
 * Aushang A4 hoch mit Zuschauer-QR (B-28 C7/C8, @BM-001, @BM-006, @BM-007, @BM-008, @BM-043, @ZM-060, @DR-010, @DR-022):
 * oben die Grafiken (nur wenn es welche gibt, eigene Zeile, G56), der Turniername (vollständig, höchstens zwei Zeilen,
 * bei Bedarf kleinere Schrift), direkt darunter der Aufruf, dann der Zuschauer-QR als Vektor (Kante mindestens 120 mm),
 * darunter die Schritte zum Scannen und zuletzt „Oder im Browser eintippen:“ mit der Adresse ohne `https://` in
 * mindestens 20 pt (G54, G55). Die Sprache ist allein `PdfInput.locale` (@DR-022, einsprachig). Nur Schwarz auf Papier,
 * kein Sponsor-Text, kein Stand. Nicht geteilt: kein Aushang, sondern die Fehlerart `notShared`.
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

/** Ergebnis: das fertige Dokument oder die Fehlerart. Nicht geteilt: kein Aushang (Hinweis im Dialog, C8). */
export type NoticeBuild =
  | { ok: true; doc: jsPDF; notes: string[]; filename: string }
  | { ok: false; reason: 'notShared' };

/** Zeilenabstand einer Schrift in mm, `lineEm` als Vielfaches der Schrift. */
const advanceOf = (pt: number, lineEm: number = printNotice.lineEm): number => pt * lineEm * printUnit.mmPerPt;

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

/**
 * Adresse zum Abtippen in `addressPt` (mindestens 20 pt, nie kleiner, G55). Was nicht in eine Zeile passt, bricht nach
 * einem „/“ oder „.“ um; jede Zeile bleibt in der Schrift und im Satzspiegel.
 */
function addressLines(ctx: RenderContext, address: string, width: number): string[] {
  ctx.doc.setFont(ctx.font, 'bold');
  ctx.doc.setFontSize(printNotice.addressPt);
  const parts = address.match(/[^/.]+[/.]?|[/.]/g) ?? [address];
  const lines: string[] = [];
  let line = '';
  for (const part of parts) {
    if (line !== '' && ctx.doc.getTextWidth(line + part) > width) {
      lines.push(line);
      line = part;
    } else {
      line += part;
    }
  }
  return line === '' ? lines : [...lines, line];
}

/** Die Schritte zum Scannen, mittig in der Breite. Rückgabe: Unterkante. */
function stepsBlock(ctx: RenderContext, texts: NoticeTexts, cx: number, width: number, top: number): number {
  let y = top;
  for (const step of texts.steps) {
    y = centered(ctx, step, cx, width, y, printNotice.stepPt, 'normal') + printNotice.stepGap;
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
  fit.lines.forEach((line, i) => doc.text(line, center, y + ascentMm(fit.pt) + i * advanceOf(fit.pt, printNotice.titleLineEm), { align: 'center' }));
  y += ascentMm(fit.pt) + (fit.lines.length - 1) * advanceOf(fit.pt, printNotice.titleLineEm) + descentMm(fit.pt);

  // Aufruf direkt unter dem Titel (G54), in der Sprache des Eingangs (@DR-022)
  const notice = buildNoticeTexts(input.translate, noticeShowsResults(input.tournament));
  y = centered(ctx, notice.call, center, geo.contentWidth, y + printNotice.callGap, printNotice.callPt, 'bold');

  // QR: Vektor, mittig; die Ruhezone ist Teil der Fläche und der Abstand zu Aufruf und Schritten
  const modules = qrModules(url);
  const side = qrSide(modules.length, printNotice.qrEdge);
  drawQrSymbol(doc, modules, printNotice.qrEdge, center - side / 2, y);
  y += side;

  // Schritte zum Scannen, zuletzt „Oder im Browser eintippen:“ mit der Adresse (führt zur selben Adresse wie der QR)
  y = stepsBlock(ctx, notice, center, geo.contentWidth, y) + printNotice.stepsToAddress;
  y = centered(ctx, notice.addressLabel, center, geo.contentWidth, y, printNotice.addressLabelPt, 'normal');
  for (const line of addressLines(ctx, shortViewerAddress(url), geo.contentWidth)) {
    y = centered(ctx, line, center, geo.contentWidth, y, printNotice.addressPt, 'bold');
  }

  return { ok: true, doc, notes, filename: noticePdfFilename(title) };
}
