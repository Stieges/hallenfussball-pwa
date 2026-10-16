/**
 * Deterministische UUIDs für Test-Fixtures.
 *
 * Team- und Spiel-IDs sind UUIDs (A-01, MVP-Bauplan Spur A): Generatoren bauen Spielseiten über
 * `TeamIdSchema`, das Teamnamen und Kurz-IDs wie `'t1'` ablehnt.
 */
export function testUuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
