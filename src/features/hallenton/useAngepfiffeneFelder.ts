/**
 * useAngepfiffeneFelder(tid) – Felder des Turniers mit angepfiffenem Spiel, für die Anzeige „Feld N: Handy ohne Netz“ (@HT-035). Dünne Hülle um
 * `useLaufendeSpiele` (dort steht, woher der Plan kommt).
 */
import { useMemo } from 'react';
import { useLaufendeSpiele } from './useLaufendeSpiele';

export { PLAN_LESEN_MS } from './useLaufendeSpiele';

export function useAngepfiffeneFelder(tid: string, nachlesen?: unknown): ReadonlySet<number> {
  const laufend = useLaufendeSpiele(tid, nachlesen);
  return useMemo(() => new Set(laufend.keys()), [laufend]);
}
