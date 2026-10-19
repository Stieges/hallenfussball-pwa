/**
 * useAwaitingFirstUpload — „Hat dieses Konto das Turnier hier angelegt, und ist es noch nicht in der Cloud?“
 * (Review A-11 A4, @FU-098 in `plattform/2026-09-24_fundament-gemeinsamer-stand.md`, Befund C-RECHTE-NACH-ANLEGEN-UNBEKANNT).
 *
 * Quelle: die Sync-Quelle des Kontos (`activeTournamentSyncSource`, gesetzt vom RepositoryProvider). Ohne Quelle (Gast,
 * Tests ohne Provider) oder ohne `enabled`: sofort `false`. Mit Quelle: `null`, bis die erste Antwort da ist.
 * `syncTick` zählt jede Meldung der Warteschlange hoch -- der Rollen-Hook prüft daran erneut, wenn der Sync fertig ist.
 */
import { useEffect, useState } from 'react';
import {
  getActiveTournamentSyncSource,
  subscribeActiveTournamentSyncSource,
} from '../../../core/repositories/activeTournamentSyncSource';

export interface AwaitingFirstUpload {
  awaiting: boolean | null;
  syncTick: number;
}

export function useAwaitingFirstUpload(tournamentId: string, enabled: boolean): AwaitingFirstUpload {
  const [source, setSource] = useState(getActiveTournamentSyncSource);
  const [answer, setAnswer] = useState<{ tournamentId: string; awaiting: boolean } | null>(null);
  const [syncTick, setSyncTick] = useState(0);

  useEffect(() => subscribeActiveTournamentSyncSource(() => setSource(getActiveTournamentSyncSource())), []);

  useEffect(() => {
    if (!enabled || !source) {
      return;
    }
    let cancelled = false;
    const evaluate = () => {
      source
        .isAwaitingFirstUpload(tournamentId)
        .then((awaiting) => {
          if (!cancelled) {
            setAnswer({ tournamentId, awaiting });
          }
        })
        .catch(() => {
          // Lesefehler der lokalen Kopie: kein Beleg für „angelegt, nicht in der Cloud“ -- der Server entscheidet.
          if (!cancelled) {
            setAnswer({ tournamentId, awaiting: false });
          }
        });
    };
    evaluate();
    const unsubscribe = source.subscribe(() => {
      setSyncTick((tick) => tick + 1);
      evaluate();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [source, tournamentId, enabled]);

  if (!enabled || !source) {
    return { awaiting: false, syncTick };
  }
  return { awaiting: answer?.tournamentId === tournamentId ? answer.awaiting : null, syncTick };
}
