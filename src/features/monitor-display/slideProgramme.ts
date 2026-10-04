/**
 * Auswahl der darstellbaren Folien eines Folienprogramms (@OB-011).
 *
 * Eine Folie ohne Darstellung (ältere Einstellungen, unbekannter Folien-Typ)
 * darf den Monitor nicht aufhalten: Sie wird übersprungen, bleibt keine Folie
 * übrig, gilt die Zuschauer-QR-Folie. Ein Entwickler-Hinweis wie
 * „wird in Phase 2 implementiert“ ist nirgends erlaubt.
 */

export interface MonitorSlideLike {
  id: string;
  type: string;
  duration?: number;
}

export function selectDisplayableSlides(slides: MonitorSlideLike[]): MonitorSlideLike[] {
  return slides;
}