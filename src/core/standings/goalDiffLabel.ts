/**
 * Anzeige der Tordifferenz in der Gruppentabelle: Plus mit „+“, Minus mit dem echten Minuszeichen (U+2212, @ZM-205). Der Bindestrich „-“ ließ mit gleich
 * breiten Ziffern (`tabular-nums`) eine Lücke vor der Zahl. Reine Funktion, kein React.
 */
export function goalDiffLabel(goalDiff: number): string {
  if (goalDiff > 0) { return `+${String(goalDiff)}`; }
  if (goalDiff < 0) { return `−${String(-goalDiff)}`; }
  return '0';
}
