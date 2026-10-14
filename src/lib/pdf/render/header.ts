/**
 * Kopf des Spielplans: Turniertitel und Altersklasse, zentriert. Nur Zeichnen.
 */
import type jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../../core/generators';
import { printColors, printFonts, printMetrics } from '../../../design-tokens/print';
import { ensureSpace, type PageGeometry } from '../layout';

export function renderHeader(doc: jsPDF, schedule: GeneratedSchedule, geo: PageGeometry, yPos: number): number {
  const centerX = geo.width / 2;

  // Platz für Titel + Untertitel
  yPos = ensureSpace(doc, yPos, printMetrics.headerMinSpace, geo);

  // Haupttitel aus den Turnierdaten
  doc.setFontSize(printFonts.h1);
  doc.setTextColor(...printColors.textMain);
  doc.setFont('helvetica', 'bold');
  doc.text(schedule.tournament.title, centerX, yPos, { align: 'center' });

  yPos += printMetrics.titleAdvance;

  // Untertitel (Altersklasse)
  doc.setFontSize(printFonts.h2);
  doc.setFont('helvetica', 'normal');
  doc.text(schedule.tournament.ageClass, centerX, yPos, { align: 'center' });

  yPos += printMetrics.subtitleAdvance;

  return yPos;
}
