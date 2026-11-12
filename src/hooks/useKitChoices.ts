/**
 * useKitChoices / useKitChoiceOverlay (Leibchen 2b, Punkt 3): bindet die Warteschlange der Leibchen-Wahl an React.
 *
 * - `useKitChoiceOverlay(tournament)`: legt die lokale Wahl über die Turnierkopie (Toms Cockpit zeigt sie sofort, auch ohne Netz, @SL-226),
 *   hält die Einträge gegen die Zeilen des Servers (`reconcile`, @SL-228/@SL-229), schickt wartende Einträge beim Start, beim Netz-Wiederkommen und
 *   alle 15 Sekunden, und lässt Einträge fallen, deren Spiel lokal schon angepfiffen ist (der Anpfiff trägt die Wahl im `kit`, @SL-202).
 * - `useKitChoices()`: Einträge, Meldungen und `choose` für die Karte (Schritt 2b-2). `choose` merkt die Wahl vor und sendet sofort.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
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
  const abgleichen = useCallback((): void => {
    if (!tournament) { return; }
    // Wahl vom Server zurückgenommen (anderes Team auf einer Seite, @SL-212)? Zeilen aller Spiele mit Wahl und der bisher bekannten
    const beobachtet = new Map<string, KitRowState>();
    const bekannt = new Set(queue.decidedMatchIds());
    for (const m of tournament.matches) {
      if (m.kitDecision !== undefined || bekannt.has(m.id)) { beobachtet.set(m.id, kitRowStateOf(m)); }
    }
    queue.observeRows(beobachtet);
    if (queue.entries().length === 0) { return; }
    const rows = new Map<string, KitRowState>();
    for (const entry of queue.entries()) {
      const match = tournament.matches.find((m) => m.id === entry.matchId);
      if (match) { rows.set(match.id, kitRowStateOf(match)); }
    }
    const started = new Set<string>();
    if (context !== null) {
      for (const entry of buildValidMatches(tournament)) {
        const view = context.engine.view(entry.matchId);
        const match = tournament.matches.find((m) => m.id === entry.externalId);
        // Entscheidend ist der Zustand jetzt: nach „Anpfiff rückgängig“ bleibt der MATCH_START im Log, das Spiel ist aber wieder nicht angepfiffen (@SL-214)
        const kicked = match?.matchStatus === 'running' || match?.matchStatus === 'paused';
        if (view && kicked && kitStartsOf(view.log).length > 0) { started.add(entry.externalId); }
      }
    }
    queue.discardStarted(started); // zuerst: wer selbst angepfiffen hat, dessen Wahl trägt der Anpfiff
    queue.reconcile(rows);
  }, [tournament, queue, context]);
  useEffect(() => { abgleichen(); }, [abgleichen, entries]);

  // Wartende Einträge senden: sofort, bei Netz und regelmäßig – erst gegen die Zeile abgleichen, dann senden: eine Wahl vor dem Anpfiff, die ein fremder
  // Anpfiff überholt hat, geht nicht als Nachtrag raus (@SL-229 Zeile 1); kommt sie doch als „live“ an, meldet die Warteschlange „zu spät“
  const abgleichenRef = useRef(abgleichen);
  abgleichenRef.current = abgleichen;
  useEffect(() => {
    const sende = (): void => { abgleichenRef.current(); void queue.flush(); };
    sende();
    window.addEventListener('online', sende);
    const timer = setInterval(sende, RETRY_MS);
    return () => { window.removeEventListener('online', sende); clearInterval(timer); };
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
    const phase = row.kickedOff === true ? 'live' : 'before';
    const teams = row.teams?.a !== undefined && row.teams.b !== undefined ? { a: row.teams.a, b: row.teams.b } : undefined;
    queue.submit({ ...choice, teams, deviceId: getDeviceId(), phase }, row);
    void queue.flush();
  }, [queue]);
  return useMemo(() => ({ entries, notices, choose, dismissNotice: (id: string) => { queue.dismissNotice(id); } }), [entries, notices, choose, queue]);
}
