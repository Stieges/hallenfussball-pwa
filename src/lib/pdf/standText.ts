/**
 * Stand, Fußzeile und Abschluss des Spielplan-PDFs als Text (B-28a3-4, Punkt 3). Alle Wörter kommen über `t()`
 * (Schlüssel `pdf.stand`, `pdf.offlineNote`, `pdf.pageOf`, `pdf.closedAt`; DE und EN). Datum und Uhrzeit sind
 * Zahlen im Format TT.MM. und HH:mm.
 */
import type { PdfTranslator } from './translations';

const zwei = (n: number): string => String(n).padStart(2, '0');

/** Datum „TT.MM.“ und Uhrzeit „HH:mm“ in der Ortszeit (auch für den Hinweis „Ohne Verbindung – Stand …“ im Dialog, G69). */
export function stempel(zeit: Date): { date: string; time: string } {
  return {
    date: `${zwei(zeit.getDate())}.${zwei(zeit.getMonth() + 1)}.`,
    time: `${zwei(zeit.getHours())}:${zwei(zeit.getMinutes())}`,
  };
}

/** „Stand 14.11. 15:07“, bei fehlender Verbindung mit „– ohne Verbindung“ dahinter (@BM-023). */
export function standLine(now: Date, online: boolean, translate: PdfTranslator): string {
  const base = translate('pdf.stand', stempel(now));
  return online ? base : `${base} ${translate('pdf.offlineNote')}`;
}

/** „Seite 2 von 3“ rechts unten in der Fußzeile (@DR-044). */
export function pageLabel(page: number, total: number, translate: PdfTranslator): string {
  return translate('pdf.pageOf', { page, total });
}

/** Endstand-Fassung: „Endstand – abgeschlossen am 14.11.2026 um 17:40“ (@BM-035, @DR-011; B-28a3-4F F2, mit Jahr). */
export function closedLine(closedAt: Date, translate: PdfTranslator): string {
  const { date, time } = stempel(closedAt);
  return translate('pdf.closedAt', { date: `${date}${closedAt.getFullYear()}`, time });
}
