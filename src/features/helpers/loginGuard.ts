/**
 * Anmelden mit einem Konto auf einem Gerät mit Helfer-Zugang (@HE-094, Plan GA5 v2.1 A-17a Logik; Oberfläche A-17c/B-30 I-6).
 *
 * - Nur auf Geräten mit Helfer-Index (Gerätesitzung mit mindestens einem Eintrag); ein Gast ist kein Helfer-Gerät.
 * - Warten Helfer-Einträge dieses Geräts auf die Übertragung → nicht anmelden, „Erst verbinden – N Einträge warten“.
 * - Sonst, mit Helfer-Zugang (zugelassen, nur zusehen oder Anfrage offen) → Rückfrage „Auf diesem Gerät bist du Helfer im
 *   <Turnier>. Anmelden beendet den Helfer-Zugang auf diesem Gerät. Weiter?“
 * - Sonst anmelden ohne Rückfrage.
 * Nach der Anmeldung des Kontos wird der Zugangs-Index geleert (§ 3.2); das Gerätetoken ersetzt auth-js beim Anmelden.
 */
import type { HelperAccessEntry, HelperAccessIndexV1 } from '../../core/repositories/helperAccessRpc';
import type { SessionInfo } from '../../core/auth/deviceSession';
import { clearHelperAccessIndex, readHelperAccessIndex, type HelperAccessStorage } from './helperAccessStore';

export type LoginGuardDecision =
  | { kind: 'proceed' }
  | { kind: 'confirm'; tournamentTitles: string[] }
  | { kind: 'blocked'; waitingCount: number };

/** Beziehungen, bei denen das Gerät durch das Anmelden etwas verliert. */
const ACTIVE_RELATIONS: ReadonlySet<HelperAccessEntry['relation']> = new Set(['accepted', 'viewer', 'pending']);

export function decideLogin(session: SessionInfo, index: HelperAccessIndexV1 | null, waitingCount: number): LoginGuardDecision {
  // Kein Helfer-Gerät (kein Eintrag im Index dieser Gerätesitzung): die Regel greift nicht.
  const entries = index?.entries ?? [];
  if (session.kind !== 'device' || entries.length === 0) {
    return { kind: 'proceed' };
  }
  if (waitingCount > 0) {
    return { kind: 'blocked', waitingCount };
  }
  const titles = entries.filter((e) => ACTIVE_RELATIONS.has(e.relation)).map((e) => e.title);
  return titles.length > 0 ? { kind: 'confirm', tournamentTitles: titles } : { kind: 'proceed' };
}

export interface LoginGuardDeps {
  readSession(): Promise<SessionInfo>;
  /** Wartende Einträge der Gerätesitzung (`countWaitingBeforeSignOut` mit der Geräte-Nutzer-ID). */
  countWaiting(deviceUserId: string): Promise<number>;
  storage?: HelperAccessStorage;
}

/** Vor dem Absenden der Zugangsdaten aufrufen. Ein Zählfehler blockiert nicht (wie `useGuardedLogout`). */
export async function checkLoginOnHelperDevice(deps: LoginGuardDeps): Promise<LoginGuardDecision> {
  const session = await deps.readSession();
  if (session.kind !== 'device' || session.userId === null) {
    return { kind: 'proceed' };
  }
  const index = readHelperAccessIndex(session.userId, deps.storage);
  const waitingCount = await deps.countWaiting(session.userId).catch(() => 0);
  return decideLogin(session, index, waitingCount);
}

/** Nach erfolgreicher Anmeldung eines Kontos: Zugangs-Index leeren (§ 3.2). */
export function onAccountSignedIn(storage?: HelperAccessStorage): void {
  clearHelperAccessIndex(storage);
}
