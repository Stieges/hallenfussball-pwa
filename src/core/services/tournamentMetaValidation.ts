/**
 * Prüfung der Stammdaten beim Bearbeiten nach dem Anlegen (C-META-NOVALID, @W5-002, @W5-003).
 *
 * Gilt für das Admin Center (Meta-Daten) und den Reiter Einstellungen der Verwaltung. Geprüft wird nur, was
 * ein Turnier unbrauchbar macht: ein leerer Name und ein leeres Datum. Ein Datum in der Vergangenheit ist
 * hier ausdrücklich kein Fehler – nach dem Turniertag müssen Ort und Schreibweise noch korrigierbar sein
 * (@W5-003). Die Vergangenheits-Sperre gehört dem Entwurf im Wizard (TournamentCreationService.validateStep).
 */

export type TournamentMetaField = 'title' | 'startDate';

export type TournamentMetaErrors = Partial<Record<TournamentMetaField, 'required'>>;

export interface TournamentMetaInput {
  title?: string;
  startDate?: string;
}

export function validateTournamentMeta(input: TournamentMetaInput): TournamentMetaErrors {
  const errors: TournamentMetaErrors = {};
  if (!input.title?.trim()) {
    errors.title = 'required';
  }
  if (!input.startDate?.trim()) {
    errors.startDate = 'required';
  }
  return errors;
}

export function hasMetaErrors(errors: TournamentMetaErrors): boolean {
  return Object.keys(errors).length > 0;
}
