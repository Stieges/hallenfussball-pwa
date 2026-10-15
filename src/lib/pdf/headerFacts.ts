/**
 * Angaben im Kopf von Seite 1 (Veranstalter, Altersklasse, Halle, Termin, Regelzeilen) und der Tag für den Kurzkopf.
 * Nur Zusammenstellen der Texte; gezeichnet wird in `render/header.ts` (B-28a3-3b, B-28a3-4F N2).
 */
import type { GeneratedSchedule } from '../../core/generators';
import { getLocationAddressLine } from '../../utils/locationHelpers';
import type { HeaderFact } from './render/header';
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
 * Termin wie v7.2 in einer Zeile (B-28a3-4F, N2): „Samstag, 14.11.2026 · Beginn 13:00 · Ende voraussichtlich 16:35 ·
 * 2 Felder“. Datum im Format TT.MM.JJJJ bleibt unverändert, sonst mit Wochentag in der Sprache des Dokuments.
 */
function appointmentValue(schedule: GeneratedSchedule, t: PdfTexts): string {
  const date = schedule.tournament.date;
  let day = t.noDate;
  if (date) {
    const formatted = dayOf(schedule, t);
    const weekday = date.includes('.') ? '' : t.formatWeekday(date);
    day = weekday === '' ? formatted : `${weekday}, ${formatted}`;
  }
  return t.appointmentLine({
    day,
    start: t.formatClock(schedule.startTime),
    end: t.formatClock(schedule.endTime),
    fields: t.fields(schedule.numberOfFields),
  });
}

/** Angaben im Kopf: Veranstalter (nur wenn angegeben), Altersklasse, Halle mit Adresse, Termin. */
export function headerFacts(schedule: GeneratedSchedule, t: PdfTexts, organizerName: string, hallName: string): HeaderFact[] {
  const facts: HeaderFact[] = [];
  if (organizerName) {
    facts.push({ label: t.organizer, value: organizerName });
  }
  facts.push({ label: t.ageClass, value: schedule.tournament.ageClass });
  const address = getLocationAddressLine(schedule.tournament);
  facts.push({ label: t.hall, value: address ? `${hallName}, ${address}` : hallName });
  facts.push({ label: t.appointment, value: appointmentValue(schedule, t) });
  return facts;
}

/** Regelzeilen aus `pdfRuleLines` („Bezeichnung: Wert“) als Zeilen der Angabentabelle (Daniel 15.10., v7.2). */
export function ruleFacts(lines: string[]): HeaderFact[] {
  return lines.map(line => {
    const cut = line.indexOf(': ');
    return cut < 0 ? { label: line, value: '' } : { label: line.slice(0, cut), value: line.slice(cut + 2) };
  });
}
