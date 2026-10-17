/**
 * koResolutionQueue (A-08f3e2 Fixrunde 1, I-1): Spielplan-Einträge, nach deren Bestätigung durch den Server
 * die K.-o.-Plätze besetzt werden. Liegt im Gerätespeicher (übersteht Tab-Wechsel und Neuladen), je Turnier.
 * Benachrichtigt Abonnenten im selben Tab, wenn ein Eintrag dazukommt.
 */
import { safeLocalStorage } from '../core/utils/safeStorage';

export interface KoAwaitedEntry {
  eventId: string;
  /** Engine-Schlüssel des Spiels (klein geschrieben, wie `ValidMatchEntry.matchId`). */
  matchId: string;
}

const listeners = new Set<(tournamentId: string) => void>();

function key(tournamentId: string): string {
  return `ko-resolution-awaited:${tournamentId}`;
}

function isAwaited(value: unknown): value is KoAwaitedEntry {
  return typeof value === 'object' && value !== null
    && typeof (value as KoAwaitedEntry).eventId === 'string' && typeof (value as KoAwaitedEntry).matchId === 'string';
}

export function readKoQueue(tournamentId: string): KoAwaitedEntry[] {
  try {
    const parsed: unknown = JSON.parse(safeLocalStorage.getItem(key(tournamentId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isAwaited) : [];
  } catch {
    return [];
  }
}

function write(tournamentId: string, entries: KoAwaitedEntry[]): void {
  if (entries.length === 0) {
    safeLocalStorage.removeItem(key(tournamentId));
  } else {
    safeLocalStorage.setItem(key(tournamentId), JSON.stringify(entries));
  }
}

export function enqueueKo(tournamentId: string, entry: KoAwaitedEntry): void {
  const current = readKoQueue(tournamentId).filter((existing) => existing.eventId !== entry.eventId);
  write(tournamentId, [...current, entry]);
  listeners.forEach((listener) => listener(tournamentId));
}

/** Entfernt nur die erledigten Einträge -- ein gleichzeitig hinzugekommener bleibt erhalten. */
export function removeFromKoQueue(tournamentId: string, eventIds: ReadonlySet<string>): void {
  write(tournamentId, readKoQueue(tournamentId).filter((entry) => !eventIds.has(entry.eventId)));
}

export function subscribeKoQueue(listener: (tournamentId: string) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
