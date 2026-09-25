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
});
