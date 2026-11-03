/**
 * Fußzeile (B-28 C3, a3-6; @DR-044, @BM-010, @ZP-052, @BM-023, @DR-001, @W1-031/032): auf jeder Seite eine Linie und feste Plätze.
 * Links oben „Live-Ergebnisse und aktuelle Zeiten:“ mit der Adresse als Link, darunter links „{Titel} · Stand …“ (der Titel bricht in
 * seiner Spalte um, nie gekürzt), rechts unten auf der letzten Zeile „Seite x von y“, auf jeder Seite an derselben Stelle. Mit
 * Häkchen steht der Ansprechpartner in einer eigenen Zeile („Ansprechpartner: Name · Telefon · E-Mail“), er bricht um und wird nie
 * gekürzt; ohne Häkchen gibt es keine Zeile und keine Lücke. Die Zahl der Zeilen hängt nicht von der Seite ab (gleiche Höhe überall)
 * und steht vor dem Satz fest (`countFooterLines`). Alle Zeilen liegen samt Unterlänge oberhalb des unteren Rands (`pageGeometry`).
 * Nur Zeichnen.
 */
import type { jsPDF } from 'jspdf';
import { printColors, printMetrics, printStroke, printType } from '../../../design-tokens/print';
import { printSheetHead } from '../../../design-tokens/print-sheet';
import { ascentMm, descentMm, type PageGeometry } from '../layout';
import { fontOf } from '../fonts';
import { drawLinks, drawUnderline } from './links';

/** Inhalt der Fußzeile, fertig übersetzt. */
export interface FooterContent {
  title: string;
  /** „Stand 14.11. 15:07“ (mit Netzhinweis) oder die Abschlusszeile der Fassung Endstand. */
  stand: string;
  /** Trenner zwischen Titel und Stand („ · “). */
  join: string;
  /** Zeile „Ansprechpartner: …“; `undefined` = keine Zeile. */
  contact: string | undefined;
  /** „Seite x von y“ (`pdf.pageOf`). */
  pageLabel: (page: number, total: number) => string;
  /**
   * Adresse der Zuschauer-Seite in einer eigenen ersten Zeile, davor ein Satz (@DR-038): `address` ohne „https://“ ist
   * fett, unterstrichen und antippbar; fehlt es (nicht online geteilt), gibt es weder Zeile noch Link.
   */
  link?: { prefix: string; address: string; url: string };
}

function setFooterFace(doc: jsPDF): void {
  doc.setFont(fontOf(doc), 'normal');
  doc.setFontSize(printType.foot);
  doc.setTextColor(...printColors.ink);
}

/** Breite der rechten Spalte „Seite x von y“ samt Abstand: die größte erwartete Seitenzahl bestimmt sie, damit sie überall gleich ist. */
function pageColumn(doc: jsPDF, content: FooterContent): number {
  setFooterFace(doc);
  return doc.getTextWidth(content.pageLabel(printMetrics.footWorstPage, printMetrics.footWorstPage)) + printMetrics.footColumnGap;
}

/** Zeilen der linken Spalte: Titel · Stand und Ansprechpartner, umbrochen, nie gekürzt (der Umbruch folgt den Wörtern). */
function leftRows(doc: jsPDF, content: FooterContent, width: number): { main: string[]; contact: string[] } {
  setFooterFace(doc);
  const wrap = (text: string): string[] => doc.splitTextToSize(text, width) as string[];
  return {
    main: wrap(`${content.title}${content.join}${content.stand}`),
    contact: content.contact === undefined ? [] : wrap(content.contact),
  };
}

/** Zahl der Zeilen der Fußzeile: Adresse (falls geteilt), Titel · Stand, Ansprechpartner; für jede Seite gleich. */
export function countFooterLines(doc: jsPDF, content: FooterContent, width: number): number {
  const { main, contact } = leftRows(doc, content, width - pageColumn(doc, content));
  return (content.link === undefined ? 0 : 1) + main.length + contact.length;
}

/** Adresszeile: Satz normal, Adresse fett mit einer Unterstreichung und einer Link-Fläche über genau der Adresse. */
function drawLinkRow(doc: jsPDF, link: NonNullable<FooterContent['link']>, left: number, y: number): void {
  const family = fontOf(doc);
  doc.setFont(family, 'normal');
  doc.setFontSize(printType.foot);
  doc.text(link.prefix, left, y);
  const x = left + doc.getTextWidth(`${link.prefix} `);
  doc.setFont(family, 'bold');
  doc.text(link.address, x, y);
  const width = doc.getTextWidth(link.address);
  drawUnderline(doc, { x1: x, x2: x + width, y: y + printSheetHead.underlineDrop });
  drawLinks(doc, [{ url: link.url, x, y: y - ascentMm(printType.foot), w: width, h: ascentMm(printType.foot) + descentMm(printType.foot) }]);
  doc.setFont(family, 'normal');
}

/** Zeichnet Fußlinie und Fußzeile auf jede Seite. Nach dem Satz aufrufen, wenn die Seitenzahl feststeht. */
export function drawFooters(doc: jsPDF, geo: PageGeometry, content: FooterContent): void {
  const total = doc.getNumberOfPages();
  const rows = leftRows(doc, content, geo.contentWidth - pageColumn(doc, content));
  const text = [...rows.main, ...rows.contact];
  const first = content.link === undefined ? 0 : 1;
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setDrawColor(...printColors.ink);
    doc.setLineWidth(printStroke.foot);
    doc.line(geo.left, geo.footRuleY, geo.left + geo.contentWidth, geo.footRuleY);
    if (content.link) {
      drawLinkRow(doc, content.link, geo.left, geo.footerY);
    }
    setFooterFace(doc);
    text.forEach((row, index) => {
      doc.text(row, geo.left, geo.footerY + (index + first) * printMetrics.footAdvance);
    });
    // „Seite x von y“ auf der letzten Zeile, rechtsbündig, auf jeder Seite an derselben Stelle (@DR-044)
    doc.text(content.pageLabel(page, total), geo.left + geo.contentWidth, geo.footerY + (text.length + first - 1) * printMetrics.footAdvance, { align: 'right' });
  }
}
