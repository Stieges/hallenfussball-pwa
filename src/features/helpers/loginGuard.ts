/**
 * Anmelden mit einem Konto auf einem Gerät mit Helfer-Zugang (@HE-094, Plan GA5 v2.1 A-17a Logik; Oberfläche A-17c/B-30 I-6).
 *
 * Reihenfolge (Review #331 H-2):
 * 1. Gerätesitzung mit wartenden Einträgen → nicht anmelden, „Erst verbinden – N Einträge warten“ – unabhängig vom Index.
 * 2. Zählung oder Sitzung nicht lesbar auf einem (möglichen) Helfer-Gerät → ebenfalls nicht anmelden, ohne Zahl.
 *    Fail-closed, weil eine anonyme Gerätesitzung nach dem Anmelden eines Kontos nicht zurückkommt: ihr Ausgang ist an
 *    ihre Nutzer-ID gebunden, wartende Einträge wären endgültig verloren (@HE-094 „Aber …“, @FU-006). Anders beim
 *    Abmelden eines Kontos (`useGuardedLogout`): dort kommt das Konto wieder, deshalb zählt ein Fehler dort als 0.
 * 3. Helfer-Zugang im Index (zugelassen, nur zusehen, Anfrage offen) → Rückfrage „Auf diesem Gerät bist du Helfer im
 *    <Turnier>. Anmelden beendet den Helfer-Zugang auf diesem Gerät. Weiter?“
 * 4. Sonst anmelden ohne Rückfrage.
 * Nach der Anmeldung des Kontos wird der Zugangs-Index geleert (§ 3.2); das Gerätetoken ersetzt auth-js beim Anmelden.
 */
import type { HelperAccessEntry, HelperAccessIndexV1 } from '../../core/repositories/helperAccessRpc';
import type { SessionInfo } from '../../core/auth/deviceSession';
import {
  clearHelperAccessIndex,
  hasStoredHelperAccessIndex,
  readHelperAccessIndex,
  type HelperAccessStorage,
} from './helperAccessStore';

export type LoginGuardDecision =
  | { kind: 'proceed' }
  | { kind: 'confirm'; tournamentTitles: string[] }
  /** `waitingCount: null` = nicht zählbar (Lesefehler): „Erst verbinden – Einträge warten“ ohne Zahl. */
  | { kind: 'blocked'; waitingCount: number | null };

/** Beziehungen, bei denen das Gerät durch das Anmelden etwas verliert. */
const ACTIVE_RELATIONS: ReadonlySet<HelperAccessEntry['relation']> = new Set(['accepted', 'viewer', 'pending']);

/** `waitingCount`: wartende Einträge der Gerätesitzung, `null` = Zählung gescheitert. */
export function decideLogin(session: SessionInfo, index: HelperAccessIndexV1 | null, waitingCount: number | null): LoginGuardDecision {
  if (session.kind !== 'device') {
    return { kind: 'proceed' };
  }
  if (waitingCount !== 0) {
    return { kind: 'blocked', waitingCount };
  }
  const titles = (index?.entries ?? []).filter((e) => ACTIVE_RELATIONS.has(e.relation)).map((e) => e.title);
  return titles.length > 0 ? { kind: 'confirm', tournamentTitles: titles } : { kind: 'proceed' };
}

export interface LoginGuardDeps {
  readSession(): Promise<SessionInfo>;
  /** Wartende Einträge der Gerätesitzung (`countWaitingBeforeSignOut` mit der Geräte-Nutzer-ID). */
  countWaiting(deviceUserId: string): Promise<number>;
  storage?: HelperAccessStorage;
}

/** Vor dem Absenden der Zugangsdaten aufrufen. */
export async function checkLoginOnHelperDevice(deps: LoginGuardDeps): Promise<LoginGuardDecision> {
  const session = await deps.readSession();
  if (session.kind === 'unknown') {
    // Sitzung nicht lesbar (meist ohne Netz): Liegt ein Helfer-Index auf dem Gerät, kann es eine Gerätesitzung mit
    // wartenden Einträgen sein → sperren. Ohne Index ist es kein Helfer-Gerät.
    return hasStoredHelperAccessIndex(deps.storage) ? { kind: 'blocked', waitingCount: null } : { kind: 'proceed' };
  }
  if (session.kind !== 'device' || session.userId === null) {
    return { kind: 'proceed' };
  }
  const waitingCount = await deps.countWaiting(session.userId).catch(() => null);
  return decideLogin(session, readHelperAccessIndex(session.userId, deps.storage), waitingCount);
}

/** Nach erfolgreicher Anmeldung eines Kontos: Zugangs-Index leeren (§ 3.2). */
export function onAccountSignedIn(storage?: HelperAccessStorage): void {
  clearHelperAccessIndex(storage);
}
