/**
 * Zugangs-Index `helper:access:v1` auf dem Helfer-Gerät (Plan GA5 v2.1 § 3.2, R-GA5-1).
 *
 * Der Index ist nur ein Wegweiser für den Wiedereinstieg (@HE-074, @HE-095, @HE-096, @HE-098, @HE-099); das Recht prüft
 * immer der Server. Er liegt im `localStorage` (über `safeLocalStorage`), weil er das Schließen des Tabs überstehen muss –
 * im `sessionStorage` wäre er mit dem Tab weg.
 *
 * Regeln:
 * - Er gehört zu genau einer Gerätesitzung (`deviceUserId`). Passt sie nicht mehr zur Sitzung, eine fremde Version oder
 *   kaputter Inhalt → verwerfen und online neu aufbauen (`parseHelperAccessIndex`).
 * - Meldet sich ein Konto an, wird er geleert (`clearHelperAccessIndex`, siehe `loginGuard.ts`).
 * - Zustandsantwort ohne Anfrage dieses Geräts (`noRequest`) oder „leitet“ → Eintrag entfernen.
 */
import {
  HELPER_ACCESS_STORAGE_KEY,
  parseHelperAccessIndex,
  type HelperAccessEntry,
  type HelperAccessIndexV1,
  type HelperAccessStatus,
} from '../../core/repositories/helperAccessRpc';
import { safeLocalStorage } from '../../core/utils/safeStorage';

/** Der Teil von `Storage`, den der Index braucht; `setItemPersisted` meldet, ob der echte Speicher den Wert genommen hat. */
export interface HelperAccessStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  setItemPersisted?(key: string, value: string): boolean;
}

const defaultStorage: HelperAccessStorage = safeLocalStorage;

type StoredRelation = HelperAccessEntry['relation'];
const STORED_RELATIONS: readonly StoredRelation[] = ['pending', 'accepted', 'viewer', 'revoked', 'declined', 'expired'];

function isStoredRelation(relation: string | undefined): relation is StoredRelation {
  return STORED_RELATIONS.some((r) => r === relation);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function write(index: HelperAccessIndexV1, storage: HelperAccessStorage): boolean {
  const value = JSON.stringify(index);
  if (storage.setItemPersisted) {
    return storage.setItemPersisted(HELPER_ACCESS_STORAGE_KEY, value);
  }
  storage.setItem(HELPER_ACCESS_STORAGE_KEY, value);
  return true;
}

export function clearHelperAccessIndex(storage: HelperAccessStorage = defaultStorage): void {
  storage.removeItem(HELPER_ACCESS_STORAGE_KEY);
}

/** Liegt überhaupt ein Index auf dem Gerät (ohne Prüfung, zu welcher Sitzung er gehört)? */
export function hasStoredHelperAccessIndex(storage: HelperAccessStorage = defaultStorage): boolean {
  return storage.getItem(HELPER_ACCESS_STORAGE_KEY) !== null;
}

/**
 * Index der aktuellen Gerätesitzung. Ein gespeicherter Index, der nachweislich nicht passt (fremde Version, kaputt, andere
 * Gerätesitzung), wird dabei entfernt; `null` heißt „online neu aufbauen“. Ist die Sitzung unbekannt (`null`, z. B.
 * Offline-Start mit abgelaufenem Zugang), bleibt der Index liegen – samt Merkern (Review #331 M-2, @HE-028, @HE-074).
 */
export function readHelperAccessIndex(
  sessionUserId: string | null,
  storage: HelperAccessStorage = defaultStorage,
): HelperAccessIndexV1 | null {
  const raw = storage.getItem(HELPER_ACCESS_STORAGE_KEY);
  if (raw === null || sessionUserId === null) {
    return null;
  }
  const index = parseHelperAccessIndex(parseJson(raw), sessionUserId);
  if (index === null) {
    clearHelperAccessIndex(storage);
  }
  return index;
}

/**
 * Index ohne Prüfung der Sitzung – nur für den Start ohne lesbare Sitzung (Offline, abgelaufenes Token, @HE-028). Er ist
 * ein Wegweiser; das Recht prüft der Server, sobald Netz da ist. Kaputt/fremde Version → `null` (nichts wird gelöscht).
 */
export function peekHelperAccessIndex(storage: HelperAccessStorage = defaultStorage): HelperAccessIndexV1 | null {
  const raw = storage.getItem(HELPER_ACCESS_STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  const json = parseJson(raw);
  const owner = typeof json === 'object' && json !== null && 'deviceUserId' in json ? json.deviceUserId : null;
  return typeof owner === 'string' ? parseHelperAccessIndex(json, owner) : null;
}

function currentEntries(deviceUserId: string, storage: HelperAccessStorage): HelperAccessEntry[] {
  return readHelperAccessIndex(deviceUserId, storage)?.entries ?? [];
}

/** Legt einen Eintrag an oder ersetzt den Eintrag desselben Turniers. `false`: nur im Arbeitsspeicher (privates Fenster). */
export function upsertHelperAccessEntry(
  deviceUserId: string,
  entry: HelperAccessEntry,
  storage: HelperAccessStorage = defaultStorage,
): boolean {
  const others = currentEntries(deviceUserId, storage).filter((e) => e.tournamentId !== entry.tournamentId);
  return write({ version: 1, deviceUserId, entries: [...others, entry] }, storage);
}

export function removeHelperAccessEntry(
  deviceUserId: string,
  tournamentId: string,
  storage: HelperAccessStorage = defaultStorage,
): void {
  const index = readHelperAccessIndex(deviceUserId, storage);
  if (!index?.entries.some((e) => e.tournamentId === tournamentId)) {
    return;
  }
  write({ ...index, entries: index.entries.filter((e) => e.tournamentId !== tournamentId) }, storage);
}

export function findHelperAccessEntry(
  deviceUserId: string,
  tournamentId: string,
  storage: HelperAccessStorage = defaultStorage,
): HelperAccessEntry | null {
  return currentEntries(deviceUserId, storage).find((e) => e.tournamentId === tournamentId) ?? null;
}

/**
 * Eintrag aus einer Server-Antwort (`join_code_info`, `request_helper_access`, `helper_access_status`). `null`, wenn das
 * Gerät keine eigene Beziehung zum Turnier hat (`none`, `leader`) oder Turnier-Angaben fehlen und es keinen alten Eintrag
 * gibt. Merker des Geräts (Startbildschirm-Hinweis, „Offline bereit“) bleiben erhalten.
 */
export function entryFromServer(
  info: HelperAccessStatus,
  code: string | null,
  previous: HelperAccessEntry | null,
  now: Date = new Date(),
): HelperAccessEntry | null {
  if (!isStoredRelation(info.relation)) {
    return null;
  }
  const tournament = info.tournament ?? (previous
    ? { id: previous.tournamentId, title: previous.title, date: previous.date }
    : null);
  const entryCode = code ?? previous?.code ?? null;
  if (!tournament || entryCode === null) {
    return null;
  }
  return {
    tournamentId: tournament.id,
    title: tournament.title,
    date: tournament.date,
    code: entryCode,
    field: info.field ?? null,
    relation: info.relation,
    // @HE-098 Z.2: `join_code_info` meldet den Abschluss nur über `state:'closed'` (ohne `closed`), der Zugangsstatus
    // zusätzlich über `closed`. Ohne beides gilt der alte Stand.
    closed: info.closed ?? (info.state === undefined ? previous?.closed ?? false : info.state === 'closed'),
    checkNumber: info.checkNumber ?? null,
    homeHintDismissed: previous?.homeHintDismissed ?? false,
    offlineReadyAt: previous?.offlineReadyAt ?? null,
    updatedAt: now.toISOString(),
  };
}

/**
 * Gleicht den Index mit einer Server-Antwort für ein Turnier ab: Beziehung vorhanden → Eintrag schreiben; keine Anfrage
 * dieses Geräts (`relation:'none'`) oder „leitet“ → Eintrag entfernen (§ 3.2 Zeile `noRequest`).
 */
export function syncHelperAccessEntry(
  deviceUserId: string,
  tournamentId: string,
  info: HelperAccessStatus,
  code: string | null,
  storage: HelperAccessStorage = defaultStorage,
  now: Date = new Date(),
): HelperAccessEntry | null {
  const previous = findHelperAccessEntry(deviceUserId, tournamentId, storage);
  const entry = entryFromServer(info, code, previous, now);
  if (entry) {
    upsertHelperAccessEntry(deviceUserId, entry, storage);
    return entry;
  }
  if (info.relation === 'none' || info.relation === 'leader') {
    removeHelperAccessEntry(deviceUserId, tournamentId, storage);
  }
  return null;
}

function updateEntry(
  deviceUserId: string,
  tournamentId: string,
  change: (entry: HelperAccessEntry) => HelperAccessEntry,
  storage: HelperAccessStorage,
): boolean {
  const entry = findHelperAccessEntry(deviceUserId, tournamentId, storage);
  return entry ? upsertHelperAccessEntry(deviceUserId, change(entry), storage) : false;
}

/** @HE-097: Hinweis „Zum Startbildschirm hinzufügen“ weggeklickt – für dieses Turnier auf diesem Gerät nie wieder. */
export function setHomeHintDismissed(deviceUserId: string, tournamentId: string, storage: HelperAccessStorage = defaultStorage): boolean {
  return updateEntry(deviceUserId, tournamentId, (e) => ({ ...e, homeHintDismissed: true }), storage);
}

/** @HE-028: Spielplan und Feld liegen auf dem Gerät („Offline bereit“). */
export function setOfflineReady(
  deviceUserId: string,
  tournamentId: string,
  storage: HelperAccessStorage = defaultStorage,
  now: Date = new Date(),
): boolean {
  return updateEntry(deviceUserId, tournamentId, (e) => ({ ...e, offlineReadyAt: now.toISOString() }), storage);
}
