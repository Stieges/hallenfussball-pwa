/**
 * Task C2a, Aufgabe 1: Fehlerklassen fuer den Sender (RC9). Jede Klasse aus
 * realistischen Fehlerobjekten -- Form wie `RepositoryError` mit PostgREST-Fehler
 * `{ code, message, details, hint }` (appendMatchEventsRpc wirft genau so).
 */
import { describe, it, expect } from 'vitest';
import { RepositoryError } from '../../../errors';
import { classifySendFailure, sqlStateOf, type SendFailure } from '../sendErrors';

/** PostgrestError-Form, wie sie `callAppendMatchEvents` als `originalError` verpackt. */
function postgrest(code: string, message: string): { code: string; message: string; details: string; hint: string } {
  return { code, message, details: '', hint: '' };
}

function rpcError(code: string, message: string): RepositoryError {
  return new RepositoryError('appendMatchEvents', message, postgrest(code, message));
}

describe('sqlStateOf', () => {
  it('liest den SQLSTATE aus RepositoryError.originalError.code', () => {
    expect(sqlStateOf(rpcError('54000', 'Spiel voll'))).toBe('54000');
  });

  it('liest den Code auch direkt vom Fehlerobjekt (Umschlag ohne Wrapper)', () => {
    expect(sqlStateOf(postgrest('22023', 'p_events braucht 1 bis 200 Ereignisse'))).toBe('22023');
  });

  it('folgt geschachtelten Wrappern', () => {
    const inner = new RepositoryError('appendMatchEvents', 'geloescht', postgrest('55000', 'nicht mehr beschreibbar'));
    const outer = new RepositoryError('updateMatches', 'Match m: geloescht', inner);
    expect(sqlStateOf(outer)).toBe('55000');
  });

  it('liefert undefined ohne Code und bei Nicht-Fehlern', () => {
    expect(sqlStateOf(new Error('ohne Code'))).toBeUndefined();
    expect(sqlStateOf(new RepositoryError('appendMatchEvents', 'Transport', { message: 'TypeError: Failed to fetch' }))).toBeUndefined();
    expect(sqlStateOf(null)).toBeUndefined();
  });
});

describe('classifySendFailure', () => {
  it('auth: SQLSTATE 42501 (nicht angemeldet)', () => {
    const failure = classifySendFailure(rpcError('42501', 'permission denied for function append_match_events'));
    expect(failure).toMatchObject({ kind: 'auth', sqlState: '42501' });
  });

  it.each(['PGRST301', 'PGRST302', 'PGRST303'])('auth: PostgREST-Code %s (JWT fehlt/abgelaufen)', (code) => {
    const failure = classifySendFailure(rpcError(code, 'JWT expired'));
    expect(failure.kind).toBe('auth');
    expect(failure.sqlState).toBe(code);
  });

  it('auth: HTTP-Status 401', () => {
    const error = new RepositoryError('appendMatchEvents', 'Unauthorized', { message: 'Unauthorized', status: 401 });
    expect(classifySendFailure(error).kind).toBe('auth');
  });

  it('auth hat Vorrang vor transient (Netz-Meldung mit 42501)', () => {
    const error = new RepositoryError(
      'appendMatchEvents',
      'TypeError: Failed to fetch',
      postgrest('42501', 'TypeError: Failed to fetch'),
    );
    expect(classifySendFailure(error).kind).toBe('auth');
  });

  it('notReady: SQLSTATE 22023 (Spiel hat noch keine zwei Teams, V8)', () => {
    const failure = classifySendFailure(rpcError('22023', 'append_match_events: Spiel m hat noch keine zwei Teams'));
    expect(failure).toMatchObject({ kind: 'notReady', sqlState: '22023' });
  });

  it('matchFull: SQLSTATE 54000 (mehr als 2000 Engine-Ereignisse)', () => {
    const failure = classifySendFailure(rpcError('54000', 'append_match_events: Spiel m ist voll'));
    expect(failure).toMatchObject({ kind: 'matchFull', sqlState: '54000' });
  });

  it('matchGone: SQLSTATE 55000 (Spiel zwischen Rechtepruefung und Sperre geloescht)', () => {
    const failure = classifySendFailure(rpcError('55000', 'append_match_events: Spiel m nicht mehr beschreibbar'));
    expect(failure).toMatchObject({ kind: 'matchGone', sqlState: '55000' });
  });

  it.each([
    ['Chrome', 'TypeError: Failed to fetch'],
    ['Firefox', 'TypeError: NetworkError when attempting to fetch resource.'],
    ['Safari/iOS (Captive Portal)', 'TypeError: Load failed'],
  ])('transient: Netzfehler %s', (_browser, message) => {
    const error = new RepositoryError('appendMatchEvents', message, {
      message,
      details: '',
      hint: '',
      code: '',
    });
    const failure = classifySendFailure(error);
    expect(failure.kind).toBe('transient');
  });

  it('transient: Timeout und Abbruch', () => {
    const timeout = new RepositoryError('appendMatchEvents', 'Timeout: die Anfrage hat zu lange gedauert', {
      message: 'Timeout',
      details: '',
      hint: '',
      code: '',
    });
    expect(classifySendFailure(timeout).kind).toBe('transient');
    expect(classifySendFailure(new DOMException('The operation was aborted', 'AbortError')).kind).toBe('transient');
  });

  it('transient: HTTP 408/429/5xx', () => {
    expect(classifySendFailure(Object.assign(new Error('Request Timeout'), { status: 408 })).kind).toBe('transient');
    expect(classifySendFailure(Object.assign(new Error('Too Many Requests'), { status: 429 })).kind).toBe('transient');
    expect(classifySendFailure(Object.assign(new Error('Bad Gateway'), { status: 502 })).kind).toBe('transient');
  });

  it('permanent: unbekannte Fehler und dauerhafte Servercodes', () => {
    expect(classifySendFailure(new Error('Unerwartete Antwort von append_match_events')).kind).toBe('permanent');
    expect(classifySendFailure(rpcError('23505', 'duplicate key value')).kind).toBe('permanent');
    expect(classifySendFailure(rpcError('P0001', 'raise exception')).kind).toBe('permanent');
    expect(classifySendFailure(rpcError('42501', 'RLS')).kind).not.toBe('permanent');
  });

  it('liefert Klartext und SQLState im Ergebnis', () => {
    const failure: SendFailure = classifySendFailure(rpcError('54000', 'append_match_events: Spiel m ist voll'));
    expect(failure.message).toBe('append_match_events: Spiel m ist voll');
    expect(failure.sqlState).toBe('54000');
    const withoutState = classifySendFailure(new Error('Netz weg'));
    expect(withoutState.sqlState).toBeUndefined();
    expect(withoutState.message).toBe('Netz weg');
  });
});
