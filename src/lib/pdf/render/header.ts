/**
 * Kopf von Seite 1 (B-28a3-3b, @DR-006, @BM-009, @BM-052): Kicker, Turniertitel mit Altersklasse, Angaben
 * (Veranstalter, Halle, Spieltag, Zeit) und darunter die Regelzeilen. Rechts bleibt die QR-Spalte frei, bis der
 * QR-Code kommt (@DR-003). Nur Zeichnen.
 */
import type { jsPDF } from 'jspdf';
import { printColors, printGap, printMetrics, printStroke, printType } from '../../../design-tokens/print';
import { ascentMm, type PageGeometry } from '../layout';
import { PDF_FONT } from '../fonts';

/** Eine Angabe im Kopf: Beschriftung mit Doppelpunkt, Wert fett. */
export interface HeaderFact {
  label: string;
  value: string;
}

/** Inhalt des Kopfs, fertig übersetzt. */
export interface HeaderInput {
  kicker: string;
  title: string;
  ageClass: string;
  facts: HeaderFact[];
  /** Regelzeilen aus `pdfRuleLines`; leer, wenn kein Turnier übergeben ist. */
  rules: string[];
}

/** Breite der Textspalte links von der QR-Spalte. */
export function headerTextWidth(geo: PageGeometry): number {
  return geo.contentWidth - printMetrics.qrColumnWidth - printMetrics.qrColumnGap;
}

/**
 * Zeichnet den Kopf oben auf Seite 1, mit Kopflinie darunter. Rückgabe: Grundlinie des nächsten Abschnitts
 * (Titel des Teilnehmerblocks).
 */
export function renderHeader(doc: jsPDF, head: HeaderInput, geo: PageGeometry): number {
  const width = headerTextWidth(geo);
  const left = geo.left;

  // Kicker: „Spielplan“ bzw. „Spielplan zum Ausfüllen“
  let baseline = geo.top + ascentMm(printType.kicker);
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.setFontSize(printType.kicker);
  doc.text(head.kicker, left, baseline);

  // Turniertitel, ggf. umbrochen; die Altersklasse steht in der letzten Zeile, wenn sie dort Platz hat
  baseline += printMetrics.kickerToTitle + ascentMm(printType.title);
  doc.setFontSize(printType.title);
  const titleLines = doc.splitTextToSize(head.title, width) as string[];
  titleLines.forEach((line, index) => {
    if (index > 0) {
      baseline += printMetrics.titleAdvance;
    }
    doc.text(line, left, baseline);
  });
  const lastLineWidth = doc.getTextWidth(titleLines[titleLines.length - 1] ?? '');
  doc.setFontSize(printType.age);
  const ageWidth = doc.getTextWidth(head.ageClass);
  if (lastLineWidth + printMetrics.ageGap + ageWidth <= width) {
    doc.text(head.ageClass, left + lastLineWidth + printMetrics.ageGap, baseline);
  } else {
    baseline += printMetrics.ageLineAdvance;
    doc.text(head.ageClass, left, baseline);
  }

  // Angaben: Beschriftung normal, Wert fett, Wert umbrochen unter dem Wert
  baseline += printMetrics.headBlockGap;
  doc.setFontSize(printType.meta);
  doc.setFont(PDF_FONT.family, 'normal');
  const labelWidth = Math.max(0, ...head.facts.map(fact => doc.getTextWidth(`${fact.label}:`)));
  const valueLeft = left + labelWidth + printMetrics.factLabelGap;
  for (const fact of head.facts) {
    doc.setFont(PDF_FONT.family, 'normal');
    doc.setFontSize(printType.meta);
    doc.text(`${fact.label}:`, left, baseline);
    doc.setFont(PDF_FONT.family, 'bold');
    const valueLines = doc.splitTextToSize(fact.value, width - (valueLeft - left)) as string[];
    valueLines.forEach((line, index) => {
      if (index > 0) {
        baseline += printMetrics.factAdvance;
      }
      doc.text(line, valueLeft, baseline);
    });
    baseline += printMetrics.factAdvance;
  }

  // Regelzeilen (10,5 pt), je Zeile umbrochen
  if (head.rules.length > 0) {
    baseline += printMetrics.factsToRules;
    doc.setFont(PDF_FONT.family, 'normal');
    doc.setFontSize(printType.note);
    for (const rule of head.rules) {
      const lines = doc.splitTextToSize(rule, width) as string[];
      for (const line of lines) {
        doc.text(line, left, baseline);
        baseline += printMetrics.ruleAdvance;
      }
    }
    baseline -= printMetrics.ruleAdvance;
  }

  // Kopflinie unter der letzten Textzeile
  const ruleY = baseline + printGap.headPadBottom;
  doc.setDrawColor(...printColors.ink);
  doc.setLineWidth(printStroke.head);
  doc.line(left, ruleY, left + geo.contentWidth, ruleY);

  return ruleY + printGap.sectionGap + ascentMm(printType.h2);
}
