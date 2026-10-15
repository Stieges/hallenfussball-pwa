/**
 * Fußzeile (B-28 C3, a3-6; @BM-010, @ZP-052, @BM-023, @DR-001, @W1-031/032): auf jeder Seite eine Linie und darunter
 * „{Titel} · Stand TT.MM. HH:mm · Seite x von y“. Ohne Netz trägt der Stand den Zusatz „– ohne Verbindung …“, in der
 * Fassung Endstand steht statt des Stands die Abschlusszeile. Der Kontakt steht als eigene Zeile, nur wenn der
 * Aufrufer ihn übergibt (Häkchen „Ansprechpartner öffentlich zeigen“).
 *
 * Die Zahl der Zeilen steht vor dem Satz fest (`countFooterLines`, größte Seitenzahl), damit der Satzspiegel Platz
 * lässt. Alle Zeilen liegen samt Unterlänge oberhalb des unteren Rands (`pageGeometry`). Nur Zeichnen.
 */
import type { jsPDF } from 'jspdf';
import { printColors, printMetrics, printStroke, printType } from '../../../design-tokens/print';
import type { PageGeometry } from '../layout';
import { fontOf } from '../fonts';
import { clipToWidth } from './textFit';

/** Inhalt der Fußzeile, fertig übersetzt. */
export interface FooterContent {
  title: string;
  /** „Stand 14.11. 15:07“ (mit Netzhinweis) oder die Abschlusszeile der Fassung Endstand. */
  stand: string;
  /** Kontaktzeile („Kontakt: …“); `undefined` = keine Zeile. */
  contact: string | undefined;
  /** Zusammenbau „{Titel} · {Stand} · Seite x von y“ (`standText.footerLine`). */
  line: (title: string, stand: string, page: number, total: number) => string;
}

function setFooterFace(doc: jsPDF): void {
  doc.setFont(fontOf(doc), 'normal');
  doc.setFontSize(printType.foot);
  doc.setTextColor(...printColors.ink);
}

/**
 * Zeilen der Hauptfußzeile einer Seite: eine Zeile; ist sie zu breit (langer Titel, Netzhinweis), bricht sie um. Der
 * Titel wird nie gekürzt (Daniel 15.10.).
 */
function mainRows(doc: jsPDF, content: FooterContent, width: number, page: number, total: number): string[] {
  return doc.splitTextToSize(content.line(content.title, content.stand, page, total), width) as string[];
}

/** Alle Zeilen einer Seite: Hauptfußzeile, dann der Kontakt (auf Breite gekürzt). */
export function footerRows(doc: jsPDF, content: FooterContent, width: number, page: number, total: number): string[] {
  setFooterFace(doc);
  const contact = content.contact === undefined ? [] : [clipToWidth(doc, content.contact, width)];
  return [...mainRows(doc, content, width, page, total), ...contact];
}

/** Zeilen, die der Satzspiegel freihalten muss: Maximum über die denkbar breiteste Seitenzahl. */
export function countFooterLines(doc: jsPDF, content: FooterContent, width: number): number {
  return footerRows(doc, content, width, printMetrics.footWorstPage, printMetrics.footWorstPage).length;
}

/** Zeichnet Fußlinie und Fußzeile auf jede Seite. Nach dem Satz aufrufen, wenn die Seitenzahl feststeht. */
export function drawFooters(doc: jsPDF, geo: PageGeometry, content: FooterContent): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setDrawColor(...printColors.ink);
    doc.setLineWidth(printStroke.foot);
    doc.line(geo.left, geo.footRuleY, geo.left + geo.contentWidth, geo.footRuleY);
    const rows = footerRows(doc, content, geo.contentWidth, page, total);
    rows.forEach((row, index) => {
      doc.text(row, geo.left, geo.footerY + index * printMetrics.footAdvance);
    });
  }
}
