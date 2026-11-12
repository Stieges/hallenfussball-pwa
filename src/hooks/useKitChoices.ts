/**
 * useKitChoices / useKitChoiceOverlay (Leibchen 2b, Punkt 3): bindet die Warteschlange der Leibchen-Wahl an React.
 *
 * - `useKitChoiceOverlay(tournament)`: legt die lokale Wahl über die Turnierkopie (Toms Cockpit zeigt sie sofort, auch ohne Netz, @SL-226),
 *   hält die Einträge gegen die Zeilen des Servers (`reconcile`, @SL-228/@SL-229), schickt wartende Einträge beim Start, beim Netz-Wiederkommen und
 *   alle 15 Sekunden, und lässt Einträge fallen, deren Spiel lokal schon angepfiffen ist (der Anpfiff trägt die Wahl im `kit`, @SL-202).
 * - `useKitChoices()`: Einträge, Meldungen und `choose` für die Karte (Schritt 2b-2). `choose` merkt die Wahl vor und sendet sofort.
 */
import { useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AuthContext } from '../features/auth/context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { kitChoiceQueueFor } from '../features/match-engine/kitChoiceRegistry';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import { applyKitChoices, kitRowStateOf } from '../core/match/client/applyKitChoices';
import type { KitChoiceEntry, KitChoiceInput, KitChoiceNotice, KitRowState } from '../core/match/client/kitChoiceQueue';
import { kitStartsOf } from '../core/match/client/matchKitFromEvents';
import { getDeviceId } from '../core/device/deviceId';
import type { Tournament } from '../types/tournament';
import { buildValidMatches } from './useEngineMatches';

const RETRY_MS = 15_000;
const NO_ENTRIES: readonly KitChoiceEntry[] = [];

/** Konto wie im `MatchEngineProvider`; ohne `AuthProvider` (Tests, Randfälle) gilt `guest` – wie die Engine nichts sendet. */
function useAccountId(): string {
  const user = useContext(AuthContext)?.user;
  return !isSupabaseConfigured || user?.id === undefined || user.globalRole === 'guest' ? 'guest' : user.id;
}

/** Eingabe der Karte: Teams und Gerät ergänzt `choose`. */
export type KitChoice = Pick<KitChoiceInput, 'matchId' | 'decision' | 'bibSide' | 'bibColor' | 'controlEpoch'>;

export function useKitChoiceOverlay(tournament: Tournament | null): Tournament | null {
  const accountId = useAccountId();
  const queue = kitChoiceQueueFor(accountId);
  const context = useMatchEngineContextOptional();
  const entries = useSyncExternalStore(queue.subscribe.bind(queue), () => queue.entries(), () => NO_ENTRIES);

  // Server-Zeilen und lokale Anpfiffe gegen die Einträge halten
  useEffect(() => {
    if (!tournament) { return; }
    queue.reconcile(new Map(tournament.matches.map((match) => [match.id, kitRowStateOf(match)])));
    if (!context) { return; }
    const started = new Set<string>();
    for (const entry of buildValidMatches(tournament)) {
      const view = context.engine.view(entry.matchId);
      if (view && kitStartsOf(view.log).length > 0) { started.add(entry.externalId); }
    }
    queue.discardStarted(started);
  }, [tournament, queue, context, entries]);

  // Wartende Einträge senden: sofort, bei Netz und regelmäßig
  useEffect(() => {
    const flush = (): void => { void queue.flush(); };
    flush();
    window.addEventListener('online', flush);
    const timer = setInterval(flush, RETRY_MS);
    return () => { window.removeEventListener('online', flush); clearInterval(timer); };
  }, [queue, entries.length]);

  return useMemo(() => (tournament ? applyKitChoices(tournament, entries) : tournament), [tournament, entries]);
}

export interface KitChoicesApi {
  entries: readonly KitChoiceEntry[];
  notices: readonly KitChoiceNotice[];
  /** Die Wahl vormerken und senden (Bestätigen, Keine Leibchen, Nachtragen); `row` = Stand der Zeile des Spiels beim Tippen. */
  choose: (choice: KitChoice, tournament: Tournament) => void;
  dismissNotice: (id: string) => void;
}

export function useKitChoices(): KitChoicesApi {
  const accountId = useAccountId();
  const queue = kitChoiceQueueFor(accountId);
  const entries = useSyncExternalStore(queue.subscribe.bind(queue), () => queue.entries(), () => NO_ENTRIES);
  const notices = useSyncExternalStore(queue.subscribe.bind(queue), () => queue.notices(), () => []);
  const choose = useCallback((choice: KitChoice, tournament: Tournament): void => {
    const match = tournament.matches.find((m) => m.id === choice.matchId);
    if (!match) { return; }
    const row: KitRowState = kitRowStateOf(match);
    const teams = row.teams?.a !== undefined && row.teams.b !== undefined ? { a: row.teams.a, b: row.teams.b } : undefined;
    queue.submit({ ...choice, teams, deviceId: getDeviceId() }, row);
    void queue.flush();
  }, [queue]);
  return useMemo(() => ({ entries, notices, choose, dismissNotice: (id: string) => { queue.dismissNotice(id); } }), [entries, notices, choose, queue]);
}
