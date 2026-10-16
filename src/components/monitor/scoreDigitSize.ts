/**
 * Größe der Ziffern im Kasten (Controller-Zusatz zu H3): höchstens 60 % der Kastenhöhe und
 * höchstens 50 % der Kastenbreite. Zwei Stellen bleiben so mit seitlichem Abstand im Kasten.
 */
export const DIGIT_HEIGHT_MAX_OF_BOX = 0.6;
export const DIGIT_WIDTH_MAX_OF_BOX = 0.5;

export function scoreDigitFontSize(): string {
  return `min(${DIGIT_HEIGHT_MAX_OF_BOX * 100}cqh, ${DIGIT_WIDTH_MAX_OF_BOX * 100}cqw)`;
}
