/**
 * Übersetzer der App für die Dokumenttexte: i18next, Namespace `tournament`, Sprache des Dokuments. Eigene Datei ohne
 * jsPDF, damit auch die Oberfläche (Zusammenfassung im Assistenten) dieselben Texte bauen kann wie das PDF.
 */
import i18next from 'i18next';
import type { PdfLocale, PdfTranslator } from './translations';

export function appTranslator(locale: PdfLocale): PdfTranslator {
  // Fehlt ein Schlüssel, erscheint der Schlüssel selbst (sichtbar statt still leer).
  return (key, values) => i18next.t(key, key, { ns: 'tournament', lng: locale, ...values });
}
