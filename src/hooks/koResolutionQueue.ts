/**
 * koResolutionQueue (A-08f3e2 Fixrunde 1, I-1): Spielplan-Einträge, nach deren Bestätigung durch den Server
 * die K.-o.-Plätze besetzt werden. Liegt im Gerätespeicher (übersteht Tab-Wechsel und Neuladen), je Konto und
 * Turnier (Fixrunde 2, A-1: ein Kontowechsel auf demselben Gerät verwirft den Eintrag eines anderen Kontos nicht).
 * A-2: Zusätzlich eine Kopie im Arbeitsspeicher; gelesen wird die Vereinigung beider Quellen, damit ein
 * Speicherfehler (Gerätespeicher voll) den Eintrag in dieser Sitzung nicht still verschwinden lässt.
 * Benachrichtigt Abonnenten im selben Tab, wenn ein Eintrag dazukommt.
 */
import { safeLocalStorage } from '../core/utils/safeStorage';

export interface KoAwaitedEntry {
  eventId: string;
  /** Engine-Schlüssel des Spiels (klein geschrieben, wie `ValidMatchEntry.matchId`). */
  matchId: string;
}

const listeners = new Set<(tournamentId: string) => void>();
const memory = new Map<string, KoAwaitedEntry[]>();
/** Erledigte Einträge dieser Sitzung -- ein nicht gelöschter Rest im Gerätespeicher kommt nicht zurück. */
const done = new Set<string>();

function key(accountId: string, tournamentId: string): string {
  return `ko-resolution-awaited:${accountId}:${tournamentId}`;
}

function isAwaited(value: unknown): value is KoAwaitedEntry {
  return typeof value === 'object' && value !== null
    && typeof (value as KoAwaitedEntry).eventId === 'string' && typeof (value as KoAwaitedEntry).matchId === 'string';
}

function readStorage(storageKey: string): KoAwaitedEntry[] {
  try {
    const parsed: unknown = JSON.parse(safeLocalStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isAwaited) : [];
  } catch {
    return [];
  }
}

export function readKoQueue(accountId: string, tournamentId: string): KoAwaitedEntry[] {
  const storageKey = key(accountId, tournamentId);
  const byId = new Map<string, KoAwaitedEntry>();
  for (const entry of [...readStorage(storageKey), ...(memory.get(storageKey) ?? [])]) {
    if (!done.has(entry.eventId)) {
      byId.set(entry.eventId, entry);
    }
  }
  return [...byId.values()];
}

function write(storageKey: string, entries: KoAwaitedEntry[]): void {
  memory.set(storageKey, entries);
  try {
    if (entries.length === 0) {
      safeLocalStorage.removeItem(storageKey);
    } else {
      safeLocalStorage.setItem(storageKey, JSON.stringify(entries));
    }
  } catch {
    // A-2: die Kopie im Arbeitsspeicher trägt diese Sitzung weiter.
  }
}

export function enqueueKo(accountId: string, tournamentId: string, entry: KoAwaitedEntry): void {
  done.delete(entry.eventId);
  const current = readKoQueue(accountId, tournamentId).filter((existing) => existing.eventId !== entry.eventId);
  write(key(accountId, tournamentId), [...current, entry]);
  listeners.forEach((listener) => listener(tournamentId));
}

/** Entfernt nur die erledigten Einträge -- ein gleichzeitig hinzugekommener bleibt erhalten. */
export function removeFromKoQueue(accountId: string, tournamentId: string, eventIds: ReadonlySet<string>): void {
  eventIds.forEach((eventId) => done.add(eventId));
  write(key(accountId, tournamentId), readKoQueue(accountId, tournamentId));
}

export function subscribeKoQueue(listener: (tournamentId: string) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
