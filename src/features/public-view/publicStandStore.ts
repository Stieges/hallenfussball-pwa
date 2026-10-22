/**
 * Gespeicherter Stand der Zuschauer-Seite für das Neuladen ohne Netz (B-15, @ZM-035, @ZM-036, @ZM-110).
 *
 * - Nur für den Tag, an dem er abgerufen wurde (Tag in der Ortszeit des Turniers); am nächsten Tag ist er weg, auch mit Netz.
 * - Keine Kennung von Person oder Handy; gespeichert wird das öffentliche Turnier, ohne Notizen und Monitor-Zugänge.
 * - Jede Funktion fängt Speicherfehler (privates Fenster, Platz, gesperrt) und arbeitet dann ohne Speicher.
 * Reines Modul ohne React; der Speicher wird übergeben.
 */
import type { Match, Tournament } from '../../types/tournament';

export type StandStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export interface StoredStand {
  /** Welcher Adapter den Stand geliefert hat; Versionen verschiedener Adapter sind nicht vergleichbar */
  source: 'legacy' | 'rpc';
  version: string;
  /** Tag des Abrufs in Ortszeit des Turniers (YYYY-MM-DD) */
  day: string;
  tournament: Tournament;
}

/** Zeitpunkt des letzten erfolgreichen Abrufs, klein und oft geschrieben (auch ohne neuen Inhalt). */
export interface StoredContact {
  /** Serverzeit (ms): daraus „Stand von 14:32“ */
  atMs: number;
  /** Geräteuhr (ms): für die Frist von 20 Sekunden */
  deviceMs: number;
}

const STAND_PREFIX = 'publicStand:v1:';
const CONTACT_PREFIX = 'publicContact:v1:';
const KEY_PATTERN = /^public(Stand|Contact):v1:/;

/** Der Speicher des Browsers, oder `null`, wenn er gesperrt ist. */
export function browserStandStorage(): StandStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function attempt<T>(action: () => T): T | undefined {
  try {
    return action();
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Für andere gedacht ist nur, was Zuschauer sehen dürfen: Notizen und Monitor-Konfiguration bleiben draußen. */
function toPublicCopy(tournament: Tournament): Tournament {
  const { adminNotes: _notes, monitors: _monitors, ...rest } = tournament;
  return rest;
}

/** `scheduledTime` ist das einzige Datum im Turnier; JSON macht daraus einen Text. */
function reviveDates(tournament: Tournament): Tournament {
  return {
    ...tournament,
    matches: tournament.matches.map((match: Match) => (
      typeof match.scheduledTime === 'string' ? { ...match, scheduledTime: new Date(match.scheduledTime) } : match
    )),
  };
}

export function saveStand(storage: StandStorage | null, shareCode: string, stand: StoredStand): void {
  if (storage === null) {
    return;
  }
  attempt(() => { storage.setItem(STAND_PREFIX + shareCode, JSON.stringify({ ...stand, tournament: toPublicCopy(stand.tournament) })); });
}

export function saveContact(storage: StandStorage | null, shareCode: string, contact: StoredContact): void {
  if (storage === null) {
    return;
  }
  attempt(() => { storage.setItem(CONTACT_PREFIX + shareCode, JSON.stringify(contact)); });
}

export function clearStand(storage: StandStorage | null, shareCode: string): void {
  if (storage === null) {
    return;
  }
  attempt(() => { storage.removeItem(STAND_PREFIX + shareCode); });
  attempt(() => { storage.removeItem(CONTACT_PREFIX + shareCode); });
}

function parseStand(raw: unknown): StoredStand | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const data = attempt((): unknown => JSON.parse(raw));
  if (!isRecord(data) || !isRecord(data.tournament) || !Array.isArray(data.tournament.matches)) {
    return null;
  }
  const { source, version, day } = data;
  if ((source !== 'legacy' && source !== 'rpc') || typeof version !== 'string' || typeof day !== 'string') {
    return null;
  }
  return { source, version, day, tournament: reviveDates(data.tournament as unknown as Tournament) };
}

function parseContact(raw: unknown): StoredContact | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const data = attempt((): unknown => JSON.parse(raw));
  return isRecord(data) && typeof data.atMs === 'number' && typeof data.deviceMs === 'number'
    ? { atMs: data.atMs, deviceMs: data.deviceMs }
    : null;
}

export interface LoadedStand {
  stand: StoredStand;
  contact: StoredContact | null;
}

/**
 * Der gespeicherte Stand dieses Turniers, wenn er von heute ist. Ein Stand von einem anderen Tag wird dabei gelöscht
 * (@ZM-110), ebenso einer, den eine andere Quelle geliefert hat oder der unlesbar ist.
 */
export function loadStand(storage: StandStorage | null, shareCode: string, today: string, source: StoredStand['source']): LoadedStand | null {
  if (storage === null) {
    return null;
  }
  const stand = attempt(() => parseStand(storage.getItem(STAND_PREFIX + shareCode)));
  if (stand?.day !== today || stand.source !== source) {
    clearStand(storage, shareCode);
    return null;
  }
  return { stand, contact: attempt(() => parseContact(storage.getItem(CONTACT_PREFIX + shareCode))) ?? null };
}

/** Räumt Stände anderer Turniere vom Vortag auf (@ZM-110): wer nie wiederkommt, lässt nichts liegen. */
export function purgeOldStands(storage: StandStorage | null, today: string): void {
  if (storage === null) {
    return;
  }
  const keys: string[] = [];
  const count = attempt(() => storage.length) ?? 0;
  for (let index = 0; index < count; index += 1) {
    const key = attempt(() => storage.key(index));
    if (typeof key === 'string' && KEY_PATTERN.test(key)) {
      keys.push(key);
    }
  }
  for (const key of keys.filter((candidate) => candidate.startsWith(STAND_PREFIX))) {
    const stand = attempt(() => parseStand(storage.getItem(key)));
    if (stand?.day !== today) {
      attempt(() => { storage.removeItem(key); });
      attempt(() => { storage.removeItem(CONTACT_PREFIX + key.slice(STAND_PREFIX.length)); });
    }
  }
}
