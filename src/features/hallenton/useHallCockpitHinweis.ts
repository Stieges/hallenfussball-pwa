/**
 * useHallCockpitHinweis(tid, feldId) – Datenseite der Cockpit-Hinweise zum Hallen-Lautsprecher (H3b-3, @HT-040, @HT-050; die
 * Oberfläche kommt in H4). Quelle ist die Antwort auf das Lebenszeichen der Leitung (`leitungGeraet.ts`): Es läuft nur, solange
 * dieses Gerät das Feld steuert und dort ein Spiel angepfiffen ist – sonst `keiner` (kein Hinweis, @HT-016, @HT-038).
 *
 * - `aus` mit Grund: „Hallen-Lautsprecher aus – Ende selbst anzeigen“ (nicht bereit oder „meldet sich nicht (zuletzt …)“).
 * - `ausgangGeaendert`: ruhige Zeile „🔈? Hallenton-Ausgang geändert“ (@HT-050).
 * - `unbekannt`: die eigene letzte Antwort ist älter als 15 s (dieses Gerät hat kein Netz) – kein alter Stand als aktuell.
 * Neu bewertet bei jeder Antwort und alle 5 s, solange es einen Stand gibt.
 */
import { useEffect, useReducer, useSyncExternalStore } from 'react';
import { abonniereLeitung, aktuelleLeitung } from './leitungGeraet';
import { cockpitHinweisAusLeitung, feldNummer, type CockpitHinweis } from './runtime/hallStatusAuswertung';

const NEU_BEWERTEN_MS = 5000;
const nieAbonniert = (): (() => void) => () => undefined;

export function useHallCockpitHinweis(tid: string, feldId: string): CockpitHinweis {
  const leitung = useSyncExternalStore(abonniereLeitung, aktuelleLeitung, () => null);
  useSyncExternalStore(leitung?.subscribe ?? nieAbonniert, () => leitung?.version() ?? 0, () => 0);
  const [, neuBewerten] = useReducer((n: number) => n + 1, 0);
  const feld = feldNummer(feldId);
  const stand = leitung !== null && feld !== null ? leitung.stand(tid, feld) : null;
  const mitStand = stand !== null;

  useEffect(() => {
    if (!mitStand) {
      return undefined;
    }
    const takt = window.setInterval(neuBewerten, NEU_BEWERTEN_MS);
    return () => window.clearInterval(takt);
  }, [mitStand]);

  return cockpitHinweisAusLeitung(stand, leitung?.jetzt() ?? 0, feld !== null && (leitung?.versuchGescheitert(tid, feld) ?? false));
}
