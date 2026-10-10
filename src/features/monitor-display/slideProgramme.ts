/**
 * Auswahl der darstellbaren Folien eines Folienprogramms (@OB-011).
 *
 * Eine Folie ohne Darstellung (ältere Einstellungen, Folien-Typ ohne
 * Umsetzung) darf den Monitor nicht aufhalten: Sie wird übersprungen. Bleibt
 * keine darstellbare Folie übrig, gilt die Zuschauer-QR-Folie. Ein
 * Entwickler-Hinweis wie „wird in Phase 2 implementiert“ ist nirgends erlaubt.
 */

import type { MonitorSlide } from '../../types/monitor';

export interface MonitorSlideLike {
  id: string;
  type: string;
  duration?: number | null;
  config?: object;
}

/**
 * Zuschauer-QR-Folie (@OB-011 Rückfall): eigener Render-Pfad statt eines
 * Pseudo-Folientyps im Vertrag der Monitor-Konfiguration (E-03).
 */
export interface QrRueckfallFolie {
  id: string;
  type: 'qr-code';
  duration: number;
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
export const ZUSCHAUER_QR_SLIDE: QrRueckfallFolie = {
  id: 'zuschauer-qr-folie',
  type: 'qr-code',
  duration: 15,
};

/**
 * F-04: Ist kein QR möglich (Turnier nicht öffentlich bzw. ohne Share-Code), nimmt der
 * Monitor die nächste immer darstellbare Folie — der Spielplan rendert auch ohne
 * Konfiguration und ohne Spiele (Feld 1, leere Liste); die Tabelle wäre die Alternative.
 */
export const SPIELPLAN_FALLBACK_SLIDE: MonitorSlide = {
  id: 'spielplan-folie',
  type: 'schedule-field',
  duration: 15,
  config: {},
  order: 0,
};

export function selectDisplayableSlides<T extends MonitorSlideLike>(
  slides: T[],
  options?: { qrMoeglich?: boolean },
): Array<T | MonitorSlide | QrRueckfallFolie> {
  const displayable = slides.filter((slide) => DISPLAYABLE_SLIDE_TYPES.has(slide.type));
  if (displayable.length > 0) {
    return displayable;
  }
  // F-04/F11: Das Programm bleibt nie leer — ist nichts Darstellbares übrig und kein QR
  // möglich (nicht öffentlich/ohne Share-Code), nimmt der Monitor die nächste immer
  // darstellbare Folie (Spielplan). Eine qr-code-Folie im Programm selbst zeigt ohne QR
  // Turniername und einen neutralen Satz (F-03/QrSlide).
  if (displayable.length === 0 && options?.qrMoeglich === false) {
    return [SPIELPLAN_FALLBACK_SLIDE];
  }
  return [ZUSCHAUER_QR_SLIDE];
}

// =============================================================================
// Folienfolge (B-16c): reine Funktionen mit `now`. Keine Timer, kein React –
// der Hook `useSlideshow` plant den einen Timer, die Seite steuert nur Tasten.
// =============================================================================

export type ProgramSlide = MonitorSlide | QrRueckfallFolie;

export interface SlideProgram {
  slides: ProgramSlide[];
  /** Monitor-Standard in Sekunden, wenn die Folie keine eigene Dauer hat. */
  defaultDurationSec: number;
  /** Seitenzahl einer Folie; fehlt die Funktion, gilt 1 (B-17 misst die Seitenzahl). */
  pageCount?: (slide: ProgramSlide) => number;
}

export interface SlideshowState {
  index: number;
  page: number;
  startedAt: number;
  paused: boolean;
  direction: 'next' | 'prev';
}

/** Anzeigedauer einer Seite in ms: eigene Dauer, sonst Monitor-Standard (@ZM-130). */
export function slideDurationMs(slide: ProgramSlide, defaultDurationSec: number): number {
  return (slide.duration ?? defaultDurationSec) * 1000;
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function pagesOf(program: SlideProgram, slide: ProgramSlide): number {
  return program.pageCount ? program.pageCount(slide) : 1;
}

/**
 * Takt: Pausiert oder höchstens eine Folie → unverändert. Ist die Anzeigedauer der Seite abgelaufen,
 * kommt die nächste Seite; nach der letzten Seite die nächste Folie (Seite 0). Ein Schritt je Aufruf.
 */
export function nextSlide(program: SlideProgram, state: SlideshowState, now: number): SlideshowState {
  const count = program.slides.length;
  if (state.paused || count <= 1) { return state; }
  const slide = program.slides[wrapIndex(state.index, count)];
  if (now - state.startedAt < slideDurationMs(slide, program.defaultDurationSec)) { return state; }
  if (state.page + 1 < pagesOf(program, slide)) {
    return { ...state, page: state.page + 1, startedAt: now, direction: 'next' };
  }
  return { ...state, index: wrapIndex(state.index + 1, count), page: 0, startedAt: now, direction: 'next' };
}

/** Taste: eine Folie vor (+1) oder zurück (−1), modulo, immer auf Seite 0 und mit neuem Takt. */
export function stepSlide(program: SlideProgram, state: SlideshowState, delta: 1 | -1, now: number): SlideshowState {
  const count = program.slides.length;
  if (count === 0) { return state; }
  return {
    ...state,
    index: wrapIndex(state.index + delta, count),
    page: 0,
    startedAt: now,
    direction: delta > 0 ? 'next' : 'prev',
  };
}

/** Nächster Zeitpunkt (ms), zu dem `nextSlide` etwas ändert; null = nie (pausiert oder keine Folienfolge). */
export function wakeAt(program: SlideProgram, state: SlideshowState): number | null {
  const count = program.slides.length;
  if (state.paused || count <= 1) { return null; }
  return state.startedAt + slideDurationMs(program.slides[wrapIndex(state.index, count)], program.defaultDurationSec);
}
