import { displayLayout, getContrastRatio } from '../../design-tokens/display';

/** Rahmen eines Kastens (Breite und Farbe als CSS-Werte). */
export interface BlockFrame {
  width: string;
  color: string;
}

/**
 * @ZM-140 / B-44a2: Beide Kästen tragen denselben dezenten Rahmen (Teil der Anzeigetafel-Sprache).
 * Hebt sich die Kastenfarbe mit weniger als 3 : 1 vom Hintergrund ab, ist der Rahmen kräftig und in voller Textfarbe.
 */
export function getBlockFrame(blockHex: string, backgroundHex: string, textColor: string): BlockFrame {
  const L = displayLayout.scoreArea;
  if (getContrastRatio(blockHex, backgroundHex) < 3) {
    return { width: L.frameWidthStrong, color: textColor };
  }
  return { width: L.frameWidthSubtle, color: `color-mix(in srgb, ${textColor} ${L.frameSubtleMix}, transparent)` };
}
