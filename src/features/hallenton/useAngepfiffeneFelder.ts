/**
 * useAngepfiffeneFelder(tid) – Felder des Turniers mit angepfiffenem Spiel, für die Anzeige „Feld N: Handy ohne Netz“ (@HT-035).
 * Plan aus der lokalen Turnierkopie (nur lokal gelesen, alle 30 s und bei jeder Änderung der eigenen Engine), Status zuerst nach der
 * Engine, sonst nach der Kopie (`angepfiffeneFelder.ts`); `nachlesen` (die letzte Status-Antwort) liest die Kopie zusätzlich neu (R1). Ohne Engine (kein Konto) zählt nur die Kopie.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useMatchEngineContextOptional } from '../match-engine/useMatchEngineContext';
import { ladeTurnierLokal } from './lokalesTurnier';
import { angepfiffeneFelder } from './runtime/angepfiffeneFelder';
import type { PlanSpiel } from './runtime/feldStandSpiele';
import { planAusTurnier } from './runtime/lokalerSpielplan';

export const PLAN_LESEN_MS = 30_000;

export function useAngepfiffeneFelder(tid: string, nachlesen?: unknown): ReadonlySet<number> {
  const engine = useMatchEngineContextOptional();
  const [plan, setPlan] = useState<readonly PlanSpiel[]>([]);
  const [version, neuBewerten] = useReducer((n: number) => n + 1, 0);
  const aktiv = useRef(true);

  const lesen = useCallback((): void => {
    void ladeTurnierLokal(tid).catch(() => null).then((turnier) => {
      if (!aktiv.current) {
        return;
      }
      try {
        setPlan(turnier ? planAusTurnier(turnier) : []);
      } catch {
        setPlan([]); // unlesbare Kopie: kein Feld gilt als angepfiffen
      }
    });
  }, [tid]);

  useEffect(() => {
    aktiv.current = true;
    lesen();
    const takt = window.setInterval(lesen, PLAN_LESEN_MS);
    const abmelden = engine?.engine.subscribe(() => {
      neuBewerten();
      lesen();
    });
    return () => {
      aktiv.current = false;
      window.clearInterval(takt);
      abmelden?.();
    };
  }, [lesen, engine]);

  // R1: auch bei jeder neuen Antwort von `hall_sound_status` (alle 5 s) die Kopie neu lesen: nach Spielende steht „Handy ohne Netz“ so
  // höchstens einen Takt lang, nicht bis zum 30-s-Takt (`nachlesen` ist die Antwort; ihre Änderung löst das Lesen aus)
  useEffect(() => {
    if (nachlesen !== undefined) {
      lesen();
    }
  }, [nachlesen, lesen]);

  // `version` zählt die Änderungen der Engine: der Status je Spiel wird dann neu gelesen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => angepfiffeneFelder(plan, (id) => engine?.engine.view(id)?.result.state.status), [plan, engine, version]);
}
