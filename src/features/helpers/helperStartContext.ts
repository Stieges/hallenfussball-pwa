/**
 * Einträge für den Start auf einem Helfer-Gerät laden und frisch abgleichen (A-17c; @HE-096, @HE-098, @HE-028).
 *
 * - Sitzung `device`: Index der Sitzung lesen (`readHelperAccessIndex`).
 * - Sitzung `unknown` (ohne Netz, abgelaufenes Token): Index roh lesen und NICHT verwerfen – sonst verlöre die Halle ohne
 *   Netz den Weg ans Feld (@HE-028, Review #331 M-2).
 * - Frischabgleich: für Einträge, die sich ändern können (zugelassen, nur zusehen, offen), den Zugangsstatus holen, höchstens
 *   `timeoutMs` lang; scheitert er (kein Netz, Zeitüberschreitung), gilt der gespeicherte Eintrag (Halle ohne Netz).
 */
import type { SessionInfo } from '../../core/auth/deviceSession';
import { type HelperAccessEntry, type HelperAccessStatus, type HelperRpcResult } from '../../core/repositories/helperAccessRpc';
import { entryFromServer, peekHelperAccessIndex, readHelperAccessIndex, syncHelperAccessEntry, type HelperAccessStorage } from './helperAccessStore';

export const START_REFRESH_TIMEOUT_MS = 2500;

export interface HelperStartContextDeps {
  readSession(): Promise<SessionInfo>;
  fetchStatus(tournamentId: string): Promise<HelperRpcResult<HelperAccessStatus>>;
  storage?: HelperAccessStorage;
  timeoutMs?: number;
}

export interface HelperStartContext {
  session: SessionInfo;
  entries: HelperAccessEntry[];
}

const CHANGEABLE: ReadonlySet<HelperAccessEntry['relation']> = new Set(['accepted', 'viewer', 'pending']);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(null); },
    );
  });
}

async function refreshEntry(entry: HelperAccessEntry, session: SessionInfo, deps: HelperStartContextDeps): Promise<HelperAccessEntry | null> {
  if (!CHANGEABLE.has(entry.relation)) {
    return entry;
  }
  const response = await withTimeout(deps.fetchStatus(entry.tournamentId), deps.timeoutMs ?? START_REFRESH_TIMEOUT_MS);
  if (!response?.ok) {
    return entry;
  }
  if (session.kind === 'device' && session.userId !== null) {
    // schreibt den neuen Stand in den Index; `null` = der Server kennt keine Anfrage dieses Geräts mehr
    return syncHelperAccessEntry(session.userId, entry.tournamentId, response.data, null, deps.storage);
  }
  return entryFromServer(response.data, null, entry);
}

export async function loadHelperStartContext(deps: HelperStartContextDeps): Promise<HelperStartContext> {
  const session = await deps.readSession();
  let stored: HelperAccessEntry[] = [];
  if (session.kind === 'device' && session.userId !== null) {
    stored = readHelperAccessIndex(session.userId, deps.storage)?.entries ?? [];
  } else if (session.kind === 'unknown') {
    stored = peekHelperAccessIndex(deps.storage)?.entries ?? [];
  }
  const refreshed = await Promise.all(stored.map((entry) => refreshEntry(entry, session, deps)));
  return { session, entries: refreshed.filter((entry): entry is HelperAccessEntry => entry !== null) };
}
