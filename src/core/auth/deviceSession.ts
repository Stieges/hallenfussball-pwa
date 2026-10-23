/**
 * Gerätesitzung für Helfer ohne Konto (Plan GA5 v2.1 R-GA5-1, R-GA5-9; Sicherheits-Review S-5).
 *
 * - Ein Helfer-Zugang ist eine anonyme Supabase-Sitzung auf dem Gerät (Token im `localStorage`, auth-js). Es entsteht nie
 *   ein Konto (@HE-079): hier gibt es nur `signInAnonymously`, nie `signUp`/`updateUser`.
 * - Besteht schon eine Gerätesitzung, wird sie weiterverwendet (@HE-074, @HE-095): kein zweites `signInAnonymously`, auch
 *   nicht, wenn zwei Aufrufe gleichzeitig laufen.
 * - Ist ein Konto angemeldet, legt diese Funktion nie eine Gerätesitzung an (`accountSession`); das Abmelden nach
 *   Rückfrage (@HE-089) macht der Beitrittsablauf vorher über `logout({ scope: 'local' })`.
 * - S-5: erst beim Absenden des Namens aufrufen, nie beim Scannen oder Anzeigen (`join_code_info` geht ohne Sitzung).
 * - Ohne Netz entsteht keine neue Sitzung: Scheitert das Auffrischen einer vorhandenen Sitzung am Netz, bleibt sie
 *   erhalten (`network`), statt durch eine neue Geräte-Identität ersetzt zu werden.
 *
 * Die Funktionen nehmen nur den Auth-Teil des Clients entgegen (`supabase.auth`), damit `core` ohne `lib/` testbar bleibt.
 */
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';

/** Der Teil einer Sitzung, den der Helfer-Ablauf braucht (strukturell kompatibel zu auth-js `Session`). */
export interface DeviceSessionLike {
  user: { id: string; is_anonymous?: boolean };
}

/** Der Teil von `supabase.auth`, den die Gerätesitzung braucht. */
export interface DeviceSessionAuth {
  getSession(): Promise<{ data: { session: DeviceSessionLike | null }; error: unknown }>;
  signInAnonymously(): Promise<{ data: { session: DeviceSessionLike | null }; error: unknown }>;
}

/**
 * `none` = keine Sitzung, `device` = anonyme Gerätesitzung, `account` = echtes Konto, `unknown` = Sitzung nicht lesbar
 * (ohne Netz beim Auffrischen eines abgelaufenen Zugangs oder Lesefehler). `unknown` heißt nie „keine Sitzung“: das
 * Token kann noch da sein, also nichts verwerfen und nichts neu anlegen (Review #331 M-2, @HE-028, @HE-074).
 */
export type SessionKind = 'none' | 'device' | 'account' | 'unknown';

export interface SessionInfo {
  kind: SessionKind;
  userId: string | null;
}

export type DeviceSessionFailure = 'accountSession' | 'network' | 'rateLimited' | 'unavailable' | 'unexpected';

export type DeviceSessionResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; reason: DeviceSessionFailure; message?: string };

export function sessionKind(session: DeviceSessionLike | null): Exclude<SessionKind, 'unknown'> {
  if (!session) {
    return 'none';
  }
  return session.user.is_anonymous === true ? 'device' : 'account';
}

/** Netzfehler (keine HTTP-Antwort): auth-js meldet ihn als `AuthRetryableFetchError`, `fetch` selbst wirft `TypeError`. */
function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError || isAuthRetryableFetchError(error);
}

function classifySignInError(error: unknown): { ok: false; reason: DeviceSessionFailure; message?: string } {
  if (isNetworkError(error)) {
    return { ok: false, reason: 'network' };
  }
  // § 3.2 „Auth 429“: anonyme Anmeldungen je IP und Stunde ausgeschöpft.
  if (isAuthApiError(error) && error.status === 429) {
    return { ok: false, reason: 'rateLimited' };
  }
  return { ok: false, reason: 'unexpected', message: error instanceof Error ? error.message : String(error) };
}

/**
 * Liest die Sitzung dieses Geräts, legt nie eine an. Netzfehler beim Auffrischen oder ein geworfener Fehler → `unknown`;
 * lehnt der Server den Zugang ab (auth-js hat die Sitzung dann entfernt) → `none`.
 */
export async function readSessionInfo(auth: DeviceSessionAuth | null): Promise<SessionInfo> {
  if (!auth) {
    return { kind: 'none', userId: null };
  }
  try {
    const { data, error } = await auth.getSession();
    if (data.session) {
      return { kind: sessionKind(data.session), userId: data.session.user.id };
    }
    return { kind: error && isNetworkError(error) ? 'unknown' : 'none', userId: null };
  } catch {
    return { kind: 'unknown', userId: null };
  }
}

async function ensureOnce(auth: DeviceSessionAuth): Promise<DeviceSessionResult> {
  let current: DeviceSessionLike | null;
  try {
    const { data, error } = await auth.getSession();
    if (error && isNetworkError(error)) {
      return { ok: false, reason: 'network' };
    }
    current = data.session;
  } catch (error) {
    return classifySignInError(error);
  }

  const kind = sessionKind(current);
  if (current && kind === 'device') {
    return { ok: true, userId: current.user.id, created: false };
  }
  if (kind === 'account') {
    return { ok: false, reason: 'accountSession' };
  }

  try {
    const { data, error } = await auth.signInAnonymously();
    if (error) {
      return classifySignInError(error);
    }
    if (!data.session) {
      return { ok: false, reason: 'unexpected', message: 'signInAnonymously ohne Sitzung' };
    }
    return { ok: true, userId: data.session.user.id, created: true };
  } catch (error) {
    return classifySignInError(error);
  }
}

const inFlight = new WeakMap<DeviceSessionAuth, Promise<DeviceSessionResult>>();

/**
 * Sorgt für eine Gerätesitzung und liefert deren Nutzer-ID. Gleichzeitige Aufrufe teilen sich einen Lauf, damit ein
 * Doppeltipp nie zwei anonyme Nutzer anlegt.
 */
export function ensureDeviceSession(auth: DeviceSessionAuth | null): Promise<DeviceSessionResult> {
  if (!auth) {
    return Promise.resolve({ ok: false, reason: 'unavailable' });
  }
  const running = inFlight.get(auth);
  if (running) {
    return running;
  }
  const run = ensureOnce(auth).finally(() => inFlight.delete(auth));
  inFlight.set(auth, run);
  return run;
}
