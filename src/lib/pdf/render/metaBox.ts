/**
 * Meta-Box des Spielplans: zweispaltig in einem abgerundeten Rahmen. Nur Zeichnen.
 *
 * Hinweis: Formularfelder (AcroForm) werden nicht verwendet, jsPDF kennt sie nicht. Die Felder sind leer gelassen.
 */
import type jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../../core/generators';
import { printColors, printFonts, printMetrics, printSpacing } from '../../../design-tokens/print';
import { getLocationAddressLine } from '../../../utils/locationHelpers';
import { ensureSpace, type PageGeometry } from '../layout';
import type { PdfTexts } from '../translations';

/** Spielzeit, falls die Gruppenphase keine Dauer liefert (Minuten). */
const DEFAULT_GROUP_DURATION_MIN = 10;

export function renderMetaBox(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  t: PdfTexts,
  organizerName: string,
  hallName: string,
  geo: PageGeometry,
  yPos: number
): number {
  const { metaPadding: padding, metaLineHeight: lineHeight, metaRowGap: rowGap, metaColumnGap: columnGap } = printMetrics;

  // Spielzeit aus dem ersten Gruppenspiel
  const firstGroupMatch = schedule.phases.find(p => p.name === 'groupStage')?.matches[0];
  const groupDuration = firstGroupMatch?.duration ?? DEFAULT_GROUP_DURATION_MIN;

  const startTime = schedule.startTime.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = schedule.endTime.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const mode = schedule.teams.some(team => team.group) ? 'Gruppen + Finals' : 'Jeder gegen Jeden';

  // Adresszeile der Halle (Straße, Ort)
  const locationAddressLine = getLocationAddressLine(schedule.tournament);

  // Datum als TT.MM.JJJJ
  const formatGameDay = (): string => {
    const dateStr = schedule.tournament.date;
    if (!dateStr) {
      return 'Kein Datum';
    }
    // Bereits im Format TT.MM.JJJJ: unverändert übernehmen
    if (dateStr.includes('.')) {
      return dateStr;
    }
    // Sonst aus JJJJ-MM-TT umbauen
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  // Linke Spalte. Veranstalter nur, wenn angegeben.
  const leftFields: { label: string; value: string }[] = [];
  if (organizerName) {
    leftFields.push({ label: t.organizer, value: organizerName });
  }
  leftFields.push(
    { label: t.hall, value: hallName },
    { label: t.gameday, value: formatGameDay() },
    { label: t.time, value: `${startTime} - ${endTime}` }
  );

  // Rechte Spalte
  const rightFields = [
    { label: t.mode, value: mode },
    { label: t.matchDuration, value: `${groupDuration} Min.` },
  ];

  // Breite der längsten Beschriftung je Spalte (inkl. Doppelpunkt)
  doc.setFontSize(printFonts.meta);
  doc.setFont('helvetica', 'normal');

  const leftMaxLabelWidth = Math.max(...leftFields.map(f => doc.getTextWidth(`${f.label}:`)));
  const rightMaxLabelWidth = Math.max(...rightFields.map(f => doc.getTextWidth(`${f.label}:`)));

  const valueStartXLeft = leftMaxLabelWidth + printMetrics.metaLabelGap;
  const valueStartXRight = rightMaxLabelWidth + printMetrics.metaLabelGap;

  // Höhe: die längere Spalte bestimmt, eine Zeile mehr bei Adresse
  const maxRows = Math.max(leftFields.length, rightFields.length);
  const extraLineForAddress = locationAddressLine ? 1 : 0;
  const contentHeight = maxRows * lineHeight + (maxRows - 1) * rowGap + padding * 2 + extraLineForAddress * lineHeight;

  // Platz für die Meta-Box
  yPos = ensureSpace(doc, yPos, contentHeight + printMetrics.metaExtraSpace, geo);
  const startY = yPos;
  const startX = geo.left;

  // Abgerundeter Rahmen
  doc.setDrawColor(...printColors.borderDark);
  doc.setLineWidth(printMetrics.metaBorderWidth);
  doc.roundedRect(startX, startY, geo.contentWidth, contentHeight, printMetrics.boxRadius, printMetrics.boxRadius);

  // Linke Spalte
  const leftColumnX = startX + padding;
  let currentYLeft = startY + padding + printMetrics.metaTextOffset;

  leftFields.forEach((field) => {
    doc.setFontSize(printFonts.meta);
    doc.setTextColor(...printColors.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(`${field.label}:`, leftColumnX, currentYLeft);

    doc.setTextColor(...printColors.textMain);
    doc.setFont('helvetica', 'bold');
    doc.text(field.value, leftColumnX + valueStartXLeft, currentYLeft);

    currentYLeft += lineHeight + rowGap;

    // Adresszeile unter „Halle“
    if (field.label === t.hall && locationAddressLine) {
      doc.setFontSize(printFonts.metaSmall);
      doc.setTextColor(...printColors.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text(locationAddressLine, leftColumnX + valueStartXLeft, currentYLeft);
      currentYLeft += lineHeight + rowGap;
    }
  });

  // Rechte Spalte
  const rightColumnX = startX + (geo.contentWidth / 2) + columnGap;
  let currentYRight = startY + padding + printMetrics.metaTextOffset;

  rightFields.forEach((field) => {
    doc.setFontSize(printFonts.meta);
    doc.setTextColor(...printColors.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(`${field.label}:`, rightColumnX, currentYRight);

    doc.setTextColor(...printColors.textMain);
    doc.setFont('helvetica', 'bold');
    doc.text(field.value, rightColumnX + valueStartXRight, currentYRight);

    currentYRight += lineHeight + rowGap;
  });

  yPos = startY + contentHeight + printSpacing.sectionGap;
  return yPos;
}
