/**
 * Folienfolge des Monitors (B-16c): Takt und Übergang. Tasten wirken nicht (@ME-022, Befund C-MONITOR-DAUERBETRIEB).
 *
 * Die Regeln stehen in slideProgramme.ts (nextSlide / stepSlide / wakeAt). Dieser Hook plant genau
 * einen Timer bis wakeAt. Der Takt hängt nur an Zahlen (wakeAt, Übergang, Tick), nie an Objekten
 * aus dem Repository: Jeder Poll liefert neue Objekte, sonst würde der Takt bei jedem Poll neu
 * starten (C-MON-TAKT-STEHT).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  nextSlide,
  wakeAt,
  type SlideProgram,
  type SlideshowState,
} from './slideProgramme';

export interface SlideView {
  currentIndex: number;
  /** Seite der aktuellen Folie (B-16f1, 0-basiert); ohne Seiten immer 0. */
  page: number;
  isTransitioning: boolean;
  direction: 'next' | 'prev';
  /** Gepinntes Spiel der Live-Folie (B-16e1); null ohne Pin. */
  pinnedMatchId: string | null;
}

export interface SlideshowControl {
  slideState: SlideView;
}

/** Index innerhalb der Folienliste halten, falls sie kürzer geworden ist. */
function clampState(state: SlideshowState, count: number): SlideshowState {
  if (count === 0 || state.index < count) { return state; }
  return { ...state, index: count - 1, page: 0 };
}

/**
 * @param transitionMs Übergangsdauer in ms bei Folienwechsel, `null` = ohne Übergang.
 */
export function useSlideshow(program: SlideProgram, transitionMs: number | null): SlideshowControl {
  const count = program.slides.length;
  const [state, setState] = useState<SlideshowState>(() => ({
    index: 0,
    page: 0,
    startedAt: Date.now(),
    paused: false,
    direction: 'next',
    pinnedMatchId: null,
    finalUntil: null,
  }));
  const [transitionDirection, setTransitionDirection] = useState<'next' | 'prev' | null>(null);
  const [tick, setTick] = useState(0);

  // Refs: Timer-Callbacks lesen den jeweils aktuellen Stand, ohne von Objekten abzuhängen.
  const stateRef = useRef(state);
  const programRef = useRef(program);
  programRef.current = program;
  const transitionMsRef = useRef(transitionMs);
  transitionMsRef.current = transitionMs;
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback((next: SlideshowState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const currentState = useCallback(
    () => clampState(stateRef.current, programRef.current.slides.length),
    []
  );

  // Folienwechsel mit optionalem Übergang. Während des Übergangs bleibt der alte Index stehen,
  // der neue Takt startet mit dem Ende des Übergangs (wie bisher).
  const applyChange = useCallback((target: SlideshowState) => {
    const ms = transitionMsRef.current;
    const cur = currentState();
    if (ms === null || target.index === cur.index) {
      commit(target);
      return;
    }
    if (transitionTimerRef.current !== null) { clearTimeout(transitionTimerRef.current); }
    setTransitionDirection(target.direction);
    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null;
      setTransitionDirection(null);
      const latest = stateRef.current;
      commit({
        ...latest,
        index: target.index,
        page: target.page,
        direction: target.direction,
        startedAt: Date.now(),
      });
    }, ms);
  }, [commit, currentState]);

  const takt = useCallback(() => {
    const cur = currentState();
    const next = nextSlide(programRef.current, cur, Date.now());
    if (next === cur) {
      // Timer kam früher als Date.now() es erlaubt: neu planen statt stehen zu bleiben.
      setTick(t => t + 1);
      return;
    }
    applyChange(next);
  }, [applyChange, currentState]);

  const view = useMemo(() => clampState(state, count), [state, count]);
  const wake = wakeAt(program, view);

  // Jede neue Programm-Referenz (neue Daten je Poll) sofort auswerten: Spielregeln wirken beim Empfang.
  // Der Takt startet nur neu, wenn sich Folie, Seite, Pin oder Haltezeit tatsächlich ändern (C-MON-TAKT-STEHT).
  useEffect(() => {
    const cur = currentState();
    const next = nextSlide(programRef.current, cur, Date.now());
    const changed = next.index !== cur.index
      || next.page !== cur.page
      || (next.pinnedMatchId ?? null) !== (cur.pinnedMatchId ?? null)
      || (next.finalUntil ?? null) !== (cur.finalUntil ?? null);
    if (changed) { applyChange(next); }
  }, [program, applyChange, currentState]);

  // Genau ein Timer bis wakeAt. Während eines Übergangs ruht er.
  useEffect(() => {
    if (wake === null || transitionDirection !== null) { return; }
    const timer = setTimeout(takt, Math.max(0, wake - Date.now()));
    return () => clearTimeout(timer);
  }, [wake, transitionDirection, tick, takt]);

  // Unmount mitten im Übergang: der Übergangs-Timer darf danach keinen Zustand mehr setzen.
  useEffect(() => () => {
    if (transitionTimerRef.current !== null) { clearTimeout(transitionTimerRef.current); }
  }, []);

  const slideState = useMemo<SlideView>(() => ({
    currentIndex: view.index,
    page: view.page,
    isTransitioning: transitionDirection !== null,
    direction: transitionDirection ?? view.direction,
    pinnedMatchId: view.pinnedMatchId ?? null,
  }), [view, transitionDirection]);

  return { slideState };
}
