import { describe, it, expect } from 'vitest';
import {
  AppError,
  RepositoryError,
  AuthenticationError,
  NetworkError,
  SyncError,
  OptimisticLockError,
  isAbortError,
  isTransientMutationError,
} from './errors';

describe('Error Hierarchy', () => {
  it('AppError sets feature, action, context', () => {
    const err = new AppError('test', 'auth', 'login', { userId: '123' });
    expect(err.message).toBe('test');
    expect(err.feature).toBe('auth');
    expect(err.action).toBe('login');
    expect(err.context).toEqual({ userId: '123' });
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
  });

  it('RepositoryError stores operation and originalError', () => {
    const original = { code: 'PGRST116', message: 'Not found' };
    const err = new RepositoryError('get', 'Failed to fetch', original);
    expect(err.operation).toBe('get');
    expect(err.originalError).toBe(original);
    expect(err.feature).toBe('repository');
    expect(err.action).toBe('get');
    expect(err.name).toBe('RepositoryError');
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('RepositoryError without originalError has no context', () => {
    const err = new RepositoryError('save', 'Failed');
    expect(err.originalError).toBeUndefined();
    expect(err.context).toBeUndefined();
  });

  it('AuthenticationError tags feature=auth', () => {
    const err = new AuthenticationError('Not authenticated', 'save');
    expect(err.feature).toBe('auth');
    expect(err.action).toBe('save');
    expect(err.name).toBe('AuthenticationError');
    expect(err).toBeInstanceOf(AppError);
  });

  it('NetworkError stores isOffline flag', () => {
    const err = new NetworkError('No connection', true);
    expect(err.isOffline).toBe(true);
    expect(err.feature).toBe('network');
    expect(err.name).toBe('NetworkError');
  });

  it('SyncError stores tournamentId', () => {
    const err = new SyncError('Sync failed', 'abc-123');
    expect(err.tournamentId).toBe('abc-123');
    expect(err.feature).toBe('sync');
    expect(err.context).toEqual({ tournamentId: 'abc-123' });
  });

  it('OptimisticLockError match conflict', () => {
    const err = new OptimisticLockError('match-1', 1, 2);
    expect(err.matchId).toBe('match-1');
    expect(err.expectedVersion).toBe(1);
    expect(err.actualVersion).toBe(2);
    expect(err.isMatchConflict()).toBe(true);
    expect(err.name).toBe('OptimisticLockError');
  });
});

describe('isAbortError', () => {
  it('detects AbortError by name', () => {
    const err = new DOMException('The operation was aborted', 'AbortError');
    expect(isAbortError(err)).toBe(true);
  });

  it('detects abort by message containing "aborted"', () => {
    expect(isAbortError(new Error('signal is aborted without reason'))).toBe(true);
  });

  it('detects abort by message containing "AbortError"', () => {
    expect(isAbortError({ message: 'AbortError: signal aborted' })).toBe(true);
  });

  it('detects Cloud fetch timeout', () => {
    expect(isAbortError(new Error('Cloud fetch timeout'))).toBe(true);
  });

  it('detects DOMException code 20 (string)', () => {
    expect(isAbortError({ code: '20', message: 'some error' })).toBe(true);
  });

  it('detects DOMException code 20 (number)', () => {
    expect(isAbortError({ code: 20, message: 'some error' })).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });

  it('returns false for non-abort errors', () => {
    expect(isAbortError(new Error('Network timeout'))).toBe(false);
    expect(isAbortError({ name: 'TypeError', message: 'x is not a function' })).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isAbortError('abort')).toBe(false);
    expect(isAbortError(42)).toBe(false);
  });
});

describe('isTransientMutationError', () => {
  it('erkennt "Failed to fetch" (TypeError) als vorübergehend', () => {
    expect(isTransientMutationError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('erkennt beliebige TypeError als vorübergehend (Netzfehler-Heuristik)', () => {
    expect(isTransientMutationError(new TypeError('NetworkError when attempting to fetch resource'))).toBe(true);
  });

  // A-Final-Fix 2 (final-review-A.md, Important 2): `e.name === 'TypeError'` allein wertete
  // JEDEN Laufzeit-TypeError als vorübergehend, nicht nur Netzfehler -- ein echter
  // Programmfehler (z. B. auf altem/beschädigtem persistiertem Zustand) blieb dadurch ewig an
  // der Spitze der Warteschlange stehen (GenericMutationQueue.ts:436-442 bricht sofort ab,
  // retryCount++ wird nie erreicht) und blockierte alle folgenden Einträge, statt nach
  // MAX_RETRIES in die Fehlerliste zu wandern.
  it('behandelt einen ProgrammFehler-TypeError (kein Netz-Muster in der Meldung) als dauerhaft', () => {
    expect(
      isTransientMutationError(new TypeError("Cannot read properties of undefined (reading 'x')"))
    ).toBe(false);
  });

  it('erkennt Timeout als vorübergehend', () => {
    expect(isTransientMutationError(new Error('Request timeout'))).toBe(true);
  });

  it('erkennt Abbruch (AbortError) als vorübergehend', () => {
    expect(isTransientMutationError(new DOMException('The operation was aborted', 'AbortError'))).toBe(true);
  });

  it('erkennt HTTP 408 als vorübergehend', () => {
    expect(isTransientMutationError(Object.assign(new Error('Request Timeout'), { status: 408 }))).toBe(true);
  });

  it('erkennt HTTP 429 als vorübergehend', () => {
    expect(isTransientMutationError(Object.assign(new Error('Too Many Requests'), { status: 429 }))).toBe(true);
  });

  it('erkennt HTTP 5xx als vorübergehend', () => {
    expect(isTransientMutationError(Object.assign(new Error('Bad Gateway'), { status: 502 }))).toBe(true);
  });

  it('erkennt HTTP-Status auch als statusCode', () => {
    expect(isTransientMutationError(Object.assign(new Error('Service Unavailable'), { statusCode: 503 }))).toBe(true);
  });

  it('erkennt Status in originalError (RepositoryError-Wrapper)', () => {
    const wrapped = new RepositoryError('save', 'Service Unavailable', { status: 503 });
    expect(isTransientMutationError(wrapped)).toBe(true);
  });

  it('behandelt RLS/403 als dauerhaft (nicht transient)', () => {
    const rls = Object.assign(new Error('new row violates row-level security policy'), {
      code: '42501',
      status: 403,
    });
    expect(isTransientMutationError(rls)).toBe(false);
  });

  it('behandelt andere 4xx (außer 408/429) als dauerhaft', () => {
    expect(isTransientMutationError(Object.assign(new Error('Bad Request'), { status: 400 }))).toBe(false);
    expect(isTransientMutationError(Object.assign(new Error('Not Found'), { status: 404 }))).toBe(false);
  });

  it('behandelt Postgres-Fehlercodes (23xxx/P0001/22P02) als dauerhaft', () => {
    expect(isTransientMutationError(Object.assign(new Error('duplicate key value'), { code: '23505' }))).toBe(false);
    expect(isTransientMutationError(Object.assign(new Error('raise exception'), { code: 'P0001' }))).toBe(false);
    expect(isTransientMutationError(Object.assign(new Error('invalid input syntax'), { code: '22P02' }))).toBe(false);
  });

  it('behandelt OptimisticLockError immer als dauerhaft', () => {
    expect(isTransientMutationError(new OptimisticLockError('match-1', 1, 2))).toBe(false);
  });

  it('behandelt sonstige Fehler ohne Netz-/Status-Signal als dauerhaft', () => {
    expect(isTransientMutationError(new Error('Unknown error'))).toBe(false);
  });

  it('returns false for null/undefined/non-object', () => {
    expect(isTransientMutationError(null)).toBe(false);
    expect(isTransientMutationError(undefined)).toBe(false);
    expect(isTransientMutationError('boom')).toBe(false);
  });

  // =============================================================================
  // Task A3 Fixrunde 1: die tatsächliche Fehlerform, wie sie über
  // SupabaseRepository ankommt — nicht ein roher TypeError, sondern ein von
  // postgrest-js gefangenes Plain-Object (kein `.name`), von
  // SupabaseRepository in RepositoryError verpackt. `updateMatch(es)` (der
  // Live-Cockpit-Schreibpfad) verpackt zusätzlich in ein Error[]-Array.
  // Chrome/Firefox/Safari je einmal, weil der Wortlaut je Browser abweicht
  // und Safari/iOS ("Load failed") vorher NICHT erkannt wurde (Review-Fund).
  // =============================================================================
  describe('reale SupabaseRepository-Fehlerform (postgrest-js, kein Throw)', () => {
    // Wie postgrest-js res.catch((fetchError) => ...) den Fehler tatsächlich
    // liefert: ein Plain-Object OHNE .name-Feld, message = "<name>: <reason>".
    function postgrestNonThrowError(message: string) {
      return { message, details: '', hint: '', code: '' };
    }

    const browserMessages = {
      chrome: 'TypeError: Failed to fetch',
      firefox: 'TypeError: NetworkError when attempting to fetch resource.',
      safari: 'TypeError: Load failed',
    };

    it.each(Object.entries(browserMessages))(
      'get()/save()-Pfad (RepositoryError mit einzelnem originalError) — %s',
      (_browser, message) => {
        const postgrestError = postgrestNonThrowError(message);
        const wrapped = new RepositoryError('get', postgrestError.message, postgrestError);
        expect(isTransientMutationError(wrapped)).toBe(true);
      }
    );

    it.each(Object.entries(browserMessages))(
      'updateMatch(es)-Pfad (RepositoryError mit Error[]-originalError) — %s',
      (_browser, message) => {
        const postgrestError = postgrestNonThrowError(message);
        const errors = [new Error(`Match m1: ${postgrestError.message}`)];
        const wrapped = new RepositoryError(
          'updateMatches',
          `Failed to update matches/tournament: ${errors.map((e) => e.message).join('; ')}`,
          errors
        );
        expect(isTransientMutationError(wrapped)).toBe(true);
      }
    );

    it('durchsucht das originalError-Array auch, wenn die Top-Level-Nachricht keinen Netz-Hinweis trägt', () => {
      // Konstruiert bewusst so, dass NUR die Array-Rekursion den Fall findet
      // (Top-Level-Message enthält absichtlich keinen der Muster) — beweist,
      // dass das Durchsuchen des Arrays selbst etwas beiträgt, nicht nur die
      // (im echten Code zufällig auch treffende) Top-Level-Konkatenation.
      const errors = [new Error('Match m1: irgendein anderer Fehler'), new Error('Match m2: TypeError: Load failed')];
      const wrapped = new RepositoryError('updateMatches', 'Mehrere Matches konnten nicht aktualisiert werden', errors);
      expect(isTransientMutationError(wrapped)).toBe(true);
    });

    it('Array ohne jeden Netz-Hinweis bleibt dauerhaft', () => {
      const errors = [new Error('Match m1: permission denied'), new Error('Match m2: constraint violated')];
      const wrapped = new RepositoryError('updateMatches', 'Mehrere Matches konnten nicht aktualisiert werden', errors);
      expect(isTransientMutationError(wrapped)).toBe(false);
    });
  });
});
