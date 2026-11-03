/**
 * Der Tag für Kopf und Kurzkopf. Nur Zusammenstellen der Texte; der Kopf von Seite 1 entsteht im Seitenmodell
 * (`model/headerModel.ts`) und wird in `render/pageHeader.ts` gezeichnet.
 */
import type { GeneratedSchedule } from '../../core/generators';
import type { PdfTexts } from './translations';

/** Datum des Turniers: im Format TT.MM.JJJJ unverändert, sonst in der Sprache des Dokuments; ohne Datum leer. */
export function dayOf(schedule: GeneratedSchedule, t: PdfTexts): string {
  const date = schedule.tournament.date;
  if (!date) {
    return '';
  }
  return date.includes('.') ? date : t.formatDate(date);
}

/**
 * Der Tag mit Wochentag („Samstag, 28.11.2026“), die einzige Quelle für Kopf, Zusammenfassung und Vorschau. Ein Datum
 * im Format TT.MM.JJJJ bleibt ohne Wochentag unverändert; ohne Datum steht der Text „Kein Datum“ des Dokuments (`noDate`).
 */
export function dayWithWeekday(date: string | undefined, t: PdfTexts): string {
  if (!date) {
    return t.noDate;
  }
  const formatted = date.includes('.') ? date : t.formatDate(date);
  const weekday = date.includes('.') ? '' : t.formatWeekday(date);
  return weekday === '' ? formatted : `${weekday}, ${formatted}`;
}
