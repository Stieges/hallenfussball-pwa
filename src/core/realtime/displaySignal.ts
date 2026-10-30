/**
 * Änderungssignal für Monitore (R5 PR 1, Migration `20261118_006_monitor_aenderungssignal.sql`) – React-frei.
 *
 * Die Datenbank schickt je Änderung an Spielen, Teams oder dem Turnier ein Signal OHNE Inhalt (`{at}`) auf den
 * öffentlichen Realtime-Kanal `display:<turnier-id>` (Zone 1 „Änderungssignal“, Daniel 2026-10-29 F2). Ein Monitor ohne
 * Anmeldung darf es empfangen; die Daten holt er danach über `display_tournament` (Positivliste am Server). Der Inhalt
 * eines Signals wird nie ausgewertet – auch ein fremdes Signal löst nur einen (gedrosselten) Abruf aus.
 *
 * Ein Kanal je Turnier für alle Zuhörer dieser App (Zählung): supabase-js liefert unter demselben Thema den noch
 * „verlassenden“ Kanal zurück (C-LIVE-KANAL-LEAVING-WIEDERVERWENDUNG); das Thema ist hier fest (der Server sendet genau
 * dorthin), deshalb wartet ein neuer Beitritt, bis der alte Kanal entfernt ist.
 */
import { REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

/** Ereignisname des Signals (wie in `public.monitor_display_signal()`). */
export const DISPLAY_SIGNAL_EVENT = 'changed';

/** Kanal-Thema eines Turniers (wie in `public.monitor_display_signal()`). */
export function displaySignalTopic(tournamentId: string): string {
  return `display:${tournamentId}`;
}

/** Die Teile des Supabase-Clients, die das Signal braucht (Tests geben einen Ersatz). */
export interface DisplaySignalClient {
  channel(topic: string, params: { config: { private: boolean } }): RealtimeChannel;
  removeChannel(channel: RealtimeChannel): Promise<unknown>;
}

interface Entry {
  listeners: Set<() => void>;
  channel: RealtimeChannel | null;
}

const entries = new Map<string, Entry>();
const removals = new Map<string, Promise<unknown>>();

function notify(entry: Entry): void {
  for (const listener of [...entry.listeners]) {
    listener();
  }
}

function join(client: DisplaySignalClient, topic: string, entry: Entry): void {
  if (entries.get(topic) !== entry || entry.listeners.size === 0) {
    return;
  }
  try {
    const channel = client.channel(topic, { config: { private: false } });
    channel.on('broadcast', { event: DISPLAY_SIGNAL_EVENT }, () => { notify(entry); });
    // Nach jedem (Wieder-)Beitritt einmal melden: was während der Trennung geschah, holt der Monitor so sofort nach.
    channel.subscribe((status) => {
      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
        notify(entry);
      }
    });
    entry.channel = channel;
  } catch (err) {
    // Ohne Kanal bleibt der Rückfall-Takt (2 s); der Monitor zeigt weiter an.
    console.warn('[Monitor] Änderungssignal nicht verfügbar, Rückfall-Takt:', err);
  }
}

/**
 * Hört auf das Änderungssignal eines Turniers. Gibt die Abmeldung zurück. Ohne Supabase-Konfiguration (Offline-Build)
 * passiert nichts – der Monitor holt dann im Rückfall-Takt.
 */
export function subscribeDisplaySignal(
  tournamentId: string,
  onSignal: () => void,
  client: DisplaySignalClient | null = isSupabaseConfigured ? supabase : null,
): () => void {
  if (client === null) {
    return () => undefined;
  }
  const topic = displaySignalTopic(tournamentId);
  let entry = entries.get(topic);
  if (entry === undefined) {
    const created: Entry = { listeners: new Set(), channel: null };
    entry = created;
    entries.set(topic, created);
    const pending = removals.get(topic);
    if (pending === undefined) {
      queueMicrotask(() => { join(client, topic, created); });
    } else {
      void pending.then(() => { join(client, topic, created); });
    }
  }
  const own = entry;
  const listener = (): void => { onSignal(); };
  own.listeners.add(listener);
  return () => {
    own.listeners.delete(listener);
    if (own.listeners.size > 0 || entries.get(topic) !== own) {
      return;
    }
    entries.delete(topic);
    const channel = own.channel;
    if (channel === null) {
      return;
    }
    const removal = client.removeChannel(channel).catch(() => undefined);
    removals.set(topic, removal);
    void removal.then(() => {
      if (removals.get(topic) === removal) {
        removals.delete(topic);
      }
    });
  };
}
