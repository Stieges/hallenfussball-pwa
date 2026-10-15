/**
 * Kopf von Seite 1 (B-28a3-3b, @DR-006, @BM-009, @BM-052; Punkt 5 nach v7.2, Daniel 15.10.): Kicker nur in der Fassung
 * „Spielplan zum Ausfüllen“, Turniertitel mittig über die volle Seitenbreite, darunter eine zweispaltige Angabentabelle
 * (Bezeichnungen fett, Werte normal, eine Schriftgröße, alle Werte in einer Spalte). Rechts bleibt die QR-Spalte frei,
 * bis der QR-Code kommt (@DR-003). Nur Zeichnen.
 */
import type { jsPDF } from 'jspdf';
import { printColors, printGap, printMetrics, printStroke, printType } from '../../../design-tokens/print';
import { ascentMm, type PageGeometry } from '../layout';
import { fontOf } from '../fonts';

/** Eine Zeile der Angabentabelle: Bezeichnung fett, Wert normal. */
export interface HeaderFact {
  label: string;
  value: string;
}

/** Inhalt des Kopfs, fertig übersetzt. */
export interface HeaderInput {
  /** Kicker „Spielplan zum Ausfüllen“; in der normalen Fassung leer (Daniel 15.10.). */
  kicker?: string;
  title: string;
  /** Angaben in Tabellenreihenfolge: Veranstalter, Altersklasse, Halle, Termin, Modus, Platzierung, Spielzeit, Regelwerk. */
  facts: HeaderFact[];
}

/** Breite der Angabentabelle links von der QR-Spalte. */
export function headerTextWidth(geo: PageGeometry): number {
  return geo.contentWidth - printMetrics.qrColumnWidth - printMetrics.qrColumnGap;
}

/**
 * Zeichnet den Kopf oben auf Seite 1, mit Kopflinie darunter. Rückgabe: Grundlinie des nächsten Abschnitts
 * (Titel des Teilnehmerblocks).
 */
export function renderHeader(doc: jsPDF, head: HeaderInput, geo: PageGeometry): number {
  const center = geo.left + geo.contentWidth / 2;

  // Kicker (nur „Spielplan zum Ausfüllen“), mittig wie der Titel
  let baseline = geo.top;
  if (head.kicker !== undefined && head.kicker !== '') {
    baseline += ascentMm(printType.kicker);
    doc.setTextColor(...printColors.ink);
    doc.setFont(fontOf(doc), 'bold');
    doc.setFontSize(printType.kicker);
    doc.text(head.kicker, center, baseline, { align: 'center' });
    baseline += printMetrics.kickerToTitle;
  }

  // Turniertitel, mittig über die volle Seitenbreite, ggf. umbrochen (bis drei Zeilen)
  baseline += ascentMm(printType.title);
  doc.setTextColor(...printColors.ink);
  doc.setFont(fontOf(doc), 'bold');
  doc.setFontSize(printType.title);
  const titleLines = doc.splitTextToSize(head.title, geo.contentWidth) as string[];
  titleLines.forEach((line, index) => {
    if (index > 0) {
      baseline += printMetrics.titleAdvance;
    }
    doc.text(line, center, baseline, { align: 'center' });
  });

  // Angabentabelle: Bezeichnungen fett, Werte normal, eine Schriftgröße; alle Werte beginnen in derselben Spalte
  const width = headerTextWidth(geo);
  const left = geo.left;
  baseline += printMetrics.headBlockGap;
  doc.setFontSize(printType.meta);
  doc.setFont(fontOf(doc), 'bold');
  const labelWidth = Math.max(0, ...head.facts.map(fact => doc.getTextWidth(fact.label)));
  const valueLeft = left + labelWidth + printMetrics.factLabelGap;
  for (const fact of head.facts) {
    doc.setFont(fontOf(doc), 'bold');
    doc.setFontSize(printType.meta);
    doc.text(fact.label, left, baseline);
    doc.setFont(fontOf(doc), 'normal');
    const valueLines = doc.splitTextToSize(fact.value, Math.max(1, width - (valueLeft - left))) as string[];
    valueLines.forEach((line, index) => {
      if (index > 0) {
        baseline += printMetrics.factAdvance;
      }
      doc.text(line, valueLeft, baseline);
    });
    baseline += printMetrics.factAdvance;
  }
  baseline -= printMetrics.factAdvance;

  // Kopflinie unter der letzten Textzeile
  const ruleY = baseline + printGap.headPadBottom;
  doc.setDrawColor(...printColors.ink);
  doc.setLineWidth(printStroke.head);
  doc.line(left, ruleY, left + geo.contentWidth, ruleY);

  return ruleY + printGap.sectionGap + ascentMm(printType.h2);
}
