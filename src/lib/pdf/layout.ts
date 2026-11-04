/**
 * Seitengeometrie für das Spielplan-PDF (B-28a1, B-28a3-2, B-28a3-3b). Rein, nur Maße aus den Druck-Tokens. Welcher Abschnitt auf
 * welcher Seite steht, entscheidet das Seitenmodell (`model/pagePlan.ts`, `model/sectionFlow.ts`); jede Seite ab der zweiten
 * beginnt unter dem Kurzkopf (`render/shortHeader.ts`).
 */
import { printFont, printGap, printMetrics, printPage, printType, printUnit } from '../../design-tokens/print';
import { printFormat } from '../../design-tokens/print-format';
import { printHeader } from '../../design-tokens/print-header';

/** Angeboten wird A4; A3 und A2 sind vorbereitet (`print-format.ts`). */
export type PdfFormat = 'a4' | 'a3' | 'a2';
export type PdfOrientation = 'portrait' | 'landscape';
export interface PageGeometry {
  /** Maßstab des Formats gegenüber A4 (A4 = 1): die Ränder sind hier einmal skaliert; Schrift und Felder lesen ihn von hier. */
  scale: number;
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
 * endet über der Fußlinie. `shortQrSide` ist die Kante des QR-Blocks im Kurzkopf (0 ohne QR, @DR-003): der Kurzkopf ist
 * dann mindestens so hoch wie der Block plus `printHeader.qrRuleGap`: die Kopflinie liegt unter der Ruhezone, nicht in ihr.
 */
export function pageGeometry(format: PdfFormat, orientation: PdfOrientation, shortTitleLines = 1, footerLines = 1, shortQrSide = 0): PageGeometry {
  const { scale, [orientation]: size } = printFormat[format];
  // Maßstab an dieser einen Stelle: Ränder × scale; alles Weitere (Satzspiegel, Fuß) leitet sich aus ihnen ab
  const margin = { top: printPage.margin.top * scale, right: printPage.margin.right * scale, bottom: printPage.margin.bottom * scale, left: printPage.margin.left * scale };
  const lastBaseline = size.height - margin.bottom - descentMm(printType.foot);
  const footerY = lastBaseline - (footerLines - 1) * printMetrics.footAdvance;
  const footRuleY = footerY - ascentMm(printType.foot) - printGap.footRuleGap;
  return {
    scale,
    width: size.width,
    height: size.height,
    contentWidth: size.width - margin.left - margin.right,
    top: margin.top,
    shortHeadHeight: Math.max(
      printGap.shortHeadHeight + (shortTitleLines - 1) * printMetrics.shortTitleAdvance,
      shortQrSide > 0 ? shortQrSide + printHeader.qrRuleGap + printGap.shortHeadHeight - printGap.shortHeadRule : 0
    ),
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
