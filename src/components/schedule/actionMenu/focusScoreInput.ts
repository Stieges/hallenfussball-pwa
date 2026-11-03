/**
 * „Ergebnis eintragen“ in der Finalrunde (@SL-193): setzt den Fokus auf das Eingabefeld der Heim-Tore dieses Spiels.
 * Zeile (Tabelle) und Karte (Handy) stehen beide im Dokument, nur eine ist sichtbar; gewählt wird die sichtbare, sonst die erste.
 */
export function focusScoreInput(matchId: string): void {
  const fields = [`match-score-input-${matchId}-home`, `final-score-input-${matchId}-home`]
    .map((testId) => document.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`))
    .filter((el): el is HTMLInputElement => el !== null);
  const visible = fields.find((el) => el.getClientRects().length > 0);
  (visible ?? fields[0])?.focus();
}
