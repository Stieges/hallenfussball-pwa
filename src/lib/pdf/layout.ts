/**
 * Seitengeometrie und Seitenumbruch für das Spielplan-PDF (B-28a1, B-28a3-2, B-28a3-3b). Rein, nur Maße aus den
 * Druck-Tokens.
 *
 * Feste Reihenfolge: Kopf, Teilnehmer und Gruppenspiele (Seite 1, Überlauf auf Folgeseiten), Tabellen (neue Seite),
 * Finalrunde mit Platzierung (neue Seite). Leere Abschnitte entfallen; die Aufrufer prüfen das vorab. Jede Seite
 * ab der zweiten beginnt unter dem Kurzkopf (`render/shortHeader.ts`).
 */
import type { jsPDF } from 'jspdf';
import { printFont, printGap, printMetrics, printPage, printType, printUnit } from '../../design-tokens/print';

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
  /** Höhe des Kurzkopfs bis zum Inhalt der Folgeseiten (wächst mit einer zweiten Titelzeile). */
  shortHeadHeight: number;
  /** Unterkante des Satzspiegels (y-Koordinate), oberhalb der Fußlinie. */
  bottom: number;
  /** Fußlinie (y-Koordinate): darunter steht die Fußzeile. */
  footRuleY: number;
  /** Grundlinie der ersten Fußzeile (y-Koordinate). Die letzte reservierte Zeile samt Unterlänge endet am Seitenrand. */
  footerY: number;
  /** Zahl der reservierten Fußzeilen (Titel/Stand/Seite, dazu Netzhinweis oder Kontakt, falls nötig). */
  footerLines: number;
  /** Seitenränder in mm (links, rechts) – Abstand, nicht Koordinate. */
  left: number;
  right: number;
}

/**
 * Maße einer Seite. `shortTitleLines` ist die Zahl der Titelzeilen des Kurzkopfs (1 oder 2, `shortHeader.ts`); sie
 * verschiebt den Satzspiegel der Folgeseiten nach unten. `footerLines` ist die Zahl der Fußzeilen (`render/footer.ts`);
 * die Fußzeile steht samt Unterlänge der letzten Zeile oberhalb des unteren Rands (@DR-001, B5b), der Satzspiegel
 * endet über der Fußlinie.
 */
export function pageGeometry(format: PdfFormat, orientation: PdfOrientation, shortTitleLines = 1, footerLines = 1): PageGeometry {
  const size = printPage[format][orientation];
  const margin = printPage.margin;
  const lastBaseline = size.height - margin.bottom - descentMm(printType.foot);
  const footerY = lastBaseline - (footerLines - 1) * printMetrics.footAdvance;
  const footRuleY = footerY - ascentMm(printType.foot) - printGap.footRuleGap;
  return {
    width: size.width,
    height: size.height,
    contentWidth: size.width - margin.left - margin.right,
    top: margin.top,
    shortHeadHeight: printGap.shortHeadHeight + (shortTitleLines - 1) * printMetrics.shortTitleAdvance,
    bottom: footRuleY - printGap.footSpace,
    footRuleY,
    footerY,
    footerLines,
    left: margin.left,
    right: margin.right,
  };
}

/** Oberkante des Satzspiegels auf Folgeseiten: unter dem Kurzkopf. */
export function continuationTop(geo: PageGeometry): number {
  return geo.top + geo.shortHeadHeight;
}

/** Oberlänge einer Zeile über der Grundlinie in mm: Schriftgröße (pt) × Ascent der Schrift. */
export function ascentMm(sizePt: number): number {
  return sizePt * printFont.ascentEm * printUnit.mmPerPt;
}

/** Unterlänge einer Zeile unter der Grundlinie in mm: Schriftgröße (pt) × Descent der Schrift. */
export function descentMm(sizePt: number): number {
  return sizePt * printFont.descentEm * printUnit.mmPerPt;
}

/** Grundlinie einer Zeile in `sizePt`, deren Oberkante auf `top` liegt (Vorgabe: `geo.top`, @DR-001 oben 12 mm). */
export function firstBaseline(geo: PageGeometry, sizePt: number, top: number = geo.top): number {
  return top + ascentMm(sizePt);
}

/** Schriftgröße der ersten Zeile eines Abschnitts. */
const FIRST_LINE_PT: Record<PdfSection, number> = {
  participantsAndGroups: printType.title,
  tables: printType.caption,
  finals: printType.h2,
};

/**
 * Beginn eines Abschnitts. Seite 1 ist beim Dokumentstart schon da; jeder spätere Abschnitt beginnt auf einer neuen Seite
 * unter dem Kurzkopf. Rückgabe: Grundlinie der ersten Zeile.
 */
export function startPage(doc: jsPDF, section: PdfSection, geo: PageGeometry): number {
  if (section === 'participantsAndGroups') {
    return firstBaseline(geo, FIRST_LINE_PT[section]);
  }
  doc.addPage();
  return firstBaseline(geo, FIRST_LINE_PT[section], continuationTop(geo));
}

/**
 * Stellt sicher, dass `minSpace` mm ab `yPos` passen. Sonst neue Seite unter dem Kurzkopf; Rückgabe ist die Grundlinie
 * der ersten Zeile dort. Gemessen mit h2, der größten Zeile, die nach einem Seitenumbruch steht (Gruppentitel,
 * Phasentitel, Platzierung).
 */
export function ensureSpace(doc: jsPDF, yPos: number, minSpace: number, geo: PageGeometry): number {
  if (yPos + minSpace > geo.bottom) {
    doc.addPage();
    return firstBaseline(geo, printType.h2, continuationTop(geo));
  }
  return yPos;
}

/**
 * Seitenränder für autoTable: links und rechts der Satzspiegel, unten bis zur Satzspiegel-Unterkante (@DR-001, M1),
 * oben `top` (Vorgabe: Oberkante der Folgeseite unter dem Kurzkopf).
 */
export function tableMargins(geo: PageGeometry, top: number = continuationTop(geo)): { left: number; right: number; top: number; bottom: number } {
  return { left: geo.left, right: geo.right, top, bottom: geo.height - geo.bottom };
}
