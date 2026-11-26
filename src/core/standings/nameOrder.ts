/**
 * Namensregel für alphabetische Listen (Record `2026-11-25_tabellen-sortieren`, @TS-007, @TS-008): DIN 5007 Variante 2,
 * also ä→ae, ö→oe, ü→ue, ß→ss, danach deutscher Vergleich ohne Groß/Klein. Rein, ohne React.
 * Gleich (0) heißt: „Röthenbach“ und „Roethenbach“ – dann entscheidet der Aufrufer (z. B. die Platzierung).
 */
const collator = new Intl.Collator('de', { sensitivity: 'base' });

const REPLACEMENTS: Readonly<Record<string, string>> = {
  ä: 'ae', Ä: 'Ae', ö: 'oe', Ö: 'Oe', ü: 'ue', Ü: 'Ue', ß: 'ss',
};

function din5007Variant2(name: string): string {
  return name.replace(/[äÄöÖüÜß]/g, (ch) => REPLACEMENTS[ch]);
}

export function compareNames(a: string, b: string): number {
  return collator.compare(din5007Variant2(a), din5007Variant2(b));
}
