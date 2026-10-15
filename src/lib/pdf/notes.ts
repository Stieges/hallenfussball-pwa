/**
 * Hinweise an den Nutzer, die beim Bauen des PDFs entstehen und VOR dem Speichern vorliegen (B-28 C3, B2, @DR-012):
 * Felder und Teamnamen mit Zeichen, die als „?“ erscheinen, und der Schrift-Rückfall (B6).
 */
import { printMetrics } from '../../design-tokens/print';
import type { GeneratedSchedule } from '../../core/generators';
import { unrenderableChars, type GlyphCheck } from './fonts';
import type { PdfTexts } from './translations';

/** Gedruckte Freitextfelder, die der Aufrufer liefert (Veranstalter, Halle, Regelwerk, Ansprechpartner). */
export interface NoteFields {
  organizer: string;
  hall: string;
  rulebook: string;
  contact: string;
}

/** Langer Freitext (Regelwerk) im Hinweis nur als Anfang. */
function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > printMetrics.noteExcerptMax ? `${flat.slice(0, printMetrics.noteExcerptMax).trimEnd()}…` : flat;
}

/**
 * Hinweise auf Zeichen, die die gewählte Schrift nicht trägt: gedruckte Freitexte (Turniername, Altersklasse,
 * Veranstalter, Halle, Regelwerk, Ansprechpartner) und Teamnamen (Daniel 14.10./15.10.; Fixrunde F8). Im Rückfall
 * steht davor der Hinweis auf die Ersatzschrift.
 */
export function buildNotes(
  schedule: GeneratedSchedule,
  t: PdfTexts,
  fields: NoteFields,
  mode: { fallback: boolean; covers: GlyphCheck }
): string[] {
  const entries: Array<[label: string, text: string]> = [
    [t.tournamentTitle, schedule.tournament.title],
    [t.ageClass, schedule.tournament.ageClass],
    [t.organizer, fields.organizer],
    [t.hall, fields.hall],
    [t.rules.label.rulebook, fields.rulebook],
    [t.contact, fields.contact],
  ];
  const fieldNotes = entries
    .filter(([, text]) => text !== '' && unrenderableChars(text, mode.covers).length > 0)
    .map(([label, text]) => t.unrenderableField(label, excerpt(text)));
  const teamNotes = schedule.teams
    .filter(team => unrenderableChars(team.name, mode.covers).length > 0)
    .map(team => t.unrenderableName(team.name));
  return [...(mode.fallback ? [t.fontFallbackNote] : []), ...fieldNotes, ...teamNotes];
}
