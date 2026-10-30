/**
 * Gespeicherter Stand der Zuschauer-Seite für das Neuladen ohne Netz (B-15, @ZM-035, @ZM-036, @ZM-110).
 *
 * - Nur für den Tag, an dem er abgerufen wurde (Tag in der Ortszeit des Turniers); am nächsten Tag ist er weg, auch mit Netz.
 * - Keine Kennung von Person oder Handy; gespeichert wird das öffentliche Turnier, ohne Notizen und Monitor-Zugänge.
 * - Jede Funktion fängt Speicherfehler (privates Fenster, Platz, gesperrt) und arbeitet dann ohne Speicher.
 * Reines Modul ohne React; der Speicher wird übergeben.
 */
import type { Match, Team, Tournament } from '../../types/tournament';

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

/**
 * Positivliste (B-15, Review A2): gespeichert wird nur, was die Zuschauer-Seite zum Rechnen und Anzeigen braucht. Nicht dabei:
 * Ansprechpartner (`contactInfo`), Sponsoren (Base64-Logos), Notizen, Monitor-Konfiguration, AbsageGrund, Statistik-Schnappschuss,
 * Herkunft des Imports, Trainer der Teams die Korrekturhistorie der Spiele (Namen) und der Grund eines Ausfalls (Freitext).
 */
const STAND_TOURNAMENT_KEYS = [
  'id', 'status', 'sport', 'sportId', 'tournamentType', 'mode', 'numberOfFields', 'numberOfTeams', 'groupSystem', 'numberOfGroups',
  'groupPhaseGameDuration', 'groupPhaseBreakDuration', 'finalRoundGameDuration', 'finalRoundBreakDuration', 'breakBetweenPhases',
  'gamePeriods', 'halftimeBreak', 'gameDuration', 'breakDuration', 'roundLogic', 'numberOfRounds', 'placementLogic', 'placementsToPlayOut',
  'finalsConfig', 'refereeConfig', 'fieldAssignments', 'groups', 'fields', 'finals', 'playoffConfig', 'minRestSlots', 'isKidsTournament',
  'hideScoresForPublic', 'hideRankingsForPublic', 'resultMode', 'pointSystem', 'title', 'ageClass', 'date', 'timeSlot', 'startDate',
  'startTime', 'location', 'organizer', 'rulebook', 'teams', 'matches', 'createdAt', 'updatedAt', 'tournamentSystem',
  'matchCockpitSettings', 'version', 'isPublic', 'shareCode', 'publishedAt', 'bibColor', 'spectatorDisplay', 'hostTeamIds',
  'standingDecisions', 'groupCompletions', 'forfeitScore', 'openingMode',
] as const satisfies readonly (keyof Tournament)[];

function pickKeys<T extends object>(source: T, keys: readonly (keyof T)[]): Partial<T> {
  const copy: Partial<T> = {};
  for (const key of keys) {
    if (source[key] !== undefined) {
      copy[key] = source[key];
    }
  }
  return copy;
}

const STAND_TEAM_KEYS = ['id', 'name', 'group', 'isRemoved', 'removedAt', 'logo', 'colors'] as const satisfies readonly (keyof Team)[];

/** Kopie für den Speicher: nur die Positivliste (Turnier, Teams ohne Trainer, Spiele ohne Korrekturhistorie). */
export function toPublicCopy(tournament: Tournament): Tournament {
  const copy = pickKeys(tournament, STAND_TOURNAMENT_KEYS);
  return {
    ...copy,
    teams: tournament.teams.map((team) => pickKeys(team, STAND_TEAM_KEYS) as Team),
    matches: tournament.matches.map(({ correctionHistory: _history, skippedReason: _reason, ...match }) => match),
  } as Tournament;
}

/** `scheduledTime` und `originalStart` (B-27) sind die einzigen Daten im Turnier; JSON macht daraus Text. */
function reviveDates(tournament: Tournament): Tournament {
  return {
    ...tournament,
    matches: tournament.matches.map((match: Match) => ({
      ...match,
      ...(typeof match.scheduledTime === 'string' ? { scheduledTime: new Date(match.scheduledTime) } : {}),
      ...(typeof match.originalStart === 'string' ? { originalStart: new Date(match.originalStart) } : {}),
    })),
  };
}

export function saveStand(storage: StandStorage | null, shareCode: string, stand: StoredStand): void {
  if (storage === null) {
    return;
  }
  attempt(() => {
    const key = STAND_PREFIX + shareCode;
    if (isOlderThanStored(stand, parseStand(storage.getItem(key)))) {
      return;
    }
    storage.setItem(key, JSON.stringify({ ...stand, tournament: toPublicCopy(stand.tournament) }));
  });
}

/**
 * @ZM-180: ein älterer Stand (z. B. aus einem zweiten Tab) überschreibt keinen neueren. Vergleichbar sind nur Zahlen-Versionen
 * derselben Quelle (`rpc`); der Fingerabdruck der Quelle `legacy` hat keine Reihenfolge, dort gilt wie bisher der letzte Abruf.
 */
function isOlderThanStored(stand: StoredStand, stored: StoredStand | null): boolean {
  if (stored?.source !== 'rpc' || stand.source !== 'rpc') {
    return false;
  }
  const next = Number(stand.version);
  const held = Number(stored.version);
  return Number.isFinite(next) && Number.isFinite(held) && next < held;
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

/**
 * Räumt Stände anderer Turniere vom Vortag auf (@ZM-110) – beim Öffnen irgendeiner Zuschauer-Seite. Wer die Seite nie wieder
 * öffnet, behält den Stand des letzten Besuchs (nur Positivliste, ohne Kennung) bis er den Browser-Speicher leert.
 */
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
