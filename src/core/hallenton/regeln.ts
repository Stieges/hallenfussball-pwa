/**
 * Regel 3 (Record `2026-10-15_hallenton.md`): Auf dem Lautsprecher-Gerät schweigt der Cockpit-Ton für seine Felder; überall
 * sonst gilt die Einstellung des Geräts (@HT-009, @HT-033 Zeilen 2, 7, 10). Rein, ohne React.
 */
export function cockpitTonSchweigt(feldId: string, lautsprecherFelder: readonly string[]): boolean {
  return lautsprecherFelder.includes(feldId);
}
