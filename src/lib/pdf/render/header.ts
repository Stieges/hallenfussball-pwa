/**
 * Kopf von Seite 1 (B-28a3-3b, @DR-006, @BM-009, @BM-052; B-28 C4, @DR-003, @DR-023, @DR-024): Kicker nur in der Fassung
 * „Spielplan ohne Ergebnisse“. Oben Grafik links · Turniertitel mittig über die Restbreite · Grafik rechts (fehlt eine,
 * bleibt der Titel dennoch mittig, ohne sichtbare Lücke). Darunter die zweispaltige Angabentabelle links (Bezeichnungen
 * fett, Werte normal, eine Schriftgröße) und rechts der Zuschauer-QR, nur wenn die Adresse bekannt ist. Der Titel bricht
 * um, wird nie gekürzt und hat höchstens drei Zeilen (bei Bedarf kleinere Schrift). Nur Zeichnen.
 */
import type { jsPDF } from 'jspdf';
import { printColors, printGap, printMetrics, printStroke, printType } from '../../../design-tokens/print';
import { printHeader } from '../../../design-tokens/print-header';
import { ascentMm, type PageGeometry } from '../layout';
import { fontOf } from '../fonts';
import { drawLogo, type PlacedLogo } from './headerGraphics';
import { drawQr, measureQr, type HeaderQr } from './qrCode';
import { wrapAtSeparators } from './textFit';

/** Eine Zeile der Angabentabelle: Bezeichnung fett, Wert normal. */
export interface HeaderFact {
  label: string;
  value: string;
}

/** Inhalt des Kopfs, fertig übersetzt. */
export interface HeaderInput {
  /** Kicker „Spielplan“ (beide Fassungen, Daniel 16.10.); beim Endstand leer. */
  kicker?: string;
  title: string;
  /** Angaben in Tabellenreihenfolge: Veranstalter, Altersklasse, Halle, Termin, Modus, Platzierung, Spielzeit, Regelwerk. */
  facts: HeaderFact[];
  /** Trenner, an dem ein langer Wert umbricht (G6), z. B. „ · “. */
  separator: string;
  /** Grafik links (Veranstalter) und rechts (z. B. Sponsor), bereits geprüft und bemessen (@DR-023). */
  logoLeft?: PlacedLogo;
  logoRight?: PlacedLogo;
  /** Zuschauer-QR; nur bei online geteiltem Turnier (@ZM-064). */
  qr?: HeaderQr;
}

/** Titel in `width` umbrochen; passt er nicht in drei Zeilen, wird die Schrift schrittweise kleiner (nie gekürzt). */
function fitTitle(doc: jsPDF, title: string, width: number): { lines: string[]; size: number } {
  let size: number = printType.title;
  for (;;) {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(title, width) as string[];
    if (lines.length <= printHeader.titleMaxLines || size - printHeader.titleStepPt < printHeader.titleMinPt) {
      return { lines, size };
    }
    size -= printHeader.titleStepPt;
  }
}

/**
 * Zeichnet den Kopf oben auf Seite 1, mit Kopflinie darunter. Rückgabe: Grundlinie des nächsten Abschnitts
 * (Titel des Teilnehmerblocks).
 */
export function renderHeader(doc: jsPDF, head: HeaderInput, geo: PageGeometry): number {
  const center = geo.left + geo.contentWidth / 2;
  const right = geo.left + geo.contentWidth;

  // Titelband: Restbreite zwischen den Grafiken, symmetrisch, damit der Titel mittig bleibt
  const side = Math.max(head.logoLeft?.w ?? 0, head.logoRight?.w ?? 0);
  const titleWidth = geo.contentWidth - (side > 0 ? 2 * (side + printHeader.logoGap) : 0);

  // Kicker (nur „Spielplan ohne Ergebnisse“), mittig wie der Titel
  let baseline = geo.top;
  if (head.kicker !== undefined && head.kicker !== '') {
    baseline += ascentMm(printType.kicker);
    doc.setTextColor(...printColors.ink);
    doc.setFont(fontOf(doc), 'bold');
    doc.setFontSize(printType.kicker);
    doc.text(head.kicker, center, baseline, { align: 'center' });
    baseline += printMetrics.kickerToTitle;
  }

  // Turniertitel, mittig über die Restbreite, umbrochen (bis drei Zeilen)
  doc.setTextColor(...printColors.ink);
  doc.setFont(fontOf(doc), 'bold');
  const title = fitTitle(doc, head.title, titleWidth);
  const advance = (printMetrics.titleAdvance * title.size) / printType.title;
  baseline += ascentMm(title.size);
  title.lines.forEach((line, index) => {
    if (index > 0) {
      baseline += advance;
    }
    doc.text(line, center, baseline, { align: 'center' });
  });

  // Grafiken: Oberkante des Satzspiegels, links und rechts bündig
  if (head.logoLeft) {
    drawLogo(doc, head.logoLeft, geo.left, geo.top);
  }
  if (head.logoRight) {
    drawLogo(doc, head.logoRight, right - head.logoRight.w, geo.top);
  }
  const logoBottom = geo.top + Math.max(head.logoLeft?.h ?? 0, head.logoRight?.h ?? 0);

  // Zeile unter dem Titelband: Angaben links, QR rechts. Beginnt unter der längeren von Titel und Grafik.
  const firstFact = ascentMm(printType.meta);
  let factsBaseline = baseline + printMetrics.headBlockGap;
  if (logoBottom > geo.top) {
    factsBaseline = Math.max(factsBaseline, logoBottom + printHeader.bandGap + firstFact);
  }
  const rowTop = factsBaseline - firstFact;
  const block = head.qr ? measureQr(doc, head.qr) : undefined;
  const qrLeft = block ? right - block.side : right;
  if (head.qr && block) {
    drawQr(doc, head.qr, block, qrLeft, rowTop);
  }

  // Angabentabelle: Bezeichnungen fett, Werte normal, eine Schriftgröße; alle Werte beginnen in derselben Spalte
  const width = block ? qrLeft - printHeader.qrColumnGap - geo.left : geo.contentWidth;
  const left = geo.left;
  baseline = factsBaseline;
  doc.setTextColor(...printColors.ink);
  doc.setFontSize(printType.meta);
  doc.setFont(fontOf(doc), 'bold');
  const labelWidth = Math.max(0, ...head.facts.map(fact => doc.getTextWidth(fact.label)));
  const valueLeft = left + labelWidth + printMetrics.factLabelGap;
  const room = Math.max(1, width - (valueLeft - left));
  for (const fact of head.facts) {
    doc.setFont(fontOf(doc), 'bold');
    doc.setFontSize(printType.meta);
    doc.text(fact.label, left, baseline);
    doc.setFont(fontOf(doc), 'normal');
    const valueLines = wrapAtSeparators(text => doc.getTextWidth(text), fact.value, room, head.separator, (part, w) => doc.splitTextToSize(part, w) as string[]);
    valueLines.forEach((line, index) => {
      if (index > 0) {
        baseline += printMetrics.factAdvance;
      }
      doc.text(line, valueLeft, baseline);
    });
    baseline += printMetrics.factAdvance;
  }
  baseline -= printMetrics.factAdvance;

  // Kopflinie unter der letzten Textzeile bzw. unter dem QR-Block, was tiefer liegt
  const qrBottom = block ? rowTop + block.height + printHeader.bandGap : 0;
  const ruleY = Math.max(baseline + printGap.headPadBottom, qrBottom);
  doc.setDrawColor(...printColors.ink);
  doc.setLineWidth(printStroke.head);
  doc.line(left, ruleY, left + geo.contentWidth, ruleY);

  return ruleY + printGap.sectionGap + ascentMm(printType.h2);
}
