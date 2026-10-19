/** @SL-096: eine Zeitstrafe gilt als abgelaufen, wenn sie mit höchstens dieser Restzeit aus der Ansicht verschwindet. */
const ABGELAUFEN_SCHWELLE_MS = 1000;

/** IDs der Strafen, die seit dem letzten Stand von selbst abgelaufen sind (nicht durch Gegentor oder Rücknahme beendet). */
export function abgelaufeneStrafen(vorher: { id: string; remainingMs: number }[], jetzt: { id: string }[]): string[] {
  const noch = new Set(jetzt.map((p) => p.id));
  return vorher.filter((p) => !noch.has(p.id) && p.remainingMs <= ABGELAUFEN_SCHWELLE_MS).map((p) => p.id);
}
