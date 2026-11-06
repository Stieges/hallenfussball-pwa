/**
 * Einstellung „Fehlerberichte senden“ (@RE-002): je Gerät gespeichert, ohne Eintrag ist sie an.
 * Keine Einwilligung, nur ein Schalter (Widerspruch nach Art. 21 DSGVO): aus = das Gerät sendet nichts, auch nicht nach Neuladen.
 */

export const ERROR_REPORTS_KEY = 'app:errorReports';

export function isErrorReportingEnabled(): boolean {
  try {
    return localStorage.getItem(ERROR_REPORTS_KEY) !== 'off';
  } catch {
    // Speicher gesperrt: nichts gemerkt, also gilt die Vorbelegung
    return true;
  }
}

export function setErrorReportingEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.removeItem(ERROR_REPORTS_KEY);
    } else {
      localStorage.setItem(ERROR_REPORTS_KEY, 'off');
    }
  } catch {
    // Speicher gesperrt: Schalter lässt sich nicht merken
  }
}
