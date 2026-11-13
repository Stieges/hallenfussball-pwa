/**
 * Uhrzeit „14:02“ für Anzeigen im Unterpunkt „Hallenton“ (Quittung „gespielt 14:02“, „zuletzt 14:02“). Der Zeitpunkt kommt vom Server
 * (absolute Zeit); nur die Darstellung nutzt die Zeitzone des Geräts, gerechnet wird damit nie (@HT-042).
 */
export function formatUhrzeit(ms: number, sprache: string): string {
  return new Intl.DateTimeFormat(sprache, { hour: '2-digit', minute: '2-digit', hour12: false }).format(ms);
}
