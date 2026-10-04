/**
 * Auswahl der darstellbaren Folien eines Folienprogramms (@OB-011).
 *
 * Eine Folie ohne Darstellung (ältere Einstellungen, Folien-Typ ohne
 * Umsetzung) darf den Monitor nicht aufhalten: Sie wird übersprungen. Bleibt
 * keine darstellbare Folie übrig, gilt die Zuschauer-QR-Folie. Ein
 * Entwickler-Hinweis wie „wird in Phase 2 implementiert“ ist nirgends erlaubt.
 */

export interface MonitorSlideLike {
  id: string;
  type: string;
  duration?: number | null;
}

/** Folien-Typen, die der Monitor heute darstellen kann (Phase 1). */
export const DISPLAYABLE_SLIDE_TYPES: ReadonlySet<string> = new Set([
  'live',
  'standings',
  'schedule-field',
  'sponsor',
  'custom-text',
]);

/** Rückfall, wenn keine Folie des Programms darstellbar ist: die Zuschauer-QR-Folie. */
export const ZUSCHAUER_QR_SLIDE: MonitorSlideLike = {
  id: 'zuschauer-qr-folie',
  type: 'qr-code',
  duration: 15,
};

export function selectDisplayableSlides(slides: MonitorSlideLike[]): MonitorSlideLike[] {
  if (slides.length === 0) {
    return [];
  }
  const displayable = slides.filter((slide) => DISPLAYABLE_SLIDE_TYPES.has(slide.type));
  return displayable.length > 0 ? displayable : [ZUSCHAUER_QR_SLIDE];
}
