/**
 * useTournamentGraphics – Turnierlogo und zweite Grafik eines Turniers aus dem Gerätespeicher (@W3-030, PDF-Paket T3).
 *
 * Dünner Controller über `tournamentGraphicsStore`: laden, speichern, entfernen. Ein Fehler beim Speichern (etwa die
 * Quote) steht in `error` und wird vom Aufrufer gezeigt; der gezeigte Stand bleibt dann der gespeicherte.
 * Ohne Turnier-ID oder ohne Eintrag (anderes Gerät) sind die Grafiken leer, ohne Fehler (@DR-024).
 */
import { useCallback, useEffect, useState } from 'react';
import { tournamentGraphicsStore, type TournamentGraphics, type TournamentGraphicsStore } from '../core/storage/tournamentGraphicsStore';

export interface UseTournamentGraphics {
  graphics: TournamentGraphics;
  loading: boolean;
  /** Letzter Fehler beim Laden, Speichern oder Entfernen. */
  error: Error | null;
  clearError: () => void;
  /** Ersetzt die gespeicherten Grafiken. `true`, wenn gespeichert; bei Fehler `false` und `error` gesetzt. */
  save: (next: TournamentGraphics) => Promise<boolean>;
  /** Entfernt alle Grafiken dieses Turniers. */
  remove: () => Promise<boolean>;
}

const EMPTY: TournamentGraphics = {};

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

export function useTournamentGraphics(
  tournamentId: string | undefined,
  store: TournamentGraphicsStore = tournamentGraphicsStore,
): UseTournamentGraphics {
  const [graphics, setGraphics] = useState<TournamentGraphics>(EMPTY);
  const [loading, setLoading] = useState(tournamentId !== undefined);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (tournamentId === undefined) {
      setGraphics(EMPTY);
      setLoading(false);
      return undefined;
    }
    let current = true;
    setLoading(true);
    store.load(tournamentId)
      .then((loaded) => { if (current) { setGraphics(loaded); } })
      .catch((cause: unknown) => { if (current) { setGraphics(EMPTY); setError(asError(cause)); } })
      .finally(() => { if (current) { setLoading(false); } });
    return () => { current = false; };
  }, [tournamentId, store]);

  const save = useCallback(async (next: TournamentGraphics): Promise<boolean> => {
    if (tournamentId === undefined) { return false; }
    try {
      await store.save(tournamentId, next);
      setGraphics(next);
      setError(null);
      return true;
    } catch (cause) {
      setError(asError(cause));
      return false;
    }
  }, [tournamentId, store]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (tournamentId === undefined) { return false; }
    try {
      await store.remove(tournamentId);
      setGraphics(EMPTY);
      setError(null);
      return true;
    } catch (cause) {
      setError(asError(cause));
      return false;
    }
  }, [tournamentId, store]);

  const clearError = useCallback(() => setError(null), []);

  return { graphics, loading, error, clearError, save, remove };
}
