// =============================================================================
// Error Hierarchy
// =============================================================================

/**
 * Base error class for application errors.
 * Provides feature/action tagging for Sentry integration via captureFeatureError().
 */
export class AppError extends Error {
  public readonly feature: string;
  public readonly action?: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    feature: string,
    action?: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.feature = feature;
    this.action = action;
    this.context = context;
  }
}

/**
 * Error for repository/data-access operations.
 * Wraps Supabase errors (which are plain objects, not Error instances).
 */
export class RepositoryError extends AppError {
  public readonly operation: string;
  public readonly originalError?: unknown;

  constructor(operation: string, message: string, originalError?: unknown) {
    super(message, 'repository', operation, originalError !== null && originalError !== undefined ? { originalError: String(originalError) } : undefined);
    this.name = 'RepositoryError';
    this.operation = operation;
    this.originalError = originalError;
  }
}

/**
 * GA4 A-13b-C (R-GA4v2-8, Review-Auflage 2): der Server hat eine Verklemmung (`40P01`) oder eine Sperr-Wartezeit (`55P03`)
 * gemeldet. Nichts wurde geschrieben; ein neuer Versuch ist erlaubt. Die Oberfläche sagt „Bitte erneut versuchen“,
 * nie stiller Fehlschlag.
 */
export class RetryLaterError extends AppError {
  public readonly sqlState: '40P01' | '55P03';

  constructor(operation: string, sqlState: '40P01' | '55P03') {
    super(`${operation}: Server gerade belegt (${sqlState}), bitte erneut versuchen`, 'repository', operation, { sqlState });
    this.name = 'RetryLaterError';
    this.sqlState = sqlState;
  }
}

/**
 * Eine empfangene Antwort lässt sich nicht in die Turnierform abbilden (B-19b, @ME-032). Unterklasse von
 * RepositoryError (Vertrag: fehlerhafte Zeile scheitert als RepositoryError), wird nur beim Abbilden geworfen –
 * nicht bei Netz- oder Abfragefehlern.
 */
export class UnreadableResponseError extends RepositoryError {
  constructor(operation: string, originalError?: unknown) {
    const original = originalError instanceof Error ? originalError.message : String(originalError);
    super(operation, `Antwort nicht lesbar: ${original}`, originalError);
    this.name = 'UnreadableResponseError';
  }
}

/**
 * Error for authentication failures.
 */
export class AuthenticationError extends AppError {
  constructor(message: string, action?: string) {
    super(message, 'auth', action);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error for network/connectivity failures.
 */
export class NetworkError extends AppError {
  public readonly isOffline: boolean;

  constructor(message: string, isOffline = false) {
    super(message, 'network', undefined, { isOffline });
    this.name = 'NetworkError';
    this.isOffline = isOffline;
  }
}

/**
 * Error for sync/mutation-queue failures.
 */
export class SyncError extends AppError {
  public readonly tournamentId?: string;

  constructor(message: string, tournamentId?: string) {
    super(message, 'sync', undefined, tournamentId ? { tournamentId } : undefined);
    this.name = 'SyncError';
    this.tournamentId = tournamentId;
  }
}

/**
 * A-07b Fixrunde 1 (@FU-006): `supabase.auth.getSession()` hat geworfen (lokaler Sitzungsspeicher
 * nicht lesbar). Vorübergehend: die Mutation zählt nicht als Fehlversuch, sie bleibt stehen und
 * der nächste Durchgang versucht es erneut. Klassifiziert in `isTransientMutationError`.
 */
export class SessionReadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SessionReadError';
  }
}

/**
 * I1 (task-C3b2-review.md, PC29-Fixrunde F1): thrown by the mutation-queue guest guard
 * (`MutationQueue.ts` SAVE_TOURNAMENT/UPDATE_MATCH/UPDATE_MATCHES/
 * UPDATE_TOURNAMENT_METADATA/DELETE_TOURNAMENT) when reading the local guest-engine
 * store or the local tournament fails. MUST be classified as PERMANENT by
 * `isTransientMutationError` (checked at the very top, before `isAbortError`) —
 * otherwise a raw IndexedDB `AbortError`/`DOMException` reaching that check would be
 * "transient" in a real browser (`DOMException instanceof Error` is `true` there,
 * unlike vitest/jsdom, where it is `false` — see review I1 realm probe). A fixed
 * message (never the wrapped error's own text) is the second line of defence: even if
 * someone later reads `.message` instead of checking `instanceof`, it will not contain
 * an "aborted"/"timeout"/"fetch" substring. `cause` is kept for diagnostics only, never
 * read for classification.
 */
export class GuestStoreReadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GuestStoreReadError';
  }
}

// =============================================================================
// OptimisticLockError (existing, unchanged)
// =============================================================================

/**
 * Error thrown when an optimistic locking conflict occurs.
 * This happens when trying to save a version of data that is older than what is on the server.
 *
 * Supports two use cases:
 * 1. Match-level conflicts: new OptimisticLockError(matchId, expectedVersion, actualVersion)
 * 2. General conflicts: new OptimisticLockError('Custom message')
 *
 * For match conflicts, contains rich context for debugging and UI feedback:
 * - matchId: Which match had the conflict
 * - expectedVersion: The version we tried to save
 * - actualVersion: The current version in the database
 */
export class OptimisticLockError extends Error {
  public readonly matchId?: string;
  public readonly expectedVersion?: number;
  public readonly actualVersion?: number;

  /**
   * Create an OptimisticLockError.
   *
   * @param matchIdOrMessage - Either matchId (for match conflicts) or a custom error message
   * @param expectedVersion - Optional: The version we tried to save
   * @param actualVersion - Optional: The current version in the database
   */
  constructor(matchIdOrMessage: string, expectedVersion?: number, actualVersion?: number) {
    // If version parameters are provided, this is a match-level conflict
    if (expectedVersion !== undefined && actualVersion !== undefined) {
      super(
        `Optimistic lock failed: Match ${matchIdOrMessage} was modified ` +
          `(expected v${expectedVersion}, got v${actualVersion})`
      );
      this.matchId = matchIdOrMessage;
      this.expectedVersion = expectedVersion;
      this.actualVersion = actualVersion;
    } else {
      // General conflict with custom message
      super(matchIdOrMessage);
      this.matchId = undefined;
      this.expectedVersion = undefined;
      this.actualVersion = undefined;
    }
    this.name = 'OptimisticLockError';
  }

  /**
   * Check if this is a match-level conflict with rich context
   */
  isMatchConflict(): boolean {
    return this.matchId !== undefined;
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Message patterns that mark a mutation-queue error as a transient network
 * failure. Kept as an explicit list (not just a generic /fetch/i) because the
 * real error text reaching `isTransientMutationError` differs per browser —
 * verified against `@supabase/postgrest-js`'s actual (non-throwing) error
 * shape, see the function doc below:
 * - Chrome:  "TypeError: Failed to fetch"
 * - Firefox: "TypeError: NetworkError when attempting to fetch resource."
 * - Safari/iOS: "TypeError: Load failed" — the iPad/iPhone cockpit wording,
 *   the actual target hardware for the captive-portal case this exists for.
 */
const TRANSIENT_NETWORK_MESSAGE_PATTERNS = [
  /fetch/i,
  /networkerror/i,
  /network error/i,
  /load failed/i,
  /timeout/i,
];

/**
 * Classifies an error thrown by a mutation-queue `execute()` call as
 * transient (should NOT count as a failed attempt — the item stays at the
 * head of the queue and is retried on the next process() call, without
 * touching retryCount) or permanent (counts as before, unchanged).
 *
 * Task A3 (minimal, see task-A3-brief.md): behind a captive portal (e.g. a
 * hall Wi-Fi login page), `navigator.onLine` reports true but every request
 * fails with a network error — those must not be counted as failed
 * attempts, or the queue silently dead-letters entries after MAX_RETRIES.
 *
 * IMPORTANT — the real error shape is NOT a raw thrown `TypeError`.
 * `SupabaseRepository` never calls `.throwOnError()`, so `postgrest-js`
 * catches a failing `fetch()` itself and returns a plain object
 * `{ message: "TypeError: <reason>", details, hint, code: '' }` with NO
 * `.name` field and NO `.status`. `SupabaseRepository` then wraps that as
 * `new RepositoryError(op, error.message, error)` — or, for
 * `updateMatch(es)` (the live-cockpit write path), one level deeper:
 * `errors.push(new Error(\`Match ${id}: ${error.message}\`))`, then
 * `new RepositoryError('updateMatches', errors.map(e => e.message).join('; '),
 * errors)`, where `originalError` is an ARRAY of `Error`, not a single
 * object. The message text (a substring of the original `${name}: ${message}`
 * postgrest built) is the one signal that survives every layer of wrapping —
 * classification here is deliberately message-first, and walks into
 * `originalError` whether it is a single object or an array, for cases where
 * the message alone was not propagated.
 *
 * Transient: network failures (fetch/TypeError, "Failed to fetch",
 * "NetworkError when attempting to fetch resource" (Firefox), "Load failed"
 * (Safari/iOS)), timeouts/aborts, HTTP 408, 429, 5xx.
 * A-06a (Brief A1): additionally `name === 'TimeoutError'` (e.g. from
 * `createRequestTimeoutError`) and `code === 23` (numeric DOMException TIMEOUT_ERR).
 * Permanent (default — everything not positively recognised as transient):
 * RLS/403, other 4xx, Postgres error codes (23xxx, P0001, 22P02),
 * OptimisticLockError, etc. — exactly today's behaviour.
 *
 * Known gap (see task-A3-report.md „Bedenken"): `PostgrestError` never
 * carries an HTTP status (neither in the throw nor the non-throw path), and
 * `SupabaseRepository` does not copy one onto the errors it wraps. The
 * 408/429/5xx branch below is therefore unreachable today against a real
 * Supabase response — it only fires for a `status`/`statusCode` an `execute()`
 * caller sets explicitly (e.g. in tests, or a future caller).
 */
export function isTransientMutationError(error: unknown): boolean {
  // I1: must be the FIRST check — a GuestStoreReadError wraps an IndexedDB read
  // failure that, in a real browser, IS `instanceof Error`/`DOMException` and can
  // carry an "aborted"/"timeout" message; checking the class before any message-based
  // pattern (`isAbortError`, TRANSIENT_NETWORK_MESSAGE_PATTERNS below) closes that gap.
  if (error instanceof GuestStoreReadError) {
    return false;
  }
  if (error instanceof SessionReadError) {
    return true;
  }
  if (error instanceof OptimisticLockError) {
    return false;
  }
  if (error instanceof TeamStillReferencedError || isOriginImmutableError(error)) {
    return false;
  }
  if (error && typeof error === 'object' && [KIT_COLUMNS_SERVER_ONLY_CODE, SCHEDULE_TIME_REJECTED_CODE].includes(String((error as { code?: unknown }).code))) {
    return false;
  }
  if (isAbortError(error)) {
    return true;
  }
  // A-06a (Brief A1): `name === 'TimeoutError'` (AbortSignal-Zeitlimit) bzw. `code === 23`
  // (DOMException TIMEOUT_ERR, nur als Zahl — strikt, sonst zählte `code: '23505'` mit) sind
  // vorübergehend. `isAbortError` bleibt unangetastet (auch zum Stummschalten bei Navigation).
  if (error && typeof error === 'object') {
    const timeoutLike = error as { name?: unknown; code?: unknown };
    if (timeoutLike.name === 'TimeoutError' || timeoutLike.code === 23) {
      return true;
    }
  }
  if (Array.isArray(error)) {
    // SupabaseRepository.updateMatches wraps per-match failures as
    // RepositoryError(..., errors: Error[]) — transient if ANY entry is.
    return error.some((e) => isTransientMutationError(e));
  }
  if (!error || typeof error !== 'object') {
    return false;
  }

  const e = error as {
    name?: string;
    message?: string;
    status?: number;
    statusCode?: number;
    originalError?: unknown;
  };

  // A-Final-Fix 2 (final-review-A.md, Important 2): `e.name === 'TypeError'` used to count as
  // transient on its own, regardless of the message -- but a real programming error (e.g.
  // `TypeError: Cannot read properties of undefined (...)` from a stale/corrupted persisted
  // payload) is ALSO a `TypeError`, and that made the mutation queue retry it forever instead
  // of moving it to the dead-letter list after MAX_RETRIES (GenericMutationQueue.ts). Every
  // known browser network `TypeError` message (Chrome "Failed to fetch", Firefox "NetworkError
  // when attempting to fetch resource", Safari "Load failed" -- see the A3 tests above/below)
  // already matches one of `TRANSIENT_NETWORK_MESSAGE_PATTERNS`, so the separate `name` check
  // was redundant for the case it was meant to catch, and harmful for every other `TypeError`.
  const message = e.message ?? '';
  if (TRANSIENT_NETWORK_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }

  const status = e.status ?? e.statusCode;
  if (typeof status === 'number' && (status === 408 || status === 429 || (status >= 500 && status < 600))) {
    return true;
  }

  // RepositoryError wraps the raw Supabase/Postgrest error (or an array of
  // per-item Errors, for updateMatch/updateMatches) in originalError — the
  // transient signal may live there instead of on the wrapper's own message.
  if (e.originalError && typeof e.originalError === 'object' && e.originalError !== error) {
    return isTransientMutationError(e.originalError);
  }

  return false;
}

/**
 * @FU-106 (Befund C-VERWERFEN-BEHAELT-VERALTETEN-STAND): Hat der Server eine Änderung abgelehnt, weil ein anderes Gerät das
 * Turnier inzwischen geändert hat (Versionsprüfung)? Auch eingepackt in `RepositoryError` (`updateMatches`: Liste).
 */
export function isVersionConflict(error: unknown): boolean {
  if (error instanceof OptimisticLockError) {
    return true;
  }
  if (!(error instanceof RepositoryError)) {
    return false;
  }
  const inner = error.originalError;
  return Array.isArray(inner) ? inner.some((e) => e instanceof OptimisticLockError) : inner instanceof OptimisticLockError;
}

/**
 * BP-1 (Befund C-ENDGUELTIG-SOFORT-MELDEN, @FU-126): Grund einer eindeutig endgültigen Ablehnung durch den Server.
 * - `conflict`: Versionsprüfung (ein anderes Gerät hat inzwischen gespeichert)
 * - `invalidValue`: ungültiger Wert – Postgres-Klasse 22 (Datenfehler) und 23 (Integrität), eigene Codes HF002/HF003/HF005,
 *   Team noch von einem Spiel referenziert
 * - `tournamentGone`: das Turnier gibt es in der Cloud nicht mehr (`TournamentGoneError`)
 * `null`: unklar (z. B. 42501 Rechte, Netz, unbekannte Codes) – die Warteschlange wiederholt wie bisher.
 */
export type DefinitiveRejectionReason = 'conflict' | 'invalidValue' | 'tournamentGone';

/**
 * BP-1 (Befund C-WARTESCHLANGE-LEGT-GELOESCHTES-NEU-AN, @FU-123): Das Gerät kennt das Turnier aus der Cloud, dort gibt es
 * die Zeile aber nicht mehr (endgültig gelöscht oder nicht mehr sichtbar). `save()` legt es dann nicht neu an.
 */
export class TournamentGoneError extends Error {
  public readonly tournamentId: string;

  constructor(tournamentId: string) {
    super(`Turnier ${tournamentId} gibt es in der Cloud nicht mehr – nicht neu angelegt`);
    this.name = 'TournamentGoneError';
    this.tournamentId = tournamentId;
  }
}

/** Postgres-Fehlerklassen 22 (data exception) und 23 (integrity constraint violation), fünfstellige SQLSTATE. */
const INVALID_VALUE_SQLSTATE = /^2[23][0-9A-Z]{3}$/;

function carriesInvalidValueCode(candidate: unknown): boolean {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  const code = (candidate as { code?: unknown }).code;
  return typeof code === 'string' && (INVALID_VALUE_SQLSTATE.test(code) || code === ORIGIN_IMMUTABLE_CODE || code === KIT_COLUMNS_SERVER_ONLY_CODE
    || code === SCHEDULE_TIME_REJECTED_CODE);
}

function isInvalidValueRejection(error: unknown): boolean {
  if (error instanceof TeamStillReferencedError || error instanceof OriginImmutableError || carriesInvalidValueCode(error)) {
    return true;
  }
  if (error instanceof RepositoryError) {
    const inner = error.originalError;
    return Array.isArray(inner) ? inner.some(isInvalidValueRejection) : isInvalidValueRejection(inner);
  }
  return false;
}

/**
 * Einhängepunkt für eindeutig endgültige Ablehnungen (@FU-126): die Warteschlange meldet sie beim ersten Versuch als
 * „nicht übernommen“ mit Grund und wiederholt sie nicht. Weitere eindeutige Gründe (z. B. A-21a-C1: `55000`
 * TOURNAMENT_FINISHED) werden hier ergänzt.
 */
export function definitiveRejectionReason(error: unknown): DefinitiveRejectionReason | null {
  if (isVersionConflict(error)) {
    return 'conflict';
  }
  if (error instanceof TournamentGoneError) {
    return 'tournamentGone';
  }
  return isInvalidValueRejection(error) ? 'invalidValue' : null;
}

export function isDefinitiveRejection(error: unknown): boolean {
  return definitiveRejectionReason(error) !== null;
}

/**
 * Befund C-VERWERFEN-MERKUNG-BEI-ABBRUCH (@FU-109): ein Cloud-Abruf wurde abgebrochen (Navigation, Signal). Anders als
 * „nicht gefunden“ sagt er nichts über das Turnier am Server – `getWithMatchRevisions` wirft ihn statt `null`.
 * `isAbortError` erkennt ihn (Name `AbortError`).
 */
export class CloudReadAbortedError extends Error {
  constructor(public readonly originalError?: unknown) {
    super('Cloud-Abruf abgebrochen (aborted)');
    this.name = 'AbortError';
  }
}

/**
 * Checks if an error is an AbortError (expected during navigation, StrictMode, unmount).
 * Consolidated from 3 duplicate implementations across the codebase.
 *
 * Handles:
 * - Standard AbortError (name === 'AbortError')
 * - DOMException abort (code 20)
 * - Message-based detection ('aborted', 'AbortError', 'Cloud fetch timeout')
 */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const e = error as { name?: string; message?: string; code?: string | number };
  return (
    e.name === 'AbortError' ||
    (e.message?.includes('AbortError') ?? false) ||
    (e.message?.includes('aborted') ?? false) ||
    (e.message?.includes('Cloud fetch timeout') ?? false) ||
    e.code === '20' ||
    e.code === 20
  );
}

// =============================================================================
// TeamStillReferencedError (A-05 Fixrunde 1, @FU-086)
// =============================================================================

/**
 * `SupabaseRepository.save()`: Ein zu speicherndes Spiel zeigt noch auf ein Team, das mit demselben
 * Speichern gelöscht würde. Nicht wiederholbar (nicht transient): der Fehler liegt im Stand, nicht im
 * Netz. Wird vor dem ersten Schreiben geworfen, es bleibt also nichts halb geschrieben.
 */
export class TeamStillReferencedError extends Error {
  public readonly matchId: string;

  constructor(matchId: string) {
    super(`Spiel ${matchId} zeigt noch auf ein Team, das gelöscht würde – Speichern abgebrochen, nichts geschrieben`);
    this.name = 'TeamStillReferencedError';
    this.matchId = matchId;
  }
}

// =============================================================================
// OriginImmutableError (A-36a, Fehlercode HF002)
// =============================================================================

/**
 * Eigene Fehlercodes der Datenbank (SQLSTATE-Klasse `HF`, ausserhalb des PostgREST-Namensraums `PT`):
 * - HF001 – Freigabe vor Veröffentlichung (`make_tournament_public`, `enforce_release_before_public`)
 * - HF002 – Herkunft eines Platzes unveränderlich (Trigger `matches_keep_origin`, A-36a)
 * - HF003 – getragene Farben setzt nur der Anpfiff (Trigger `matches_guard_kit_columns`, A-30a)
 * - HF004 – `change_revision` schreibt nur der Server (Trigger `tournaments_guard_change_revision`, A-10)
 * - HF005 – Uhrzeit nicht angenommen: Spiel angepfiffen oder beendet, oder Vorziehen in die Vergangenheit
 *   (Trigger `matches_guard_schedule_times`, R8)
 */
export const ORIGIN_IMMUTABLE_CODE = 'HF002';

/** A-30a: Client-Schreiben auf `kit_color_a/kit_color_b/bib_side` – nicht transient (Fehler im Stand, nicht im Netz). */
export const KIT_COLUMNS_SERVER_ONLY_CODE = 'HF003';

/**
 * R8 (@ZP-016, @ZP-057): Der Server nimmt eine Uhrzeit nicht an (Spiel angepfiffen/beendet oder Vorziehen in die
 * Vergangenheit). Eindeutig endgültig: die Warteschlange meldet „nicht übernommen“ und wiederholt nicht.
 */
export const SCHEDULE_TIME_REJECTED_CODE = 'HF005';

/** Postgrest-Fehler mit Code HF005 (Uhrzeit nicht angenommen). */
export function isScheduleTimeRejected(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === SCHEDULE_TIME_REJECTED_CODE;
}

/**
 * Ein Schreiben wollte `origin_a/origin_b` eines Spiels ändern. Nicht transient: der Fehler liegt im Stand,
 * die Warteschlange legt den Eintrag nach MAX_RETRIES im Dead-Letter ab, statt ihn endlos zu wiederholen.
 */
export class OriginImmutableError extends Error {
  public readonly matchId: string;

  constructor(matchId: string) {
    super(`Spiel ${matchId}: Herkunft des Platzes ist unveränderlich (${ORIGIN_IMMUTABLE_CODE}), nichts geschrieben`);
    this.name = 'OriginImmutableError';
    this.matchId = matchId;
  }
}

/** `OriginImmutableError` oder ein Postgrest-Fehler mit Code HF002. */
export function isOriginImmutableError(error: unknown): boolean {
  if (error instanceof OriginImmutableError) {
    return true;
  }
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === ORIGIN_IMMUTABLE_CODE;
}

/** Postgrest-Fehler eines Spiels → `OriginImmutableError` bei HF002, sonst `undefined`. */
export function toOriginImmutableError(matchId: string, error: unknown): OriginImmutableError | undefined {
  return isOriginImmutableError(error) ? new OriginImmutableError(matchId) : undefined;
}

// =============================================================================
// MatchAwaitingTeamsError (A-03, @TM-033)
// =============================================================================

/**
 * Ein Spiel lässt sich nicht anpfeifen, solange eine Seite noch offen ist (Slot `pending`) oder
 * der Slot fehlt. Trägt die offenen Seiten, damit die Anzeige den Wartegrund nennen kann
 * (Herkunft über `slotLabel`).
 */
export class MatchAwaitingTeamsError extends Error {
  public readonly matchId: string;
  /** Seiten (`'A'` = Heim), die noch kein Team haben. */
  public readonly openSides: readonly ('A' | 'B')[];

  constructor(matchId: string, openSides: readonly ('A' | 'B')[]) {
    super(`Spiel ${matchId}: Seite ${openSides.join(' und ')} ist noch nicht besetzt`);
    this.name = 'MatchAwaitingTeamsError';
    this.matchId = matchId;
    this.openSides = openSides;
  }
}

// =============================================================================
// MatchNotOnEngineError (A-08a, @FU-069)
// =============================================================================

/**
 * Grund, warum ein Spiel NICHT über die Engine geleitet werden kann:
 * - `resultEntered`: Spielstand liegt schon vor (Schnelleingabe/Altbestand) -> Hinweis, keine Leitung
 * - `skipped`: Spiel ist abgesetzt
 * - `other`: sonstige Engine-Wartezeit (Anzeige wie "Spiel wird vorbereitet")
 */
export type MatchNotOnEngineReason = 'resultEntered' | 'skipped' | 'other';

/**
 * Das Cockpit hat für dieses Spiel keine Engine-Ansicht und es gibt keinen Altweg mehr (A-08a).
 * Trägt nur den Grund, nie Spiel-IDs oder Teamnamen (Anzeige übersetzt den Grund).
 */
export class MatchNotOnEngineError extends Error {
  public readonly reason: MatchNotOnEngineReason;

  constructor(reason: MatchNotOnEngineReason) {
    super(`Spiel ist nicht über die Engine leitbar (${reason})`);
    this.name = 'MatchNotOnEngineError';
    this.reason = reason;
  }
}
