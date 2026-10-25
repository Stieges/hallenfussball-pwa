/**
 * Teamnamen in Tasten und Überschriften brechen nie mitten im Wort um (Grenzwert `titel.wortbruch` der visuellen Prüfung,
 * VISUAL-DESIGN § 2): auch ein Bindestrich im Namen („Rot-Weiß“, „Kleinstadt-Neudorf“) ist eine Umbruchstelle und würde das Wort
 * auf zwei Zeilen setzen. Hier steht dort das geschützte Trennzeichen (U+2011, sieht aus wie „-“, bricht nicht); der Name bricht
 * dann nur noch an Leerzeichen. Nur zur Anzeige im Abschluss-Dialog und in der Verwaltung; gespeichert wird nie so ein Name.
 */
export function keepTogether(name: string): string {
  return name.replace(/(\p{L})-(?=\p{L})/gu, '$1\u2011');
}
