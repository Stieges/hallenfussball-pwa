/**
 * Altersprüfung der geseedeten Laufspiele (C3b-3a Probe 6, "Seed zu alt"): ein laufendes Engine-Spiel
 * braucht beim Testbeginn noch mindestens `MIN_REMAINING_MS` Restzeit, sonst greift das Auto-Finish
 * beim Öffnen des Cockpits und der Test scheitert mit unklarer Meldung. Als reine Funktion, damit sie
 * ohne Stack per Unit-Test mit Gegenbeispiel prüfbar ist (`__tests__/seedAge.test.ts`).
 */
export const MIN_REMAINING_MS = 300_000;

/** `true`, wenn seit dem Anpfiff so viel Zeit vergangen ist, dass weniger als `MIN_REMAINING_MS` Restzeit bleibt. */
export function isSeedTooOld(ageMs: number, durationSeconds: number): boolean {
  return ageMs >= durationSeconds * 1000 - MIN_REMAINING_MS;
}
