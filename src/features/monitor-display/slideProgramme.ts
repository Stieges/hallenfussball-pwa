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
  config?: object;
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

/**
 * F-04: Ist kein QR möglich (Turnier nicht öffentlich bzw. ohne Share-Code), nimmt der
 * Monitor die nächste immer darstellbare Folie — der Spielplan rendert auch ohne
 * Konfiguration und ohne Spiele (Feld 1, leere Liste); die Tabelle wäre die Alternative.
 */
export const SPIELPLAN_FALLBACK_SLIDE: MonitorSlideLike = {
  id: 'spielplan-folie',
  type: 'schedule-field',
  duration: 15,
  config: {},
};

export function selectDisplayableSlides(
  slides: MonitorSlideLike[],
  options?: { qrMoeglich?: boolean },
): MonitorSlideLike[] {
  const displayable = slides.filter((slide) => DISPLAYABLE_SLIDE_TYPES.has(slide.type));
  if (displayable.length > 0) {
    return displayable;
  }
  // F-04: Auch ein leeres Programm bleibt nie leer — Zuschauer-QR-Folie; ist kein QR
  // möglich (nicht öffentlich/ohne Share-Code), nimmt der Monitor die nächste immer
  // darstellbare Folie (Spielplan). Eine qr-code-Folie im Programm selbst zeigt ohne QR
  // Turniername und einen neutralen Satz (F-03/QrSlide).
  if (slides.length === 0 && options?.qrMoeglich === false) {
    return [SPIELPLAN_FALLBACK_SLIDE];
  }
  return [ZUSCHAUER_QR_SLIDE];
}
