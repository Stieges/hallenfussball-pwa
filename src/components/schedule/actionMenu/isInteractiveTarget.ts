/**
 * Steht der Tipp auf einer Eingabe oder Taste, die ihre eigene Wirkung hat (@SL-193)? Wer die ganze Zeile bzw. Karte antippbar
 * macht, ignoriert Tipps auf solche Elemente darin.
 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input, button, select, textarea, a, label, [role="button"]') !== null;
}
