/**
 * Kopf des Spielplans: Turniertitel und Altersklasse, zentriert. Nur Zeichnen.
 */
import type jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../../core/generators';
import { printColors, printType, printMetrics } from '../../../design-tokens/print';
import { ensureSpace, type PageGeometry } from '../layout';
import { PDF_FONT } from '../fonts';

export function renderHeader(doc: jsPDF, schedule: GeneratedSchedule, geo: PageGeometry, yPos: number): number {
  const centerX = geo.width / 2;

  // Platz für Titel + Untertitel
  yPos = ensureSpace(doc, yPos, printMetrics.headerMinSpace, geo);

  // Haupttitel aus den Turnierdaten
  doc.setFontSize(printType.title);
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.text(schedule.tournament.title, centerX, yPos, { align: 'center' });

  yPos += printMetrics.titleAdvance;

  // Untertitel (Altersklasse)
  doc.setFontSize(printType.age);
  doc.setFont(PDF_FONT.family, 'normal');
  doc.text(schedule.tournament.ageClass, centerX, yPos, { align: 'center' });

  yPos += printMetrics.subtitleAdvance;

  return yPos;
}
