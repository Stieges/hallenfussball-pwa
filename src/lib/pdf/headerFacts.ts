/**
 * Angaben im Kopf von Seite 1 (Veranstalter, Altersklasse, Halle, Termin, Regelzeilen) und der Tag für den Kurzkopf.
 * Nur Zusammenstellen der Texte; gezeichnet wird in `render/header.ts` (B-28a3-3b, B-28a3-4F N2).
 */
import type { GeneratedSchedule } from '../../core/generators';
import { getLocationAddressLine } from '../../utils/locationHelpers';
import type { HeaderFact } from './render/header';
import type { PdfRuleKind } from './rules';
import type { PdfTexts } from './translations';
import { ageClassText } from '../../core/view';

/** Datum des Turniers: im Format TT.MM.JJJJ unverändert, sonst in der Sprache des Dokuments; ohne Datum leer. */
export function dayOf(schedule: GeneratedSchedule, t: PdfTexts): string {
  const date = schedule.tournament.date;
  if (!date) {
    return '';
  }
  return date.includes('.') ? date : t.formatDate(date);
}

/**
 * Termin wie v7.2 in einer Zeile (B-28a3-4F, N2): „Samstag, 14.11.2026 · Beginn 13:00 · Ende voraussichtlich 16:35 ·
 * 2 Felder“. Datum im Format TT.MM.JJJJ bleibt unverändert, sonst mit Wochentag in der Sprache des Dokuments.
 */
function appointmentValue(schedule: GeneratedSchedule, t: PdfTexts): string {
  return t.appointmentLine({
    day: dayWithWeekday(schedule.tournament.date, t),
    start: t.formatClock(schedule.startTime),
    end: t.formatClock(schedule.endTime),
    fields: t.fields(schedule.numberOfFields),
  });
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

/** Angaben im Kopf: Veranstalter (nur wenn angegeben), Altersklasse, Halle mit Adresse, Termin. */
export function headerFacts(schedule: GeneratedSchedule, t: PdfTexts, organizerName: string, hallName: string): HeaderFact[] {
  const facts: HeaderFact[] = [];
  if (organizerName) {
    facts.push({ label: t.organizer, value: organizerName });
  }
  const ageClass = ageClassText(schedule.tournament.ageClass);
  if (ageClass !== '') {
    facts.push({ label: t.ageClass, value: ageClass });
  }
  const address = getLocationAddressLine(schedule.tournament);
  facts.push({ label: t.hall, value: address ? `${hallName}, ${address}` : hallName });
  facts.push({ label: t.appointment, value: appointmentValue(schedule, t) });
  return facts;
}

/**
 * Regelzeilen aus `pdfRuleEntries` als Zeilen der Angabentabelle (Daniel 15.10., v7.2): „Bezeichnung: Wert“ geteilt, die
 * Gleichstandsregel als ganze Aussage in einer Zeile (@DR-020).
 */
export function ruleFacts(entries: Array<{ kind: PdfRuleKind; line: string }>): HeaderFact[] {
  return entries.map(({ kind, line }) => {
    if (kind === 'playOut') {
      return { label: line, value: '', statement: true };
    }
    const cut = line.indexOf(': ');
    return cut < 0 ? { label: line, value: '' } : { label: line.slice(0, cut), value: line.slice(cut + 2) };
  });
}
