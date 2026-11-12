/**
 * useAngepfiffeneFelder(tid) – Felder des Turniers mit angepfiffenem Spiel, für die Anzeige „Feld N: Handy ohne Netz“ (@HT-035).
 * Plan aus der lokalen Turnierkopie (nur lokal gelesen, alle 30 s und bei jeder Änderung der eigenen Engine), Status zuerst nach der
 * Engine, sonst nach der Kopie (`angepfiffeneFelder.ts`). Ohne Engine (kein Konto) zählt nur die Kopie.
 */
import { useEffect, useMemo, useReducer, useState } from 'react';
import { useMatchEngineContextOptional } from '../match-engine/useMatchEngineContext';
import { ladeTurnierLokal } from './lokalesTurnier';
import { angepfiffeneFelder } from './runtime/angepfiffeneFelder';
import type { PlanSpiel } from './runtime/feldStandSpiele';
import { planAusTurnier } from './runtime/lokalerSpielplan';

export const PLAN_LESEN_MS = 30_000;

export function useAngepfiffeneFelder(tid: string): ReadonlySet<number> {
  const engine = useMatchEngineContextOptional();
  const [plan, setPlan] = useState<readonly PlanSpiel[]>([]);
  const [version, neuBewerten] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    let aktiv = true;
    const lesen = (): void => {
      void ladeTurnierLokal(tid).catch(() => null).then((turnier) => {
        if (!aktiv) {
          return;
        }
        try {
          setPlan(turnier ? planAusTurnier(turnier) : []);
        } catch {
          setPlan([]); // unlesbare Kopie: kein Feld gilt als angepfiffen
        }
      });
    };
    lesen();
    const takt = window.setInterval(lesen, PLAN_LESEN_MS);
    const abmelden = engine?.engine.subscribe(() => {
      neuBewerten();
      lesen();
    });
    return () => {
      aktiv = false;
      window.clearInterval(takt);
      abmelden?.();
    };
  }, [tid, engine]);

  // `version` zählt die Änderungen der Engine: der Status je Spiel wird dann neu gelesen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => angepfiffeneFelder(plan, (id) => engine?.engine.view(id)?.result.state.status), [plan, engine, version]);
}
