/**
 * cockpitFrame – wann die App um das Cockpit herum zurücktritt (Plan LT-2, Entscheidung A1, @SL-140).
 *
 * Im Live-Bereich steht auf allen Geräten nur der schmale Kopf, sobald das Cockpit ein Spiel oder „wartet auf Teams“ zeigt
 * (`istCockpitVollbild`): keine App-Kopfzeile mit Reitern, keine Navigation unten, keine Fußzeile, keine festen Hinweisleisten
 * (Offline, Speicher). Die Daumenleiste ist die einzige feste Leiste. Das `ManagementTab` entscheidet und meldet es an
 * (`useAnnounceCockpitFrame`); Bildschirm, Fußzeile und Hülle der App lesen es. Außerhalb des Providers gilt „kein Vollbild“.
 */
import { createContext, useContext, useEffect, type CSSProperties } from 'react';
import type { CockpitZustand } from '../model/cockpitPhase';

/** A1: in jedem Zustand außer „kein Spiel mehr auf dem Feld“, auch vor dem Anpfiff und während des Endstands. */
export function istCockpitVollbild(zustand: CockpitZustand): boolean {
  return zustand !== 'keinSpiel';
}

export interface CockpitFrameValue {
  vollbild: boolean;
  setVollbild: (aktiv: boolean) => void;
}

const KEIN_RAHMEN: CockpitFrameValue = { vollbild: false, setVollbild: () => undefined };
export const CockpitFrameContext = createContext<CockpitFrameValue>(KEIN_RAHMEN);

export function useCockpitFrame(): CockpitFrameValue {
  return useContext(CockpitFrameContext);
}

/** Meldet den Rahmen an, solange `aktiv` gilt; beim Verlassen des Live-Bereichs fällt er weg. */
export function useAnnounceCockpitFrame(aktiv: boolean): void {
  const { setVollbild } = useCockpitFrame();
  useEffect(() => {
    setVollbild(aktiv);
    return () => { setVollbild(false); };
  }, [aktiv, setVollbild]);
}

/**
 * Wurzel der App im Cockpit-Rahmen (K3): eine Spalte genau in Bildschirmhöhe. Ein Hinweis im Fluss darüber (Update, Sitzung)
 * verkleinert die Resthöhe des Cockpits, schiebt die Leiste aber nie aus dem Bild; das Cockpit selbst hat kein eigenes 100dvh.
 */
export function useRahmenWurzelStil(): CSSProperties {
  const { vollbild } = useCockpitFrame();
  return vollbild ? { display: 'flex', flexDirection: 'column', height: 'var(--min-h-screen)' } : {};
}
