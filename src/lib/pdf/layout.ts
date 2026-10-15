/**
 * Seitengeometrie und Seitenumbruch für das Spielplan-PDF (B-28a1, B-28a3-2). Rein, nur Maße aus den Druck-Tokens.
 *
 * Feste Reihenfolge: Teilnehmer und Gruppenspiele (Seite 1, Überlauf auf Folgeseiten), Tabellen (neue Seite),
 * Finalrunde mit Platzierung (neue Seite). Leere Abschnitte entfallen; die Aufrufer prüfen das vorab.
 */
import type { jsPDF } from 'jspdf';
import { printColors, printFont, printGap, printPage, printStroke, printType, printUnit } from '../../design-tokens/print';
import { PDF_FONT } from './fonts';

export type PdfFormat = 'a4';
export type PdfOrientation = 'portrait' | 'landscape';
/** Abschnitte in fester Reihenfolge. Der erste liegt auf Seite 1. */
export type PdfSection = 'participantsAndGroups' | 'tables' | 'finals';

export interface PageGeometry {
  width: number;
  height: number;
  /** Breite des Satzspiegels zwischen den Seitenrändern. */
  contentWidth: number;
  /** Oberkante des Satzspiegels, y der ersten Zeile auf Seite 1 eines Abschnitts. */
  top: number;
  /** Unterkante des Satzspiegels (y-Koordinate), oberhalb der Seitenzahl. */
  bottom: number;
  /** Grundlinie der Seitenzahl (y-Koordinate), am unteren Seitenrand. */
  footerY: number;
  /** Seitenränder in mm (links, rechts) – Abstand, nicht Koordinate. */
  left: number;
  right: number;
}

export function pageGeometry(format: PdfFormat, orientation: PdfOrientation): PageGeometry {
  const size = printPage[format][orientation];
  const margin = printPage.margin;
  return {
    width: size.width,
    height: size.height,
    contentWidth: size.width - margin.left - margin.right,
    top: margin.top,
    bottom: size.height - margin.bottom - printGap.footSpace,
    footerY: size.height - margin.bottom,
    left: margin.left,
    right: margin.right,
  };
}

/** Oberkante des Satzspiegels auf Folgeseiten: unter dem Kurzkopf. */
export function continuationTop(geo: PageGeometry): number {
  return geo.top + printGap.shortHeadHeight;
}

/** Oberlänge einer Zeile über der Grundlinie in mm: Schriftgröße (pt) × Ascent der Schrift. */
export function ascentMm(sizePt: number): number {
  return sizePt * printFont.ascentEm * printUnit.mmPerPt;
}

/** Grundlinie einer Zeile in `sizePt`, deren Oberkante auf `geo.top` liegt (@DR-001: oben mindestens 12 mm). */
export function firstBaseline(geo: PageGeometry, sizePt: number): number {
  return geo.top + ascentMm(sizePt);
}

/** Schriftgröße der ersten Zeile eines Abschnitts. */
const FIRST_LINE_PT: Record<PdfSection, number> = {
  participantsAndGroups: printType.title,
  tables: printType.caption,
  finals: printType.h2,
};

/**
 * Beginn eines Abschnitts. Seite 1 ist beim Dokumentstart schon da; jeder spätere Abschnitt beginnt auf einer neuen Seite.
 * Rückgabe: Grundlinie der ersten Zeile (Oberkante auf `geo.top`).
 */
export function startPage(doc: jsPDF, section: PdfSection, geo: PageGeometry): number {
  if (section !== 'participantsAndGroups') {
    doc.addPage();
  }
  return firstBaseline(geo, FIRST_LINE_PT[section]);
}

/**
 * Stellt sicher, dass `minSpace` mm ab `yPos` passen. Sonst neue Seite; Rückgabe ist die Grundlinie der ersten Zeile
 * dort. Gemessen mit h2, der größten Zeile, die nach einem Seitenumbruch steht (Gruppentitel, Phasentitel, Platzierung).
 */
export function ensureSpace(doc: jsPDF, yPos: number, minSpace: number, geo: PageGeometry): number {
  if (yPos + minSpace > geo.bottom) {
    doc.addPage();
    return firstBaseline(geo, printType.h2);
  }
  return yPos;
}

/**
 * Seitenränder für autoTable: links und rechts der Satzspiegel, unten bis zur Satzspiegel-Unterkante (@DR-001, M1),
 * oben `top` (Vorgabe: Oberkante; Folgeseiten mit Kurzkopf übergeben die Unterkante des Kopfs).
 */
export function tableMargins(geo: PageGeometry, top: number = geo.top): { left: number; right: number; top: number; bottom: number } {
  return { left: geo.left, right: geo.right, top, bottom: geo.height - geo.bottom };
}

/** Kurzkopf einer Folgeseite: Turniername groß, Altersklasse darunter, dünne Linie. Gezeichnet über `willDrawPage`. */
export function drawShortHead(doc: jsPDF, title: string, subtitle: string, geo: PageGeometry): void {
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.setFontSize(printType.titleShort);
  doc.text(title, geo.left, geo.top + printGap.shortHeadTitleBaseline);
  doc.setFontSize(printType.subtitle);
  doc.text(subtitle, geo.left, geo.top + printGap.shortHeadSubBaseline);
  doc.setDrawColor(...printColors.ink);
  doc.setLineWidth(printStroke.shortHead);
  doc.line(geo.left, geo.top + printGap.shortHeadRule, geo.left + geo.contentWidth, geo.top + printGap.shortHeadRule);
}

/**
 * Seitenzahl „Seite x von y“ rechts unten auf jeder Seite. Die Fußzeile mit Turniername und Stand folgt in a3-6.
 * Zählt alle Seiten des fertigen Dokuments, also nach dem letzten Abschnitt.
 */
export function drawPageNumbers(doc: jsPDF, geo: PageGeometry, label: (page: number, total: number) => string): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setFont(PDF_FONT.family, 'normal');
    doc.setFontSize(printType.foot);
    doc.setTextColor(...printColors.ink);
    doc.text(label(page, total), geo.left + geo.contentWidth, geo.footerY, { align: 'right' });
  }
}
