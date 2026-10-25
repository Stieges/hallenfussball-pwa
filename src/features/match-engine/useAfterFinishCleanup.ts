/**
 * useAfterFinishCleanup (R3-2b, Review #392 M2; @FU-018 letzte Zeile „wer den Eintrag übernehmen will, öffnet das Turnier
 * wieder“): Nach dem Wiederöffnen eines Turniers (heute nur über den Notweg @LZ-091) zeigt das Gerät nicht mehr „Turnier ist
 * abgeschlossen – N Einträge an die Turnierleitung übergeben“. Die Einträge liegen bei der Turnierleitung; das Gerät schließt
 * sie als übergeben ab (wie `closeHandedOver` bei zurückgegebenem Recht).
 *
 * Ob das Turnier wieder offen ist, sagt nur der Server (`tournament_lifecycle`) – nie die lokale Kopie, die nach dem Abschluss
 * noch „Läuft“ zeigen kann, bevor sie neu geladen ist (sonst verschwände der Hinweis, bevor Tom ihn sieht). Abgefragt wird nur,
 * solange solche Einträge da sind: sofort, wenn ein Turnier mit solchen Einträgen dazukommt, und alle 30 s, mit Netz und bei sichtbarer Seite.
 */
import { useEffect } from 'react';
import { readTournamentLifecycle } from '../../core/repositories/lifecycleRpc';
import type { OutboxStatus } from '../../core/match/client/outboxTypes';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export const AFTER_FINISH_CHECK_INTERVAL_MS = 30000;

export interface AfterFinishCleanupInput {
  sender: {
    getStatus(): OutboxStatus;
    subscribe(listener: (status: OutboxStatus) => void): () => void;
    closeAfterFinish(tournamentId: string): Promise<void>;
  } | null;
  accountId: string;
}

function due(): boolean {
  return document.visibilityState !== 'hidden' && (typeof navigator === 'undefined' || navigator.onLine);
}

export function useAfterFinishCleanup({ sender, accountId }: AfterFinishCleanupInput): void {
  const active = isSupabaseConfigured && supabase !== null && sender !== null && accountId !== 'guest';

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    let running = false;
    let stopped = false;
    const check = async (): Promise<void> => {
      const tournaments = Object.keys(sender.getStatus().afterFinishByTournament).filter((id) => id !== '');
      if (running || tournaments.length === 0 || !due()) {
        return;
      }
      running = true;
      try {
        for (const tournamentId of tournaments) {
          const lifecycle = await readTournamentLifecycle(supabase, tournamentId);
          // nur ein vom Server gemeldeter offener Zustand zählt; keine Antwort oder unbekannt → Hinweis bleibt
          if (!stopped && lifecycle !== undefined && lifecycle !== null && lifecycle !== 'finished' && lifecycle !== 'cancelled') {
            await sender.closeAfterFinish(tournamentId);
          }
        }
      } finally {
        running = false;
      }
    };
    void check();
    // Nur wenn neue Turniere mit solchen Einträgen dazukommen – nicht bei jeder Änderung des Ausgangs (Spielbetrieb)
    let seen = Object.keys(sender.getStatus().afterFinishByTournament).sort().join('|');
    const unsubscribe = sender.subscribe((status) => {
      const keys = Object.keys(status.afterFinishByTournament).sort().join('|');
      if (keys !== seen) {
        seen = keys;
        void check();
      }
    });
    const timer = setInterval(() => { void check(); }, AFTER_FINISH_CHECK_INTERVAL_MS);
    return () => {
      stopped = true;
      unsubscribe();
      clearInterval(timer);
    };
  }, [active, sender, accountId]);
}
