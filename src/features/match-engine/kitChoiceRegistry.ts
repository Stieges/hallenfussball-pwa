/**
 * Die Warteschlange der Leibchen-Wahl je Konto (Leibchen 2b, Punkt 3): EINE Instanz pro Konto und Gerät, damit Karte, Zeile und Anzeige dieselben
 * Einträge sehen. Der Aufruf geht über den Repository-Client `sendMatchKitSet` (kein direkter Supabase-Aufruf aus Komponenten, LAYERING).
 * Gast (kein Supabase): nichts wird gesendet; der Eintrag gilt nur lokal und geht mit dem Anpfiff in dessen `kit` (`kitBeimAnpfiff`).
 */
import { KitChoiceQueue } from '../../core/match/client/kitChoiceQueue';
import { sendMatchKitSet } from '../../core/repositories/matchKitSetRpc';
import { getDeviceId } from '../../core/device/deviceId';
import { safeLocalStorage } from '../../core/utils/safeStorage';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

const queues = new Map<string, KitChoiceQueue>();

/** Die Warteschlange für ein Konto (`guest` = ohne Konto, sendet nie). */
export function kitChoiceQueueFor(accountId: string): KitChoiceQueue {
  const key = `${accountId}:${getDeviceId()}`;
  const known = queues.get(key);
  if (known !== undefined) {
    return known;
  }
  const queue = new KitChoiceQueue({
    send: (args) => (accountId === 'guest' || !isSupabaseConfigured ? Promise.resolve({ kind: 'offline' as const }) : sendMatchKitSet(supabase, args)),
    storage: { get: (storageKey) => safeLocalStorage.getItem(storageKey), set: (storageKey, value) => { safeLocalStorage.setItem(storageKey, value); } },
    storageKey: key,
    now: () => Date.now(),
  });
  queues.set(key, queue);
  return queue;
}
