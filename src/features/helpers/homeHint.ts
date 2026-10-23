/**
 * Hinweis „Zum Startbildschirm hinzufügen“ (A-17c, @HE-097): einmal nach der Zulassung, wegklickbar, kommt für das Turnier
 * auf diesem Gerät nicht wieder; wer die App schon vom Startbildschirm aus geöffnet hat, sieht ihn nicht.
 * Der Merker liegt im Zugangs-Index (`homeHintDismissed`), nicht im Arbeitsspeicher: er muss das Schließen des Tabs überstehen.
 * iPhone/iPad-Variante („Tab offen lassen“, Mockup n2) folgt erst nach dem Gerätetest F2.
 */
import type { HelperAccessEntry } from '../../core/repositories/helperAccessRpc';

/** Läuft die App vom Startbildschirm (eigenständiges Fenster)? `navigator.standalone` gilt für Safari auf iOS. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const mediaQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)').matches : false;
  return mediaQuery || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Nur für zugelassene Helfer eines laufenden Turniers, solange der Hinweis nicht weggeklickt wurde. */
export function shouldShowHomeHint(entry: HelperAccessEntry | null, standalone: boolean): boolean {
  return entry !== null && entry.relation === 'accepted' && !entry.closed && !entry.homeHintDismissed && !standalone;
}
