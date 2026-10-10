/**
 * Auswahl der darstellbaren Folien eines Folienprogramms (@OB-011).
 *
 * Eine Folie ohne Darstellung (ältere Einstellungen, Folien-Typ ohne
 * Umsetzung) darf den Monitor nicht aufhalten: Sie wird übersprungen. Bleibt
 * keine darstellbare Folie übrig, gilt die Zuschauer-QR-Folie. Entwickler-Hinweise
 * dieser Art (Platzhalter-Texte für Folien) sind nirgends erlaubt.
 */

import type { MonitorSlide } from '../../types/monitor';
import { fieldIdToNumber } from './monitorDisplayHelpers';

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
// Folienfolge (B-16c, B-16e1): reine Funktionen mit `now`. Keine Timer, kein React –
// der Hook `useSlideshow` plant den einen Timer, die Seite steuert nur Tasten.
// =============================================================================

export type ProgramSlide = MonitorSlide | QrRueckfallFolie;

/** Haltezeit des Endergebnisses nach Abpfiff, bevor der Takt weiterläuft (@ZM-077). */
export const FINAL_RESULT_HOLD_MS = 30_000;

/** Die Felder der Spielregeln; ein Repository-Objekt erfüllt sie strukturell. */
export interface RuleMatch {
  id: string;
  field: number;
  matchStatus?: string | null;
}

export interface SlideProgram {
  slides: ProgramSlide[];
  /** Monitor-Standard in Sekunden, wenn die Folie keine eigene Dauer hat. */
  defaultDurationSec: number;
  /** Seitenzahl einer Folie; fehlt die Funktion, gilt 1 (B-17 misst die Seitenzahl). */
  pageCount?: (slide: ProgramSlide) => number;
  /** Spiele für die Anhalte- und Feldregeln (B-16e1); fehlt die Liste, gilt keine Spielregel. */
  matches?: readonly RuleMatch[];
}

export interface SlideshowState {
  index: number;
  page: number;
  startedAt: number;
  paused: boolean;
  direction: 'next' | 'prev';
  /** Gepinntes Spiel: die Live-Folie hält, solange es läuft (kein Takt). */
  pinnedMatchId?: string | null;
  /** Ende der Haltezeit nach Abpfiff in ms; danach läuft der Takt ab der folgenden Folie. */
  finalUntil?: number | null;
}

/** Anzeigedauer einer Seite in ms: eigene Dauer, sonst Monitor-Standard (@ZM-130). */
export function slideDurationMs(slide: ProgramSlide, defaultDurationSec: number): number {
  return (slide.duration ?? defaultDurationSec) * 1000;
}

/** Spiel „im Lauf“: laufend oder in der Halbzeit (`paused`, C-MON-PAUSE; der Typ bleibt Spur A). */
export function isMatchInProgress(match: { matchStatus?: string | null }): boolean {
  const status = String(match.matchStatus);
  return status === 'running' || status === 'paused';
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function pagesOf(program: SlideProgram, slide: ProgramSlide): number {
  return program.pageCount ? program.pageCount(slide) : 1;
}

/** Feldnummer einer Live-Folie; sonst null. Ohne fieldId gilt Feld 1 (wie LiveSlide). */
function liveFieldOf(slide: ProgramSlide): number | null {
  if (slide.type !== 'live' || !('config' in slide)) { return null; }
  return fieldIdToNumber(slide.config.fieldId);
}

function runningOn(matches: readonly RuleMatch[], field: number): RuleMatch | undefined {
  return matches.find(m => m.field === field && isMatchInProgress(m));
}

/** @ZM-122: Live-Folie ohne laufendes Spiel auf ihrem Feld wird übersprungen. */
function isSkipped(slide: ProgramSlide, matches: readonly RuleMatch[]): boolean {
  const field = liveFieldOf(slide);
  return field !== null && runningOn(matches, field) === undefined;
}

/** Erste nicht übersprungene Folie ab `from` (zyklisch); null, wenn alle übersprungen sind. */
function firstVisible(program: SlideProgram, from: number, matches: readonly RuleMatch[]): number | null {
  const count = program.slides.length;
  for (let k = 0; k < count; k++) {
    const j = wrapIndex(from + k, count);
    if (!isSkipped(program.slides[j], matches)) { return j; }
  }
  return null;
}

/**
 * @ZM-074/075: Die erste Live-Folie (ab der aktuellen Folie gezählt), deren Feld ein laufendes Spiel hat
 * und die den Takt anhält (`pauseRotationDuringMatch !== false`). Null = kein Pinnen.
 */
function pinTarget(program: SlideProgram, state: SlideshowState, matches: readonly RuleMatch[]): { index: number; matchId: string } | null {
  const count = program.slides.length;
  for (let k = 0; k < count; k++) {
    const i = wrapIndex(state.index + k, count);
    const slide = program.slides[i];
    const field = liveFieldOf(slide);
    if (field === null || !('config' in slide) || slide.config.pauseRotationDuringMatch === false) { continue; }
    const match = runningOn(matches, field);
    if (match) { return { index: i, matchId: match.id }; }
  }
  return null;
}

/** Ein Schritt des Takts zur nächsten sichtbaren Folie; bleibt nichts übrig, bleibt die Folie stehen. */
function advance(program: SlideProgram, state: SlideshowState, now: number, matches: readonly RuleMatch[]): SlideshowState {
  const target = firstVisible(program, state.index + 1, matches) ?? state.index;
  return { ...state, index: target, page: 0, startedAt: now, direction: 'next' };
}

/**
 * Takt und Spielregeln (B-16c, B-16e1). Liefert dasselbe Objekt zurück, wenn sich nichts ändert.
 * - Pausiert (Taste) → unverändert.
 * - Laufendes Spiel auf dem Feld einer Live-Folie → Folie pinnen, kein Takt (@ZM-074, @ZM-075).
 * - Gepinntes Spiel beendet → Endergebnis 30 s halten, danach die folgende Folie (@ZM-077).
 * - Live-Folie ohne laufendes Spiel auf ihrem Feld → überspringen (@ZM-122).
 * - Sonst Takt: Anzeigedauer der Seite abgelaufen → nächste Seite bzw. nächste Folie.
 */
export function nextSlide(program: SlideProgram, state: SlideshowState, now: number): SlideshowState {
  const count = program.slides.length;
  if (state.paused || count === 0) { return state; }
  const matches = program.matches ?? [];

  const pin = pinTarget(program, state, matches);
  if (pin) {
    if (pin.index === state.index && pin.matchId === (state.pinnedMatchId ?? null) && (state.finalUntil ?? null) === null) {
      return state;
    }
    return { ...state, index: pin.index, page: 0, startedAt: now, pinnedMatchId: pin.matchId, finalUntil: null };
  }

  if ((state.pinnedMatchId ?? null) !== null) {
    const pinned = matches.find(m => m.id === state.pinnedMatchId);
    if (pinned && isMatchInProgress(pinned) && (state.finalUntil ?? null) === null) { return state; }
    if ((state.finalUntil ?? null) === null) {
      return { ...state, finalUntil: now + FINAL_RESULT_HOLD_MS };
    }
    if (now < (state.finalUntil ?? 0)) { return state; }
    return advance(program, { ...state, pinnedMatchId: null, finalUntil: null }, now, matches);
  }

  if (isSkipped(program.slides[wrapIndex(state.index, count)], matches)) {
    const target = firstVisible(program, state.index, matches);
    if (target !== null && target !== state.index) {
      return { ...state, index: target, page: 0, startedAt: now };
    }
  }

  if (count <= 1) { return state; }
  const slide = program.slides[wrapIndex(state.index, count)];
  if (now - state.startedAt < slideDurationMs(slide, program.defaultDurationSec)) { return state; }
  if (state.page + 1 < pagesOf(program, slide)) {
    return { ...state, page: state.page + 1, startedAt: now, direction: 'next' };
  }
  return advance(program, state, now, matches);
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

/**
 * Nächster Zeitpunkt (ms), zu dem `nextSlide` etwas ändert; null = nie (pausiert, keine Folienfolge,
 * oder gepinnt während des Spiels: dann wartet der Monitor auf neue Daten).
 */
export function wakeAt(program: SlideProgram, state: SlideshowState): number | null {
  const count = program.slides.length;
  if (state.paused || count === 0) { return null; }
  if ((state.pinnedMatchId ?? null) !== null) { return state.finalUntil ?? null; }
  if (count <= 1) { return null; }
  return state.startedAt + slideDurationMs(program.slides[wrapIndex(state.index, count)], program.defaultDurationSec);
}
